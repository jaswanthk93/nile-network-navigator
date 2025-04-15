
/**
 * This file re-exports the functionality from the refactored modules
 * for backward compatibility with existing code.
 */

// Re-export everything from our modular files
export { isValidVlanId } from './networkValidation';
export { 
  connectToSwitch,
  executeCommands
} from './deviceConnection';
// Re-export the type properly
export type { SwitchConnectionDetails } from '../types/network';
export {
  executeSnmpQueries,
  executeSnmpWalk,
  disconnectSession,
  discoverMacAddressesWithSNMP
} from './apiClient';
export {
  getVlansFromSwitch
} from './network/deviceVlans';
export {
  discoverVlans
} from './network/vlanDiscovery';
export {
  discoverMacAddresses
} from './network/snmpDiscovery';
