
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

/**
 * Interface for SNMP connection details
 */
export interface SnmpConnectionDetails {
  community: string;
  version: "1" | "2c" | "3";
  port?: number;
}

/**
 * Interface for subnet access configuration
 */
export interface SubnetAccess {
  accessMethod: "snmp" | "ssh" | "telnet";
  snmpConfig?: SnmpConnectionDetails;
  credentials?: {
    username: string;
    password: string;
  };
}
