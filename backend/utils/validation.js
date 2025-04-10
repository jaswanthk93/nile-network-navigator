
// Constants for VLAN validation
const MIN_VLAN_ID = 1;
const MAX_VLAN_ID = 4094;

/**
 * Validate VLAN IDs
 * @param {number} vlanId - The VLAN ID to validate
 * @returns {boolean} - True if valid, false otherwise
 */
exports.isValidVlanId = (vlanId) => {
  return vlanId >= MIN_VLAN_ID && vlanId <= MAX_VLAN_ID;
};

/**
 * Validate IP address format
 * @param {string} ip - The IP address to validate
 * @returns {boolean} - True if valid, false otherwise
 */
exports.isValidIpAddress = (ip) => {
  const ipPattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipPattern.test(ip);
};

/**
 * Validate SNMP community string
 * @param {string} community - The community string to validate
 * @returns {boolean} - True if valid, false otherwise
 */
exports.isValidCommunity = (community) => {
  return typeof community === 'string' && community.length > 0;
};

/**
 * Validate SNMP version
 * @param {string} version - The SNMP version to validate
 * @returns {boolean} - True if valid, false otherwise
 */
exports.isValidSnmpVersion = (version) => {
  return version === '1' || version === '2c' || version === '3';
};
