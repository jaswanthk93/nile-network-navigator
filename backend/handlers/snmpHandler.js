
/**
 * This file re-exports functionality from the refactored modules
 * for backward compatibility with existing code.
 */

const connectionHandler = require('./snmp/connectionHandler');
const queryHandler = require('./snmp/queryHandler');
const discoveryHandler = require('./snmp/discoveryHandler');
const healthHandler = require('./snmp/healthHandler');
const macAddressHandler = require('./snmp/macAddressHandler');

// Re-export functionality from refactored modules
exports.connect = connectionHandler.connect;
exports.get = queryHandler.get;
exports.walk = queryHandler.walk;
exports.discoverDevice = discoveryHandler.discoverDevice;
exports.discoverVlans = discoveryHandler.discoverVlans;
exports.health = healthHandler.health;
exports.getSessionCount = connectionHandler.getSessionCount;
exports.discoverMacAddresses = macAddressHandler.discoverMacAddresses;
