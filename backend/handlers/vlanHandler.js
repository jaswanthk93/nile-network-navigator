
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
  
  try {
    // Log the exact OIDs we're querying
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
            
            // Parse the state value (1 = operational, 2 = suspended, etc.)
            let stateValue = 0;
            if (Buffer.isBuffer(varbind.value)) {
              stateValue = parseInt(varbind.value.toString(), 10);
            } else if (typeof varbind.value === 'number') {
              stateValue = varbind.value;
            }
            
            if (!isNaN(vlanId)) {
              // Only include valid VLAN IDs between 1 and 4094
              if (isValidVlanId(vlanId)) {
                logger.info(`[SNMP] Found VLAN ${vlanId} with state ${stateValue} on ${ip}`);
                vlans.push({
                  vlanId,
                  name: `VLAN${vlanId}`, // Default name, will be updated
                  state: stateValue === 1 ? 'active' : 'suspended',
                  usedBy: [ip]
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
    
    // If we discovered VLANs, fetch their names
    if (vlans.length > 0) {
      await new Promise((resolve, reject) => {
        logger.info(`[SNMP] Executing: snmpwalk -v${version} -c ${community} ${ip} ${VLAN_OIDS.vlanName}`);
        
        session.walk(VLAN_OIDS.vlanName, function(varbinds) {
          for (const varbind of varbinds) {
            if (!snmp.isVarbindError(varbind)) {
              const oidParts = varbind.oid.split('.');
              const vlanId = parseInt(oidParts[oidParts.length - 1], 10);
              
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
    
    logger.info(`[SNMP] Found ${vlans.length} valid VLANs on ${ip} (ignored ${invalidVlans.length} invalid VLANs)`);
    
    return { 
      vlans,
      invalidVlans,
      totalDiscovered: vlans.length + invalidVlans.length,
      validCount: vlans.length,
      invalidCount: invalidVlans.length
    };
  } finally {
    // Close session
    session.close();
  }
};
