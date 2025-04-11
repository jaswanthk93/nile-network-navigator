
/**
 * This file re-exports the functionality from the refactored modules
 * for backward compatibility with existing code.
 */

// Re-export everything from our modular files
export { isValidVlanId } from './networkValidation';
export { 
  connectToSwitch,
  executeCommands,
  type SwitchConnectionDetails
} from './deviceConnection';
export {
  executeSnmpQueries,
  executeSnmpWalk,
  disconnectSession
} from './apiClient';
export {
  getVlansFromSwitch
} from './network/deviceVlans';
export {
  discoverVlans
} from './network/vlanDiscovery';
