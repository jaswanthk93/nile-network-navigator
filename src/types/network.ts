
/**
 * Interface for discovered VLAN
 */
export interface DiscoveredVlan {
  vlanId: number;
  name: string;
  subnet?: string;
  usedBy: string[];
}

/**
 * Interface for device deletion request
 */
export interface DeviceDeletionRequest {
  subnetId: string;
  userId: string;
}
