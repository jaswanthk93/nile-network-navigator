
/**
 * SNMP Discovery utilities for device information retrieval
 */

import { discoverDeviceWithSNMP } from "@/utils/apiClient";

/**
 * Use SNMP to get device information
 */
export async function getDeviceInfoViaSNMP(
  ipAddress: string, 
  updateProgress: (message: string, progress: number) => void,
  useBackendConnection: boolean
): Promise<{
  hostname: string | null;
  make: string | null;
  model: string | null;
  category: string | null;
  sysDescr?: string | null;
  error?: string;
}> {
  try {
    updateProgress(`Retrieving SNMP information from ${ipAddress}...`, 1);
    
    // If backend connection is required but not available, throw an error
    if (!useBackendConnection) {
      throw new Error("Backend connection required for SNMP operations");
    }
    
    // Use backend connection for real SNMP data
    try {
      // Call the dedicated device discovery endpoint
      const deviceInfo = await discoverDeviceWithSNMP(ipAddress);
      
      if (!deviceInfo) {
        throw new Error("No device information returned from SNMP discovery");
      }
      
      console.log("SNMP device discovery result:", deviceInfo);
      updateProgress(`SNMP information retrieved from ${ipAddress}`, 3);
      
      return {
        hostname: deviceInfo.sysName || null,
        make: deviceInfo.manufacturer || null,
        model: deviceInfo.model || null,
        category: deviceInfo.type || null,
        sysDescr: deviceInfo.sysDescr || null
      };
    } catch (err) {
      console.error("Error performing SNMP device discovery:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown SNMP query error";
      return {
        hostname: null,
        make: null,
        model: null,
        category: null,
        error: errorMessage
      };
    }
  } catch (error) {
    console.error(`Error getting SNMP info from ${ipAddress}:`, error);
    return {
      hostname: null,
      make: null,
      model: null,
      category: null,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
