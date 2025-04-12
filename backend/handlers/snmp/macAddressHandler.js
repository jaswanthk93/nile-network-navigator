
const snmp = require('net-snmp');
const { getSessions } = require('./connectionHandler');
const vlanHandler = require('../vlanHandler');

/**
 * OIDs for MAC address discovery
 */
const MAC_OIDS = {
  // Bridge MIB - MAC to port mapping
  bridgeMacToPort: '1.3.6.1.2.1.17.4.3.1.2',     // dot1dTpFdbPort
  bridgePortToIfIndex: '1.3.6.1.2.1.17.1.4.1.2', // dot1dBasePortIfIndex
  
  // Interface MIB - interface information
  ifName: '1.3.6.1.2.1.31.1.1.1.1',              // ifName (IF-MIB)
  ifDesc: '1.3.6.1.2.1.2.2.1.2',                 // ifDescr
  
  // Q-BRIDGE MIB - VLAN information
  vlanToMac: '1.3.6.1.2.1.17.7.1.4.3.1.2',       // dot1qTpFdbPort
  vlanStaticName: '1.3.6.1.2.1.17.7.1.4.3.1.1',  // dot1qVlanStaticName
  vlanStatus: '1.3.6.1.2.1.17.7.1.4.3.1.5'       // dot1qTpFdbStatus
};

/**
 * Helper to convert a MAC address string to an OID suffix
 */
function macToOidSuffix(mac) {
  return mac.split(/[:-]/).map(part => parseInt(part, 16)).join('.');
}

/**
 * Helper to convert an OID suffix to a MAC address string
 */
function oidSuffixToMac(oidSuffix) {
  return oidSuffix.split('.').map(num => 
    parseInt(num).toString(16).padStart(2, '0')
  ).join(':').toUpperCase();
}

/**
 * Discover MAC addresses on a device using SNMP
 */
