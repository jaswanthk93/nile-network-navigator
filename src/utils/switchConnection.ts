
/**
 * This file re-exports the functionality from the refactored modules
 * for backward compatibility with existing code.
 */

// Re-export everything from our modular files
export { isValidVlanId } from './networkValidation';
export { 
  SwitchConnectionDetails,
  connectToSwitch,
  executeCommands
} from './deviceConnection';
export {
  executeSnmpQueries,
  executeSnmpWalk,
  disconnectSession
} from './apiClient';
export {
  getVlansFromSwitch,
  discoverVlans
} from './vlanDiscovery';
