
const deviceDiscovery = require('../../utils/deviceDiscovery');
const vlanHandler = require('../vlanHandler');

/**
 * Discover device details using SNMP
 * Enhanced to include Entity MIB queries for exact model information
 */
exports.discoverDevice = async (req, res) => {
  try {
    const { ip, community = 'public', version = '2c' } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: 'IP address is required' });
    }
    
    logger.info(`[SNMP] Starting STRICTLY focused device discovery for ${ip} using SNMPv${version}`);
    logger.info(`[SNMP] Will query the essential system OIDs and Entity MIB for precise model identification`);
    
    // First get the standard device info
    const deviceInfo = await deviceDiscovery.discoverDeviceInfo(ip, community, version);
    
    // If this is a Cisco device, attempt to get the precise model information from Entity MIB
    if (deviceInfo.manufacturer === 'Cisco') {
      try {
        logger.info(`[SNMP] Querying Entity MIB for exact model information on ${ip}`);
        const entityMibOid = '1.3.6.1.2.1.47.1.1.1.1.13';
        
        // Create a new SNMP session for this specific query
        const snmp = require('net-snmp');
        const snmpVersion = version === '1' ? snmp.Version1 : snmp.Version2c;
        const session = snmp.createSession(ip, community, {
          version: snmpVersion,
          retries: 1,
          timeout: 5000
        });
        
        // Perform a targeted walk of the Entity MIB
        const exactModelInfo = await new Promise((resolve, reject) => {
          logger.info(`[SNMP] Walking OID ${entityMibOid} for precise model identification`);
          
          const results = {};
          session.walk(entityMibOid, 10, (varbinds) => {
            // Each varbind contains OID and value for that OID
            for (let i = 0; i < varbinds.length; i++) {
              if (snmp.isVarbindError(varbinds[i])) {
                logger.warn(`[SNMP] Error for OID ${varbinds[i].oid}: ${snmp.varbindError(varbinds[i])}`);
                continue;
              }
              
              // Get the value (model string)
              const value = varbinds[i].value;
              let modelString = null;
              
              if (Buffer.isBuffer(value)) {
                modelString = value.toString().trim();
              } else if (typeof value === 'string') {
                modelString = value.trim();
              }
              
              if (modelString && modelString.length > 0) {
                results[varbinds[i].oid] = modelString;
                logger.info(`[ENTITY-MIB] Found model component: ${varbinds[i].oid} = ${modelString}`);
              }
            }
          }, (error) => {
            if (error) {
              logger.warn(`[SNMP] Error walking Entity MIB: ${error.message}`);
              // Don't reject, just return empty results
              resolve({});
            } else {
              // Return all discovered model strings
              resolve(results);
            }
            session.close();
          });
        });
        
        // Process results to find the exact model
        if (Object.keys(exactModelInfo).length > 0) {
          // Sort the OIDs numerically (to get the first few entries which typically have chassis info)
          const sortedOids = Object.keys(exactModelInfo).sort();
          
          // Look for the chassis model which is typically one of the first entries
          for (const oid of sortedOids.slice(0, 5)) {
            const modelString = exactModelInfo[oid];
            
            // If we find a WS-C model string, this is likely the main chassis
            if (modelString && (modelString.startsWith('WS-C') || modelString.startsWith('C'))) {
              logger.info(`[SNMP] Found exact model from Entity MIB: ${modelString}`);
              deviceInfo.exactModel = modelString;
              
              // Update the model field with this more precise information
              deviceInfo.model = modelString;
              break;
            }
          }
        }
      } catch (entityMibError) {
        logger.warn(`[SNMP] Error querying Entity MIB: ${entityMibError.message}`);
      }
    }
    
    // Enhanced device type detection - also check entity MIB for chassis class
    try {
      const entityClassOid = '1.3.6.1.2.1.47.1.1.1.1.5'; // physical class
      
      // Create a new SNMP session for this specific query
      const snmp = require('net-snmp');
      const snmpVersion = version === '1' ? snmp.Version1 : snmp.Version2c;
      const session = snmp.createSession(ip, community, {
        version: snmpVersion,
        retries: 1,
        timeout: 5000
      });
      
      // Look for chassis class data for better device type identification
      const physicalClassData = await new Promise((resolve, reject) => {
        logger.info(`[SNMP] Walking OID ${entityClassOid} for device type identification`);
        
        const results = {};
        session.walk(entityClassOid, 10, (varbinds) => {
          for (let i = 0; i < varbinds.length; i++) {
            if (snmp.isVarbindError(varbinds[i])) {
              continue;
            }
            
            const classValue = varbinds[i].value;
            if (classValue) {
              results[varbinds[i].oid] = classValue;
            }
          }
        }, (error) => {
          if (error) {
            resolve({});
          } else {
            resolve(results);
          }
          session.close();
        });
      });
      
      // If we found physical class data, we can enhance the device type detection
      if (Object.keys(physicalClassData).length > 0) {
        logger.info(`[SNMP] Found ${Object.keys(physicalClassData).length} physical class entries for enhanced device type detection`);
        
        // Check if the device has chassis (value 3) entries
        const hasChassisEntries = Object.values(physicalClassData).some(value => value === 3);
        
        if (hasChassisEntries && deviceInfo.type === 'Other') {
          // Get interface type information to better determine device type
          const ifTypeOid = '1.3.6.1.2.1.2.2.1.3'; // ifType
          
          const ifTypeData = await new Promise((resolve, reject) => {
            const session = snmp.createSession(ip, community, {
              version: snmpVersion,
              retries: 1,
              timeout: 5000
            });
            
            const results = {};
            session.walk(ifTypeOid, 10, (varbinds) => {
              for (let i = 0; i < varbinds.length; i++) {
                if (!snmp.isVarbindError(varbinds[i])) {
                  results[varbinds[i].oid] = varbinds[i].value;
                }
              }
            }, (error) => {
              resolve(results);
              session.close();
            });
          });
          
          // Count interface types to help determine device type
          const ifTypeCounts = {};
          Object.values(ifTypeData).forEach(type => {
            ifTypeCounts[type] = (ifTypeCounts[type] || 0) + 1;
          });
          
          logger.info(`[SNMP] Interface type distribution: ${JSON.stringify(ifTypeCounts)}`);
          
          // Ethernet interfaces (6) are common in switches
          if (ifTypeCounts['6'] && ifTypeCounts['6'] > 10) {
            deviceInfo.type = 'Switch';
            logger.info(`[SNMP] Enhanced device type detection: identified as Switch based on interface types`);
          }
          // Many PPP (23) or tunnel (131) interfaces suggest a router
          else if ((ifTypeCounts['23'] && ifTypeCounts['23'] > 3) || 
                   (ifTypeCounts['131'] && ifTypeCounts['131'] > 3)) {
            deviceInfo.type = 'Router';
            logger.info(`[SNMP] Enhanced device type detection: identified as Router based on interface types`);
          }
        }
      }
    } catch (enhancedTypeError) {
      logger.warn(`[SNMP] Error in enhanced device type detection: ${enhancedTypeError.message}`);
    }
    
    logger.info(`[SNMP] Device discovery completed for ${ip} - Identified as: ${deviceInfo.manufacturer || 'Unknown'} ${deviceInfo.model || ''} (${deviceInfo.type || 'Unknown Type'})`);
    
    // If we have a hostname from sysName, log it
    if (deviceInfo.sysName) {
      logger.info(`[SNMP] Device hostname: ${deviceInfo.sysName}`);
    }
    
    res.json({ 
      status: 'success',
      device: deviceInfo
    });
  } catch (error) {
    logger.error('[SNMP] Device discovery error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Discover VLANs using SNMP
 */
exports.discoverVlans = async (req, res) => {
  try {
    const { ip, community = 'public', version = '2c', make } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: 'IP address is required' });
    }
    
    logger.info(`[SNMP] Starting STRICTLY focused VLAN discovery for ${ip} using SNMPv${version}`);
    logger.info(`[SNMP] Will execute sequential targeted operations ONLY:`);
    logger.info(`[SNMP] 1. VLAN ID OID subtree: 1.3.6.1.4.1.9.9.46.1.3.1.1.2`);
    logger.info(`[SNMP] 2. VLAN name OID subtree: 1.3.6.1.4.1.9.9.46.1.3.1.1.4`);
    logger.info(`[SNMP] 3. IP address interface index OID subtree: 1.3.6.1.2.1.4.20.1.2`);
    logger.info(`[SNMP] 4. IP address subnet mask OID subtree: 1.3.6.1.2.1.4.20.1.3`);
    logger.info(`[SNMP] 5. Interface description OID subtree: 1.3.6.1.2.1.2.2.1.2`);
    logger.info(`[SNMP] 6. System name OID: 1.3.6.1.2.1.1.5.0`);
    
    // Get device hostname first
    let deviceHostname = null;
    try {
      const deviceInfo = await deviceDiscovery.discoverDeviceInfo(ip, community, version);
      if (deviceInfo && deviceInfo.sysName) {
        deviceHostname = deviceInfo.sysName.split('.')[0]; // Get hostname part before domain
        logger.info(`[SNMP] Device hostname: ${deviceHostname}`);
      }
    } catch (e) {
      logger.warn(`[SNMP] Could not retrieve device hostname: ${e.message}`);
    }
    
    const result = await vlanHandler.discoverVlans(ip, community, version, make);
    
    // If we have a hostname, add it to the result
    if (deviceHostname) {
      result.deviceHostname = deviceHostname;
      
      // Update usedBy for all VLANs to use hostname instead of IP
      if (result.vlans && Array.isArray(result.vlans)) {
        result.vlans = result.vlans.map(vlan => ({
          ...vlan,
          usedBy: [deviceHostname]
        }));
      }
    }
    
    logger.info(`[SNMP] VLAN discovery completed for ${deviceHostname || ip}: found ${result.vlans.length} valid VLANs`);
    
    // Log some sample raw data for verification
    if (result.rawData && result.rawData.vlanState && result.rawData.vlanState.length > 0) {
      logger.info(`[SNMP] Sample raw VLAN state data (first entry): ${JSON.stringify(result.rawData.vlanState[0])}`);
    }
    
    // Add logging for VLAN names
    if (result.vlans.length > 0) {
      logger.info(`[SNMP] VLAN names found: ${result.vlans.map(v => `"${v.name}"`).join(', ')}`);
    }
    
    // Add logging for subnet information
    const vlansWithSubnets = result.vlans.filter(v => v.subnet).length;
    if (vlansWithSubnets > 0) {
      logger.info(`[SNMP] Subnet information found for ${vlansWithSubnets} VLANs`);
      logger.info(`[SNMP] Sample subnet mappings: ${result.vlans.filter(v => v.subnet).slice(0, 5).map(v => `VLAN ${v.vlanId}: ${v.subnet}`).join(', ')}`);
    } else {
      logger.info(`[SNMP] No subnet information found for any VLANs`);
    }
    
    res.json(result);
  } catch (error) {
    logger.error('[SNMP] VLAN discovery error:', error);
    res.status(500).json({ error: error.message });
  }
};
