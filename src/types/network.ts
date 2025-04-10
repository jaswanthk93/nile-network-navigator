
/**
 * Interface for discovered VLAN
 */
export interface DiscoveredVlan {
  vlanId: number;
  name: string;
  subnet?: string;
  usedBy: string[];
}
