
const snmp = require('net-snmp');
const { isValidVlanId } = require('../utils/validation');

// Constants for Cisco VLAN OIDs
const VLAN_OIDS = {
  vlanList: "1.3.6.1.4.1.9.9.46.1.3.1.1.2", // CISCO-VTP-MIB::vtpVlanState
  vlanName: "1.3.6.1.4.1.9.9.46.1.3.1.1.4", // CISCO-VTP-MIB::vtpVlanName
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
  
  // Always use Cisco-specific OIDs for VLAN state and name
  const vlanOids = VLAN_OIDS;
  
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
    // Walk through VLAN state OID to get VLAN IDs
    // From output: SNMPv2-SMI::enterprises.9.9.46.1.3.1.1.2.1.XXX = INTEGER: 1
    // Where XXX is the VLAN ID and 1 indicates operational state
    await walkVlanStates(session, vlanOids.vlanList, vlans, invalidVlans, ip);
    
    // If we discovered VLANs, fetch their names
    if (vlans.length > 0) {
      await walkVlanNames(session, vlanOids.vlanName, vlans, ip);
    }
    
    logger.info(`[SNMP] Found ${vlans.length} valid VLANs and ${invalidVlans.length} invalid VLANs on ${ip}`);
    
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

/**
 * Walk VLAN states OID to discover VLANs
 * @private
 */
async function walkVlanStates(session, oid, vlans, invalidVlans, ip) {
  return new Promise((resolve, reject) => {
    logger.info(`[SNMP] Walking VLAN state OID ${oid} on ${ip}`);
    
    session.walk(oid, (varbinds) => {
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
            if (isValidVlanId(vlanId)) {
              logger.info(`[SNMP] Found VLAN ${vlanId} with state ${stateValue} on ${ip}`);
              vlans.push({
                vlanId,
                name: `VLAN${vlanId}`, // Default name, will be updated
                state: stateValue === 1 ? 'active' : 'suspended',
                usedBy: [ip]
              });
            } else {
              logger.warn(`[SNMP] Invalid VLAN ID ${vlanId} discovered from ${ip}`);
              invalidVlans.push({
                vlanId,
                name: `VLAN${vlanId}`,
                state: stateValue === 1 ? 'active' : 'suspended',
                usedBy: [ip]
              });
            }
          }
        }
      }
    }, (error) => {
      if (error) {
        logger.error(`[SNMP] Error walking VLAN list on ${ip}:`, error);
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Walk VLAN names OID to get VLAN names
 * @private
 */
async function walkVlanNames(session, oid, vlans, ip) {
  return new Promise((resolve, reject) => {
    logger.info(`[SNMP] Walking VLAN name OID ${oid} on ${ip}`);
    
    session.walk(oid, (varbinds) => {
      for (const varbind of varbinds) {
        if (!snmp.isVarbindError(varbind)) {
          const oidParts = varbind.oid.split('.');
          const vlanId = parseInt(oidParts[oidParts.length - 1], 10);
          
          if (!isNaN(vlanId)) {
            // Find the VLAN in our list
            const vlan = vlans.find(v => v.vlanId === vlanId);
            if (vlan && Buffer.isBuffer(varbind.value)) {
              vlan.name = varbind.value.toString().trim();
              logger.info(`[SNMP] VLAN ${vlanId} name: ${vlan.name}`);
            }
          }
        }
      }
    }, (error) => {
      if (error) {
        logger.error(`[SNMP] Error walking VLAN names on ${ip}:`, error);
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
