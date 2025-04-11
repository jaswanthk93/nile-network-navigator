
const deviceDiscovery = require('../../utils/deviceDiscovery');
const vlanHandler = require('../vlanHandler');

/**
 * Discover device details using SNMP
 */
exports.discoverDevice = async (req, res) => {
  try {
    const { ip, community = 'public', version = '2c' } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: 'IP address is required' });
    }
    
    logger.info(`[SNMP] Starting STRICTLY focused device discovery for ${ip} using SNMPv${version}`);
    logger.info(`[SNMP] Will ONLY query the essential system OIDs - nothing else`);
    const deviceInfo = await deviceDiscovery.discoverDeviceInfo(ip, community, version);
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
