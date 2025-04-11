
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
    
    const deviceInfo = await deviceDiscovery.discoverDeviceInfo(ip, community, version);
    
    res.json({ 
      status: 'success',
      device: deviceInfo
    });
  } catch (error) {
    console.error('SNMP device discovery error:', error);
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
    
    logger.info(`VLAN discovery request received for ${ip} using SNMPv${version}`);
    
    const result = await vlanHandler.discoverVlans(ip, community, version, make);
    
    logger.info(`VLAN discovery completed for ${ip}: found ${result.vlans.length} valid VLANs`);
    
    res.json(result);
  } catch (error) {
    logger.error('SNMP VLAN discovery error:', error);
    res.status(500).json({ error: error.message });
  }
};
