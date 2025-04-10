
/**
 * This file has been refactored into multiple smaller files.
 * It now re-exports all the functionality from the new structure
 * for backward compatibility with existing code.
 * 
 * New code should import directly from the utils/network directory.
 */

// Re-export everything from the new modules
export * from './network/discovery';
export * from './network/ipUtils';
export * from './network/deviceIdentification';
export * from './network/subnets';

// Re-export the main functionality from the discovery module
import { discoverDevicesInSubnet } from './network/discovery';
import { saveDiscoveredDevices } from './network/subnets';
export { discoverDevicesInSubnet, saveDiscoveredDevices };

// Log a deprecation warning when this file is imported
console.warn(
  'The networkDiscovery.ts file has been refactored into smaller modules. ' +
  'Please import from utils/network/* directly in new code.'
);
