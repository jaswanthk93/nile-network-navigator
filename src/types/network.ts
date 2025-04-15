/**
 * Interface for discovered VLAN
 */
export interface DiscoveredVlan {
  vlanId: number;
  name: string;
  subnet?: string;
  usedBy: string[];
  deviceHostname?: string; // Add this field to store the actual device hostname
}

/**
 * Interface for discovered MAC address
 */
export interface DiscoveredMacAddress {
  macAddress: string;
  vlanId: number;
  deviceType?: string;
  port?: string;
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

/**
 * Interface for device discovery result
 */
export interface DeviceDiscoveryResult {
  ip_address: string;
  hostname?: string;
  mac_address?: string;
  macAddresses?: DiscoveredMacAddress[];
  sysName?: string;
  sysDescr?: string;
  make?: string;
  model?: string;
  category?: string;
  status?: string;
  confirmed?: boolean;
  needs_verification?: boolean;
}

/**
 * Interface for MAC address data from database
 */
export interface MacAddressData {
  id: string;
  mac_address: string;
  vlan_id: number;
  device_type: string | null;
  site_id: string;
  subnet_id: string;
  user_id: string;
  discovered_at: string;
  last_seen: string;
  is_active: boolean | null;
}
