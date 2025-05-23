
const snmp = require('net-snmp');
const { getSessions } = require('./connectionHandler');
const vlanHandler = require('../vlanHandler');

/**
 * OIDs for MAC address discovery
 */
const MAC_OIDS = {
  // Bridge MIB - MAC to port mapping (targeted OID for MAC address table)
  bridgeMacToPort: '1.3.6.1.2.1.17.4.3.1.2'  // dot1dTpFdbPort
};

/**
 * Discover MAC addresses on a device using targeted SNMP walks for each VLAN
 */
exports.discoverMacAddresses = async (req, res) => {
  try {
    // Extract session ID and VLAN ID from request
    const { sessionId, ip, community = 'public', version = '2c', vlanId, vlanIds, priorityOnly = false } = req.body;
    
    if (!ip && !sessionId) {
      logger.error('[SNMP] MAC discovery error: Missing IP address or session ID');
      return res.status(400).json({ error: 'Either IP address or session ID is required' });
    }
    
    // Log the operation with more details
    logger.info(`[SNMP] Starting MAC address discovery for ${ip || 'session ' + sessionId}${vlanId ? ` on VLAN ${vlanId}` : ''}`);
    logger.info(`[SNMP] Request details:`, JSON.stringify({
      ip, 
      sessionId,
      community: community ? `${community.slice(0,2)}***` : null, // Mask the community string
      version,
      vlanId,
      vlanIds: vlanIds ? `Array with ${vlanIds.length} VLANs` : null,
      priorityOnly
    }, null, 2));
    
    // Determine which VLANs to query
    let vlans = [];
    
    if (vlanIds && Array.isArray(vlanIds) && vlanIds.length > 0) {
      // Use the provided list of VLAN IDs
      // Make sure each VLAN ID is included only once
      vlans = [...new Set(vlanIds)];
      // Sort vlans in ascending order
      vlans.sort((a, b) => a - b);
      logger.info(`[SNMP] Using provided list of ${vlans.length} unique VLANs in ascending order: ${vlans.join(', ')}`);
      
      // If priorityOnly is set, we'll only process this subset
      if (priorityOnly) {
        logger.info(`[SNMP] Priority mode enabled - will only process the specified VLANs`);
      }
    } else if (vlanId) {
      // Query specific VLAN
      vlans = [vlanId];
      logger.info(`[SNMP] Using single VLAN: ${vlanId}`);
    } else {
      // First discover VLANs, then query each one
      try {
        logger.info(`[SNMP] No VLANs specified, discovering VLANs first`);
        const vlanResult = await vlanHandler.discoverVlans(ip, community, version);
        // Ensure unique VLAN IDs and sort in ascending order
        vlans = [...new Set(vlanResult.vlans.map(vlan => vlan.vlanId))];
        vlans.sort((a, b) => a - b);
        logger.info(`[SNMP] Discovered ${vlans.length} unique VLANs for MAC address lookup in ascending order: ${vlans.join(', ')}`);
      } catch (error) {
        logger.error(`[SNMP] Failed to discover VLANs: ${error.message}. Will use default VLAN 1`);
        vlans = [1]; // Default to VLAN 1 if VLAN discovery fails
      }
    }
    
    // Results storage
    const macAddresses = [];
    const processedVlans = new Set(); // Keep track of processed VLANs
    
    // Set up streaming response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Start the response with an opening object bracket
    res.write('{"status":"processing","macAddresses":[');
    
    let isFirstChunk = true;
    
    // Execute a targeted walk for each VLAN, one at a time
    for (const vlan of vlans) {
      // Skip if we've already processed this VLAN
      if (processedVlans.has(vlan)) {
        logger.info(`[SNMP] Skipping already processed VLAN ${vlan}`);
        continue;
      }
      
      processedVlans.add(vlan); // Mark this VLAN as processed
      
      try {
        // Create community string with VLAN ID as per the requested format: "public@101"
        const vlanCommunity = vlan === 1 ? community : `${community}@${vlan}`;
        logger.info(`[SNMP] Executing targeted walk for VLAN ${vlan} using community string "${vlanCommunity}" and OID ${MAC_OIDS.bridgeMacToPort}`);
        
        // Create a new session for this specific VLAN with reduced timeout and no retries
        const snmpVersion = version === '1' ? snmp.Version1 : snmp.Version2c;
        const session = snmp.createSession(ip, vlanCommunity, {
          version: snmpVersion,
          retries: 0, // No retries
          timeout: 2000 // Reduced timeout to 2 seconds
        });
        
        // Execute the specifically targeted walk for the MAC address table for this VLAN
        const vlanMacs = await walkMacAddressTable(session, MAC_OIDS.bridgeMacToPort, vlan);
        
        // Add the collected MAC addresses from this VLAN to the overall results
        macAddresses.push(...vlanMacs);
        
        // Stream this VLAN's MAC addresses to the client
        if (vlanMacs.length > 0) {
          const chunkData = vlanMacs.map(mac => {
            return {
              macAddress: mac.macAddress,
              vlanId: mac.vlanId,
              deviceType: mac.deviceType
            };
          });
          
          // If not the first chunk, add a comma
          if (!isFirstChunk && chunkData.length > 0) {
            res.write(',');
          }
          
          // Write MAC addresses for this VLAN, without the surrounding brackets
          res.write(JSON.stringify(chunkData).slice(1, -1));
          
          if (isFirstChunk && chunkData.length > 0) {
            isFirstChunk = false;
          }
        }
        
        // Close this VLAN-specific session
        try {
          session.close();
        } catch (e) {
          logger.error(`[SNMP] Error closing session for VLAN ${vlan}: ${e.message}`);
        }
        
        logger.info(`[SNMP] Completed MAC address discovery for VLAN ${vlan}, found ${vlanMacs.length} MAC addresses`);
      } catch (error) {
        logger.error(`[SNMP] Error querying MAC addresses for VLAN ${vlan}: ${error.message}`);
        // Continue with next VLAN instead of failing completely
      }
    }
    
    // Complete the response
    res.write(`],"vlanIds":[${Array.from(processedVlans).join(',')}],"status":"success"}`);
    res.end();
    
    logger.info(`[SNMP] MAC address discovery complete, found ${macAddresses.length} MAC addresses across ${processedVlans.size} VLANs`);
  } catch (error) {
    logger.error('[SNMP] MAC address discovery error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Walk the MAC address table (dot1dTpFdbPort) for a specific VLAN
 * Returns results specific to this VLAN walk
 */
function walkMacAddressTable(session, oid, vlanId) {
  return new Promise((resolve, reject) => {
    // Store MAC addresses for this specific VLAN walk
    const vlanMacs = [];
    // Add a timeout to prevent hanging
    const walkTimeout = setTimeout(() => {
      logger.warn(`[SNMP] Walk timeout for VLAN ${vlanId} after 3 seconds`);
      resolve(vlanMacs); // Return whatever we've collected so far
    }, 3000);
    
    function doneCb(error) {
      clearTimeout(walkTimeout); // Clear the timeout
      if (error) {
        logger.error(`[SNMP] Error in MAC address walk for VLAN ${vlanId}: ${error.message}`);
        return reject(error);
      }
      logger.info(`[SNMP] Successfully completed MAC address walk for VLAN ${vlanId}, found ${vlanMacs.length} MACs`);
      resolve(vlanMacs); // Return the collected MAC addresses for this VLAN
    }
    
    function feedCb(varbinds) {
      for (const varbind of varbinds) {
        if (snmp.isVarbindError(varbind)) {
          logger.warn(`[SNMP] Walk varbind error: ${snmp.varbindError(varbind)}`);
        } else {
          const oid = varbind.oid;
          const bridgePort = varbind.value;
          
          // Extract MAC from OID
          const macParts = oid.replace(`${MAC_OIDS.bridgeMacToPort}.`, '').split('.');
          if (macParts.length === 6) {
            const mac = macParts.map(p => parseInt(p).toString(16).padStart(2, '0')).join(':').toUpperCase();
            
            // Add to VLAN-specific results
            vlanMacs.push({
              macAddress: mac,
              vlanId: vlanId,
              deviceType: getMacDeviceType(mac)
            });
            
            logger.info(`[SNMP] Found MAC ${mac} on VLAN ${vlanId}`);
          }
        }
      }
    }
    
    logger.info(`[SNMP] Starting MAC address walk for VLAN ${vlanId} with OID ${oid}`);
    session.walk(oid, feedCb, doneCb);
  });
}

/**
 * Try to determine device type from MAC address
 */
function getMacDeviceType(mac) {
  // Extract OUI (first 3 bytes of MAC)
  const oui = mac.split(':').slice(0, 3).join(':').toUpperCase();
  
  // This would ideally be a lookup against an OUI database
  // For demo purposes, just assigning random types
  const types = ['Desktop', 'Mobile', 'IoT', 'Server', 'Network'];
  const hash = oui.split(':').reduce((acc, val) => acc + parseInt(val, 16), 0);
  
  return types[hash % types.length];
}
