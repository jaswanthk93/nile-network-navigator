
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
    
    logger.info(`[SNMP] Starting targeted device discovery for ${ip} using SNMPv${version}`);
    const deviceInfo = await deviceDiscovery.discoverDeviceInfo(ip, community, version);
    logger.info(`[SNMP] Device discovery completed for ${ip} - Identified as: ${deviceInfo.manufacturer || 'Unknown'} ${deviceInfo.model || ''} (${deviceInfo.type || 'Unknown Type'})`);
    
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
    
    logger.info(`[SNMP] Starting targeted VLAN discovery for ${ip} using SNMPv${version}`);
    
    const result = await vlanHandler.discoverVlans(ip, community, version, make);
    
    logger.info(`[SNMP] VLAN discovery completed for ${ip}: found ${result.vlans.length} valid VLANs`);
    
    // Log some sample raw data for verification
    if (result.rawData && result.rawData.vlanState && result.rawData.vlanState.length > 0) {
      logger.info(`[SNMP] Sample raw VLAN state data (first entry): ${JSON.stringify(result.rawData.vlanState[0])}`);
    }
    
    res.json(result);
  } catch (error) {
    logger.error('[SNMP] VLAN discovery error:', error);
    res.status(500).json({ error: error.message });
  }
};
