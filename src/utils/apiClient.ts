
import { DiscoveredVlan } from "../types/network";
import { toast } from "@/hooks/use-toast";

// Configuration for the agent
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001/api"; // Use env var if available
const DEFAULT_TIMEOUT = 10000; // 10 seconds default timeout

/**
 * Handles API requests to the backend agent with timeout
 */
export async function callBackendApi<T = any>(endpoint: string, data: any, timeout: number = DEFAULT_TIMEOUT): Promise<T> {
  try {
    console.log(`Calling backend API: ${endpoint} with data:`, data);
    console.log(`Using timeout of ${timeout}ms for this request`);
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.error(`Request timeout after ${timeout/1000}s when calling ${endpoint}`);
    }, timeout);
    
    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId); // Clear the timeout
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error (${response.status}) for ${endpoint}: ${errorText}`);
      throw new Error(`API error (${response.status}): ${errorText}`);
    }
    
    // Check the content type to avoid parsing HTML as JSON
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const result = await response.json();
      console.log(`Backend API response from ${endpoint}:`, result);
      return result;
    } else {
      // Handle non-JSON responses
      const text = await response.text();
      
      // Check if it's HTML (which would cause the JSON parse error)
      if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
        console.error(`Received HTML instead of JSON from ${endpoint}. Response:`, text.substring(0, 200));
        throw new Error(`Received HTML response instead of JSON from ${endpoint}. This likely indicates a server routing issue or redirection.`);
      }
      
      // For other text responses, try to parse as JSON if possible
      try {
        const result = JSON.parse(text);
        console.log(`Backend API response from ${endpoint}:`, result);
        return result;
      } catch (parseError) {
        console.error(`Response is not valid JSON from ${endpoint}:`, text);
        throw new Error(`Invalid JSON response from ${endpoint}: ${text.substring(0, 100)}...`);
      }
    }
  } catch (error) {
    // Handle AbortController timeout
    if (error.name === 'AbortError') {
      console.error(`Timeout after ${timeout/1000}s when calling ${endpoint}`);
      throw new Error(`Request timed out after ${timeout/1000} seconds. The operation was taking too long to complete.`);
    }
    
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
 * Updated to handle HTML responses and provide better error logging
 */
export async function executeSnmpWalk(
  deviceIp: string,
  oid: string
): Promise<any> {
  try {
    console.log(`Executing SNMP WALK on device ${deviceIp} for OID ${oid}...`);
    
    const response = await fetch(`${BACKEND_URL}/snmp/walk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ip: deviceIp,
        oid
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`SNMP walk error (${response.status}): ${errorText}`);
      return { error: `API error (${response.status}): ${errorText}` };
    }
    
    // Check content type to avoid HTML parsing errors
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const result = await response.json();
      console.log(`SNMP walk response for ${deviceIp} and OID ${oid}:`, result);
      return result;
    } else {
      const text = await response.text();
      console.error(`Received non-JSON response from SNMP walk:`, text.substring(0, 200));
      
      // Check if it's HTML
      if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
        return { error: "Received HTML instead of JSON from SNMP walk. This likely indicates a server issue or network routing problem." };
      }
      
      // Try to parse as JSON anyway
      try {
        const result = JSON.parse(text);
        return result;
      } catch (parseError) {
        return { error: `Invalid response format: ${text.substring(0, 100)}...` };
      }
    }
  } catch (error) {
    console.error("Error executing SNMP WALK:", error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Discover MAC addresses on a switch using SNMP
 * Updated to handle detailed error reporting and improve logging
 */
export async function discoverMacAddressesWithSNMP(
  deviceIp: string,
  community: string = 'public',
  version: string = '2c',
  vlanIds?: number[]
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
    
    const requestData: any = {
      ip: deviceIp,
      community,
      version
    };
    
    // If specific VLAN IDs are provided, include them in the request
    if (vlanIds && vlanIds.length > 0) {
      console.log(`Using specific VLANs for MAC discovery: ${vlanIds.join(', ')}`);
      requestData.vlanIds = vlanIds;
    }
    
    const result = await callBackendApi("/snmp/discover-mac-addresses", requestData);
    
    // Log the complete response for debugging
    console.log(`MAC address discovery response:`, JSON.stringify(result, null, 2));
    
    if (!result.macAddresses || !Array.isArray(result.macAddresses)) {
      console.error(`Invalid MAC address response format:`, result);
      return {
        macAddresses: [],
        vlanIds: vlanIds || []
      };
    }
    
    // Log detailed information about the discovered MAC addresses
    console.log(`Successfully discovered ${result.macAddresses.length} MAC addresses`);
    if (result.macAddresses.length > 0) {
      console.log(`Sample MAC address entry:`, result.macAddresses[0]);
    }
    
    return {
      macAddresses: result.macAddresses || [],
      vlanIds: result.vlanIds || vlanIds || []
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
