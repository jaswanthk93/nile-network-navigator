
const snmp = require('net-snmp');
const { isValidVlanId } = require('../utils/validation');

// Constants for Cisco VLAN OIDs - using specific OIDs as specified
const VLAN_OIDS = {
  // vtpVlanState - standard Cisco VLAN table
  vlanList: "1.3.6.1.4.1.9.9.46.1.3.1.1.2", 
  // vtpVlanName - standard Cisco VLAN name table
  vlanName: "1.3.6.1.4.1.9.9.46.1.3.1.1.4"
};

/**
 * Discover VLANs using SNMP
 * @param {string} ip - The IP address of the device
 * @param {string} community - The SNMP community string
 * @param {string} version - The SNMP version
 * @param {string} make - The device manufacturer
 * @returns {Object} - Object containing discovered VLANs info
 */
exports.discoverVlans = async (ip, community = 'public', version = '2c', make) => {
  logger.info(`[SNMP] Discovering VLANs from ${ip} using community ${community} (v${version})`);
  
  // Create temporary session
  const snmpVersion = version === '1' ? snmp.Version1 : snmp.Version2c;
  const session = snmp.createSession(ip, community, {
    version: snmpVersion,
    retries: 1,
    timeout: 5000
  });
  
  const vlans = [];
  const invalidVlans = [];
  const processedVlanIds = new Set(); // Track already processed VLAN IDs to prevent duplicates
  
  // Store raw SNMP responses for logging
  const rawResponses = {
    vlanState: [],
    vlanName: []
  };
  
  try {
    // Log the exact OIDs we're querying - be very explicit
    logger.info(`[SNMP] STRICT TARGET: Using ONLY the following OIDs:`);
    logger.info(`[SNMP] STRICT TARGET: 1. VLAN state OID: ${VLAN_OIDS.vlanList} (for VLAN IDs)`);
    logger.info(`[SNMP] STRICT TARGET: 2. VLAN name OID: ${VLAN_OIDS.vlanName} (for VLAN names)`);
    
    // STEP 1: Execute a targeted subtree method call for VLAN IDs 
    logger.info(`[SNMP] Executing targeted subtree call for VLAN IDs with base OID ${VLAN_OIDS.vlanList}`);
    
    const vlanIdResults = await performTargetedOperation(session, VLAN_OIDS.vlanList);
    logger.info(`[SNMP] VLAN ID discovery complete - received ${vlanIdResults.length} OID responses`);
    
    // Process VLAN ID results
    for (const result of vlanIdResults) {
      if (result && result.oid && result.value !== undefined) {
        // Log in the raw SNMP format
        const oidStr = Array.isArray(result.oid) ? result.oid.join('.') : result.oid.toString();
        const valueStr = result.value.toString();
        
        // Add to raw responses for logging
        rawResponses.vlanState.push({
          oid: oidStr,
          value: valueStr
        });
        
        logger.info(`[RAW SNMP VLAN ID] SNMPv2-SMI::enterprises.${oidStr.replace(/^1\.3\.6\.1\.4\.1\./g, '')} = INTEGER: ${valueStr}`);
        
        // Parse the VLAN ID from the OID
        const oidParts = oidStr.split('.');
        const vlanId = parseInt(oidParts[oidParts.length - 1], 10);
        
        // Skip if we've already processed this VLAN ID or it's not a number
        if (processedVlanIds.has(vlanId) || isNaN(vlanId)) {
          continue;
        }
        
        // Extra validation for VLAN ID range - must be 1-4094
        if (vlanId < 1 || vlanId > 4094) {
          invalidVlans.push({
            vlanId,
            reason: 'Invalid VLAN ID range'
          });
          processedVlanIds.add(vlanId); // Mark as processed anyway to avoid duplicates
          continue;
        }
        
        // Parse the state value (1 = operational, 2 = suspended, etc.)
        let stateValue = 0;
        if (Buffer.isBuffer(result.value)) {
          stateValue = parseInt(result.value.toString(), 10);
        } else if (typeof result.value === 'number') {
          stateValue = result.value;
        }
        
        // Mark this VLAN ID as processed
        processedVlanIds.add(vlanId);
        
        // Only include VLANs with state value of 1 (active)
        if (stateValue === 1) {
          logger.info(`[SNMP] Found active VLAN ${vlanId} with state ${stateValue} on ${ip}`);
          vlans.push({
            vlanId,
            name: `VLAN${vlanId}`, // Default name, will be updated
            state: 'active',
            usedBy: [ip]
          });
        } else {
          invalidVlans.push({
            vlanId,
            reason: 'Inactive VLAN (status not 1)'
          });
        }
      }
    }
    
    // Log the actual VLANs found for debugging
    logger.info(`[SNMP] VLAN ID discovery found ${vlans.length} active VLANs: ${vlans.map(v => v.vlanId).join(', ')}`);
    
    // Reset the processed set for name lookups
    processedVlanIds.clear();
    
    // STEP 2: Get names for the VLANs we already found (if any)
    if (vlans.length > 0) {
      logger.info(`[SNMP] Executing targeted subtree call for VLAN names with base OID ${VLAN_OIDS.vlanName}`);
      
      const vlanNameResults = await performTargetedOperation(session, VLAN_OIDS.vlanName);
      logger.info(`[SNMP] VLAN name discovery complete - received ${vlanNameResults.length} OID responses`);
      
      // Process VLAN name results
      for (const result of vlanNameResults) {
        if (result && result.oid && result.value !== undefined) {
          // Log in the raw SNMP format
          const oidStr = Array.isArray(result.oid) ? result.oid.join('.') : result.oid.toString();
          let valueStr = "";
          
          if (Buffer.isBuffer(result.value)) {
            valueStr = result.value.toString().trim();
          } else {
            valueStr = result.value.toString().trim();
          }
          
          // Add to raw responses for logging
          rawResponses.vlanName.push({
            oid: oidStr,
            value: valueStr
          });
          
          logger.info(`[RAW SNMP VLAN NAME] SNMPv2-SMI::enterprises.${oidStr.replace(/^1\.3\.6\.1\.4\.1\./g, '')} = STRING: ${valueStr}`);
          
          // Parse the VLAN ID from the OID
          const oidParts = oidStr.split('.');
          const vlanId = parseInt(oidParts[oidParts.length - 1], 10);
          
          // Skip if we've already processed this VLAN ID for names or it's invalid
          if (processedVlanIds.has(vlanId) || isNaN(vlanId) || vlanId < 1 || vlanId > 4094) {
            continue;
          }
          
          processedVlanIds.add(vlanId);
          
          // Only update names for VLANs we've already identified
          const vlan = vlans.find(v => v.vlanId === vlanId);
          if (vlan) {
            // Always use the returned name value directly without filtering
            vlan.name = valueStr || `VLAN${vlanId}`;
            logger.info(`[SNMP] VLAN ${vlanId} name: "${vlan.name}"`);
          }
        }
      }
    }
    
    // Handle the case of too many VLANs - limit to valid range if needed
    if (vlans.length > 4094) {
      logger.warn(`[SNMP] Found ${vlans.length} VLANs which exceeds the maximum of 4094. Limiting to the valid range.`);
      // Sort and keep only the first 4094 valid VLANs
      vlans.sort((a, b) => a.vlanId - b.vlanId);
      const excessVlans = vlans.splice(4094); 
      
      // Move excess VLANs to invalid list
      excessVlans.forEach(vlan => {
        invalidVlans.push({
          vlanId: vlan.vlanId,
          reason: 'Exceeded maximum valid VLAN count (4094)'
        });
      });
    }
    
    // Add counts for active VLANs specifically
    const activeCount = vlans.length;
    const inactiveCount = invalidVlans.filter(v => v.reason === 'Inactive VLAN (status not 1)').length;
    
    logger.info(`[SNMP] Found ${activeCount} active VLANs on ${ip} (ignored ${inactiveCount} inactive and ${invalidVlans.length - inactiveCount} invalid VLANs)`);
    logger.info(`[SNMP] Final active VLAN IDs: ${vlans.map(v => v.vlanId).join(', ')}`);
    logger.info(`[SNMP] VLAN processing summary: Found ${vlans.length} active VLANs out of ${vlans.length + invalidVlans.length} total VLANs`);
    
    return { 
      vlans,
      invalidVlans,
      totalDiscovered: vlans.length + invalidVlans.length,
      validCount: vlans.length,
      invalidCount: invalidVlans.length,
      activeCount: vlans.length,
      inactiveCount: invalidVlans.filter(v => v.reason === 'Inactive VLAN (status not 1)').length,
      // Include raw response data
      rawData: {
        vlanState: rawResponses.vlanState,
        vlanName: rawResponses.vlanName
      }
    };
  } finally {
    // Close session
    session.close();
  }
};

/**
 * Performs a targeted SNMP operation on a specific OID
 * Using subtree as a more efficient alternative to generic walk
 * 
 * @param {Object} session - SNMP session
 * @param {string} baseOid - The base OID to query
 * @returns {Promise<Array>} - Array of results with oid and value
 */
async function performTargetedOperation(session, baseOid) {
  return new Promise((resolve, reject) => {
    const results = [];
    
    // Use subtree method which is more targeted than general walk
    session.subtree(baseOid, (varbinds) => {
      if (varbinds === null) {
        // End of MIB view or other error, but just consider it the end
        resolve(results);
        return;
      }
      
      // Process this batch of results
      for (const varbind of varbinds) {
        if (!snmp.isVarbindError(varbind)) {
          results.push({
            oid: varbind.oid,
            value: varbind.value
          });
        }
      }
    }, (error) => {
      if (error) {
        logger.error(`[SNMP] Error in subtree operation for ${baseOid}:`, error);
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}
