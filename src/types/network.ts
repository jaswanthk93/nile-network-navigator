
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

/**
 * Interface for subnet data from database
 */
export interface SubnetData {
  id: string;
  cidr: string;
  description: string | null;
  site_id: string;
  user_id: string;
  created_at: string;
  access_method: "snmp" | "ssh" | "telnet" | null;
  snmp_community: string | null;
  snmp_version: "1" | "2c" | "3" | null;
  username: string | null;
  password: string | null;
}