exports.discoverMacAddresses = async (req, res) => {
  try {
    // Extract session ID and VLAN ID from request
    const { sessionId, ip, community = 'public', version = '2c', vlanId } = req.body;
    
    if (!ip && !sessionId) {
      return res.status(400).json({ error: 'Either IP address or session ID is required' });
    }
    
    // Log the operation
    logger.info(`[SNMP] Starting MAC address discovery for ${ip || 'session ' + sessionId}${vlanId ? ` on VLAN ${vlanId}` : ''}`);
    logger.info(`[SNMP] Will execute targeted SNMP walks to discover MAC address table entries`);
    
    let session;
    let closeSessionWhenDone = false;
    
    // Use existing session or create a new one
    if (sessionId) {
      const sessions = getSessions();
      if (!sessions[sessionId]) {
        return res.status(404).json({ error: 'Session not found or expired' });
      }
      
      session = sessions[sessionId].session;
      sessions[sessionId].lastActivity = Date.now();
    } else {
      // Create a new session
      const snmpVersion = version === '1' ? snmp.Version1 : snmp.Version2c;
      session = snmp.createSession(ip, community, {
        version: snmpVersion,
        retries: 1,
        timeout: 5000
      });
      closeSessionWhenDone = true;
    }
    
    // Determine which VLANs to query
    let vlans = [];
    
    if (vlanId) {
      // Query specific VLAN
      vlans = [vlanId];
    } else {
      // First discover VLANs, then query each one
      try {
        logger.info(`[SNMP] No VLAN specified, discovering VLANs first`);
        const vlanResult = await vlanHandler.discoverVlans(ip, community, version);
        vlans = vlanResult.vlans.map(vlan => vlan.vlanId);
        logger.info(`[SNMP] Discovered ${vlans.length} VLANs for MAC address lookup`);
      } catch (error) {
        logger.warn(`[SNMP] Failed to discover VLANs: ${error.message}. Will use default VLAN 1`);
        vlans = [1]; // Default to VLAN 1 if VLAN discovery fails
      }
    }
    
    // Results storage
    const macAddresses = [];
    const macToVlanMap = {};
    const portToIfIndexMap = {};
    const ifIndexToNameMap = {};
    
    // For each VLAN, query MAC addresses
    for (const vlan of vlans) {
      try {
        logger.info(`[SNMP] Querying MAC addresses for VLAN ${vlan}`);
        
        // Get community string with VLAN if needed (for some switches)
        const vlanCommunity = vlan === 1 ? community : `${community}@${vlan}`;
        
        // 1. Query bridge port to interface index mapping
        await walkOid(session, MAC_OIDS.bridgePortToIfIndex, (oid, bridgePort, ifIndex) => {
          // Extract port number from OID
          const portNumber = oid.split('.').pop();
          portToIfIndexMap[portNumber] = ifIndex;
        });
        
        // 2. Query interface names
        await walkOid(session, MAC_OIDS.ifName, (oid, ifIndex, ifName) => {
          // Extract interface index from OID
          ifIndex = oid.split('.').pop();
          ifIndexToNameMap[ifIndex] = ifName.toString();
        });
        
        // If we couldn't get ifName, try ifDescr
        if (Object.keys(ifIndexToNameMap).length === 0) {
          await walkOid(session, MAC_OIDS.ifDesc, (oid, ifIndex, ifDesc) => {
            // Extract interface index from OID
            ifIndex = oid.split('.').pop();
            ifIndexToNameMap[ifIndex] = ifDesc.toString();
          });
        }
        
        // 3. Query MAC to port mapping
        await walkOid(session, MAC_OIDS.bridgeMacToPort, (oid, macOidSuffix, bridgePort) => {
          // Extract MAC from OID
          const macParts = oid.replace(`${MAC_OIDS.bridgeMacToPort}.`, '').split('.');
          if (macParts.length === 6) {
            const mac = macParts.map(p => parseInt(p).toString(16).padStart(2, '0')).join(':').toUpperCase();
            
            // Store MAC to VLAN mapping
            macToVlanMap[mac] = vlan;
            
            // Get interface index from bridge port
            const ifIndex = portToIfIndexMap[bridgePort];
            
            // Get interface name
            const ifName = ifIndexToNameMap[ifIndex] || `Port ${bridgePort}`;
            
            // Add to results
            macAddresses.push({
              macAddress: mac,
              vlanId: vlan,
              port: ifName,
              status: 'authenticated', // Default status
              deviceType: getMacDeviceType(mac)
            });
          }
        });
        
        logger.info(`[SNMP] Found ${macAddresses.length} MAC addresses in VLAN ${vlan}`);
      } catch (error) {
        logger.error(`[SNMP] Error querying MAC addresses for VLAN ${vlan}: ${error.message}`);
      }
    }
    
    // Close session if we created it
    if (closeSessionWhenDone) {
      try {
        session.close();
      } catch (e) {
        logger.error(`[SNMP] Error closing session: ${e.message}`);
      }
    }
    
    // Return unique MAC addresses
    const uniqueMacs = [];
    const seenMacs = new Set();
    
    macAddresses.forEach(mac => {
      if (!seenMacs.has(mac.macAddress)) {
        seenMacs.add(mac.macAddress);
        uniqueMacs.push(mac);
      }
    });
    
    logger.info(`[SNMP] MAC address discovery complete, found ${uniqueMacs.length} unique MAC addresses`);
    
    // Return results
    res.json({
      status: 'success',
      macAddresses: uniqueMacs,
      vlanIds: vlans
    });
  } catch (error) {
    logger.error('[SNMP] MAC address discovery error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Helper function to walk an OID and process results
 */
function walkOid(session, oid, callback) {
  return new Promise((resolve, reject) => {
    const results = {};
    
    function doneCb(error) {
      if (error) {
        return reject(error);
      }
      resolve(results);
    }
    
    function feedCb(varbinds) {
      for (const varbind of varbinds) {
        if (snmp.isVarbindError(varbind)) {
          logger.warn(`SNMP walk varbind error: ${snmp.varbindError(varbind)}`);
        } else {
          const value = varbind.value;
          const oid = varbind.oid;
          let parsedValue;
          
          // Convert Buffer to appropriate JavaScript type
          if (Buffer.isBuffer(value)) {
            if (varbind.type === snmp.ObjectType.OctetString) {
              parsedValue = value.toString();
            } else {
              parsedValue = parseInt(value.toString('hex'), 16);
            }
          } else {
            parsedValue = value;
          }
          
          results[oid] = parsedValue;
          
          // Extract the suffix (the part after the base OID)
          const suffix = oid.replace(`${oid}.`, '');
          
          // Call the callback with the OID, suffix, and parsed value
          callback(oid, suffix, parsedValue);
        }
      }
    }
    
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
