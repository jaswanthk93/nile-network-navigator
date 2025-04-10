
// Constants for VLAN validation
export const MIN_VLAN_ID = 1;
export const MAX_VLAN_ID = 4094;

/**
 * Helper function to validate VLAN IDs
 */
export function isValidVlanId(vlanId: number): boolean {
  return vlanId >= MIN_VLAN_ID && vlanId <= MAX_VLAN_ID;
}
