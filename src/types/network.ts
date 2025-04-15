
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
 * Interface for discovered MAC address
 */
export interface DiscoveredMacAddress {
  macAddress: string;
  vlanId: number;
  deviceType: string;
  port?: string;
  selected?: boolean;
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
 * Interface for switch connection details
 */
export interface SwitchConnectionDetails {
  ip: string;
  community?: string;
  version?: "1" | "2c" | "3";
  username?: string;
  password?: string;
  method: "snmp" | "ssh" | "telnet";
  make?: string;
  model?: string;
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

/**
 * Interface for device data from database
 */
export interface DeviceData {
  id: string;
  ip_address: string;
  hostname: string | null;
  mac_address: string | null;
  make: string | null;
  model: string | null;
  category: string | null;
  status: string | null;
  site_id: string;
  subnet_id: string;
  user_id: string;
  created_at: string;
  last_seen: string;
  needs_verification: boolean | null;
  confirmed: boolean | null;
  sysdescr: string | null;  // Only use lowercase version to match database
}
