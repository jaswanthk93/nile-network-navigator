
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
    logger.info(`[SNMP] Will execute TWO sequential targeted walks ONLY:`);
    logger.info(`[SNMP] 1. VLAN ID OID walk: 1.3.6.1.4.1.9.9.46.1.3.1.1.2`);
    logger.info(`[SNMP] 2. VLAN name OID walk: 1.3.6.1.4.1.9.9.46.1.3.1.1.4`);
    logger.info(`[SNMP] NOTE: Each walk may return multiple batches of data; each batch will be processed separately`);
    
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
