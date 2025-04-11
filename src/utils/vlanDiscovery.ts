
/**
 * This file re-exports VLAN discovery functionality from the refactored modules
 * for backward compatibility with existing code.
 */

// Re-export from the network modules
export { getVlansFromSwitch } from './network/deviceVlans';
export { discoverVlans } from './network/vlanDiscovery';
export { parseVlanOutput } from './network/vlanParsing';
