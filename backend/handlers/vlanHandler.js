
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
  
  try {
    // Log the exact OIDs we're querying - only once
    logger.info(`[SNMP] Using VLAN state OID: ${VLAN_OIDS.vlanList}`);
    logger.info(`[SNMP] Using VLAN name OID: ${VLAN_OIDS.vlanName}`);
    
    // Walk through VLAN state OID to get VLAN IDs
    await new Promise((resolve, reject) => {
      logger.info(`[SNMP] Executing: snmpwalk -v${version} -c ${community} ${ip} ${VLAN_OIDS.vlanList}`);
      
      session.walk(VLAN_OIDS.vlanList, function(varbinds) {
        for (const varbind of varbinds) {
          if (!snmp.isVarbindError(varbind)) {
            const oidParts = varbind.oid.split('.');
            const vlanId = parseInt(oidParts[oidParts.length - 1], 10);
            
            // Skip if we've already processed this VLAN ID
            if (processedVlanIds.has(vlanId)) {
              continue;
            }
            
            // Parse the state value (1 = operational, 2 = suspended, etc.)
            let stateValue = 0;
            if (Buffer.isBuffer(varbind.value)) {
              stateValue = parseInt(varbind.value.toString(), 10);
            } else if (typeof varbind.value === 'number') {
              stateValue = varbind.value;
            }
            
            // Mark this VLAN ID as processed
            processedVlanIds.add(vlanId);
            
            // Only include VLANs with status 1 (active)
            if (!isNaN(vlanId)) {
              // Only include valid VLAN IDs between 1 and 4094 AND with state value of 1 (active)
              if (isValidVlanId(vlanId) && stateValue === 1) {
                logger.info(`[SNMP] Found active VLAN ${vlanId} with state ${stateValue} on ${ip}`);
                vlans.push({
                  vlanId,
                  name: `VLAN${vlanId}`, // Default name, will be updated
                  state: 'active',
                  usedBy: [ip]
                });
              } else if (isValidVlanId(vlanId) && stateValue !== 1) {
                // Log VLANs that were skipped due to inactive status
                logger.warn(`[SNMP] Skipping inactive VLAN ${vlanId} with state ${stateValue} from ${ip}`);
                invalidVlans.push({
                  vlanId,
                  reason: 'Inactive VLAN (status not 1)'
                });
              } else {
                logger.warn(`[SNMP] Ignoring invalid VLAN ID ${vlanId} from ${ip} (outside valid range)`);
                invalidVlans.push({
                  vlanId,
                  reason: 'Invalid VLAN ID range'
                });
              }
            }
          }
        }
      }, function(error) {
        if (error) {
          logger.error(`[SNMP] Error walking VLAN state OID on ${ip}:`, error);
          reject(error);
        } else {
          resolve();
        }
      });
    });
    
    // Reset the processed set for name lookups
    processedVlanIds.clear();
    
    // If we discovered VLANs, fetch their names
    if (vlans.length > 0) {
      await new Promise((resolve, reject) => {
        logger.info(`[SNMP] Executing: snmpwalk -v${version} -c ${community} ${ip} ${VLAN_OIDS.vlanName}`);
        
        session.walk(VLAN_OIDS.vlanName, function(varbinds) {
          for (const varbind of varbinds) {
            if (!snmp.isVarbindError(varbind)) {
              const oidParts = varbind.oid.split('.');
              const vlanId = parseInt(oidParts[oidParts.length - 1], 10);
              
              // Skip if we've already processed this VLAN ID for names
              if (processedVlanIds.has(vlanId)) {
                continue;
              }
              
              processedVlanIds.add(vlanId);
              
              if (!isNaN(vlanId)) {
                // Only update names for VLANs we've already identified
                const vlan = vlans.find(v => v.vlanId === vlanId);
                if (vlan && Buffer.isBuffer(varbind.value)) {
                  vlan.name = varbind.value.toString().trim() || `VLAN${vlanId}`;
                  logger.info(`[SNMP] VLAN ${vlanId} name: ${vlan.name}`);
                }
              }
            }
          }
        }, function(error) {
          if (error) {
            logger.error(`[SNMP] Error walking VLAN name OID on ${ip}:`, error);
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }
    
    // Sort VLANs by ID for consistent output
    vlans.sort((a, b) => a.vlanId - b.vlanId);
    
    // Add counts for active VLANs specifically
    const activeCount = vlans.length;
    const inactiveCount = invalidVlans.filter(v => v.reason === 'Inactive VLAN (status not 1)').length;
    
    logger.info(`[SNMP] Found ${activeCount} active VLANs on ${ip} (ignored ${inactiveCount} inactive and ${invalidVlans.length - inactiveCount} invalid VLANs)`);
    
    return { 
      vlans,
      invalidVlans,
      totalDiscovered: vlans.length + invalidVlans.length,
      validCount: vlans.length,
      invalidCount: invalidVlans.length,
      activeCount,
      inactiveCount
    };
  } finally {
    // Close session
    session.close();
  }
};
