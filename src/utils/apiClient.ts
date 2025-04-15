
import { DiscoveredVlan } from "../types/network";

// Configuration for the agent
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001/api"; // Use env var if available

/**
 * Handles API requests to the backend agent
 */
export async function callBackendApi<T = any>(endpoint: string, data: any): Promise<T> {
  try {
    console.log(`Calling backend API: ${endpoint} with data:`, data);
    
    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`Backend API response from ${endpoint}:`, result);
    return result;
  } catch (error) {
    console.error(`Error calling ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Discover device information using SNMP system description
 */
export async function discoverDeviceWithSNMP(
  deviceIp: string,
  community: string = 'public',
  version: string = '2c'
): Promise<any> {
  try {
    console.log(`Discovering device info for ${deviceIp} using SNMP...`);
    
    const result = await callBackendApi("/snmp/discoverDevice", {
      ip: deviceIp,
      community,
      version
    });
    
    return result.device || null;
  } catch (error) {
    console.error("Error discovering device with SNMP:", error);
    throw error;
  }
}

/**
 * Get the hostname of a device using SNMP sysName
 */
export async function getDeviceHostname(
  deviceIp: string,
  community: string = 'public',
  version: string = '2c'
): Promise<string | null> {
  try {
    console.log(`Getting hostname for ${deviceIp} using SNMP sysName...`);
    
    const result = await callBackendApi("/snmp/get", {
      ip: deviceIp,
      community,
      version,
      oids: ["1.3.6.1.2.1.1.5.0"] // sysName OID
    });
    
    if (result && result.results && result.results["1.3.6.1.2.1.1.5.0"]) {
      // Extract the hostname part before the domain
      const fullHostname = result.results["1.3.6.1.2.1.1.5.0"];
      const hostname = fullHostname.split('.')[0];
      console.log(`Device hostname: ${hostname} (from ${fullHostname})`);
      return hostname;
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting hostname for ${deviceIp}:`, error);
    return null;
  }
}

/**
 * Execute SNMP queries on a connected switch
 */
export async function executeSnmpQueries(
  sessionId: string,
  oids: string[]
): Promise<Record<string, any> | null> {
  try {
    console.log(`Executing SNMP queries on session ${sessionId}...`);
    
    const result = await callBackendApi("/snmp/get", {
      sessionId,
      oids
    });
    
    return result.results;
  } catch (error) {
    console.error("Error executing SNMP queries:", error);
    return null;
  }
}

/**
 * Execute SNMP WALK on a connected switch
 * Updated to match the usage in snmpDiscovery.ts
 */
export async function executeSnmpWalk(
  deviceIp: string,
  oid: string
): Promise<any> {
  try {
    console.log(`Executing SNMP WALK on device ${deviceIp} for OID ${oid}...`);
    
    const result = await callBackendApi("/snmp/walk", {
      ip: deviceIp,
      oid
    });
    
    return result;
  } catch (error) {
    console.error("Error executing SNMP WALK:", error);
    return { error };
  }
}

/**
 * Discover MAC addresses on a switch using SNMP
 */
export async function discoverMacAddressesWithSNMP(
  deviceIp: string,
  community: string = 'public',
  version: string = '2c',
  vlanId?: number
): Promise<{
  macAddresses: Array<{
    macAddress: string;
    vlanId: number;
    deviceType: string;
  }>;
  vlanIds: number[];
}> {
  try {
    console.log(`Discovering MAC addresses for ${deviceIp} using SNMP...`);
    
    const result = await callBackendApi("/snmp/discover-mac-addresses", {
      ip: deviceIp,
      community,
      version,
      vlanId
    });
    
    return {
      macAddresses: result.macAddresses || [],
      vlanIds: result.vlanIds || []
    };
  } catch (error) {
    console.error("Error discovering MAC addresses with SNMP:", error);
    throw error;
  }
}

/**
 * Disconnect a session (SSH/Telnet)
 */
export async function disconnectSession(
  sessionId: string,
  method: "ssh" | "telnet"
): Promise<boolean> {
  try {
    const endpoint = `/${method}/disconnect`;
    await callBackendApi(endpoint, {
      sessionId
    });
    return true;
  } catch (error) {
    console.error(`Error disconnecting ${method} session:`, error);
    return false;
  }
}
