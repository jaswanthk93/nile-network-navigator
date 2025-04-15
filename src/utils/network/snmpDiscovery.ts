import { DiscoveredMacAddress } from "@/types/network";
import { executeSnmpWalk, callBackendApi } from "@/utils/apiClient";

interface MacAddressDiscoveryResult {
  macAddresses: DiscoveredMacAddress[];
  vlanIds: number[];
}

/**
 * Get device information via SNMP
 * This is a simplified version that only returns basic device info
 */
export async function getDeviceInfoViaSNMP(
  ip: string,
  updateProgress?: (message: string, progress: number) => void,
  backendConnected: boolean = false
): Promise<any> {
  try {
    if (updateProgress) {
      updateProgress(`Getting SNMP information from ${ip}...`, 5);
    }

    // When backend is connected, use real SNMP discovery
    if (backendConnected) {
      console.log(`Discovering device info for ${ip} using backend API`);
      const { data, error } = await fetch('/api/devices/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ip,
          community: 'public',
          version: '2c'
        }),
      }).then(res => res.json());

      if (error) {
        console.error(`Error discovering device info for ${ip}:`, error);
        return { error };
      }

      if (updateProgress) {
        updateProgress(`Received SNMP information for ${ip}`, 10);
      }

      // Make sure to return the data in a consistent format
      const deviceInfo = {
        hostname: data?.device?.sysName || null,
        make: data?.device?.manufacturer || null,
        model: data?.device?.model || null,
        category: data?.device?.type || 'Unknown',
        sysDescr: data?.device?.sysDescr || null
      };
      
      console.log(`Device info discovered for ${ip}:`, deviceInfo);
      return deviceInfo;
    } else {
      // Simulated response for development without backend
      console.log(`[Simulated] Getting SNMP information for ${ip}`);
      return {
        hostname: `device-${ip.split('.').pop()}`,
        make: 'SimulatedDevice',
        model: 'DevSim2000',
        category: 'Switch',
        sysDescr: 'Simulated device for development'
      };
    }
  } catch (error) {
    console.error(`Error in getDeviceInfoViaSNMP for ${ip}:`, error);
    return { error };
  }
}

/**
 * Discover MAC addresses on a switch using SNMP
 * Using a step-by-step approach with sorted VLANs
 */
export async function discoverMacAddresses(
  ip: string,
  community: string = 'public',
  version: string = '2c',
  vlanIds: number[] = [],
  progressCallback?: (message: string, progress: number) => void
): Promise<MacAddressDiscoveryResult> {
  try {
    if (progressCallback) {
      progressCallback("Starting MAC address discovery...", 0);
    }

    // Ensure we use sorted VLANs and log details
    const sortedVlanIds = [...new Set(vlanIds)].sort((a, b) => a - b);
    console.log(`Starting MAC address discovery with ${sortedVlanIds.length} unique VLANs in ascending order: ${sortedVlanIds.join(', ')}`);
    
    if (progressCallback) {
      progressCallback(`Using ${sortedVlanIds.length} VLANs for MAC address discovery...`, 10);
    }

    try {
      // Call backend API directly with detailed logging
      console.log(`Calling backend API for MAC address discovery with sorted VLANs: ${sortedVlanIds.join(', ')}`);
      
      const endpoint = "/snmp/discover-mac-addresses";
      console.log(`Full endpoint URL: ${import.meta.env.VITE_BACKEND_URL || "http://localhost:3001/api"}${endpoint}`);
      
      const requestData = {
        ip,
        community,
        version,
        vlanIds: sortedVlanIds
      };
      
      console.log(`Request data for MAC discovery:`, JSON.stringify(requestData, null, 2));
      
      if (progressCallback) {
        progressCallback(`Sending request to backend for MAC address discovery...`, 30);
      }
      
      const result = await callBackendApi<MacAddressDiscoveryResult>(endpoint, requestData);
      
      if (progressCallback) {
        progressCallback(`MAC address discovery complete. Found ${result.macAddresses?.length || 0} MAC addresses.`, 100);
      }
      
      console.log(`MAC address discovery complete. Found ${result.macAddresses?.length || 0} MAC addresses across ${result.vlanIds?.length || 0} VLANs.`);
      
      if (result.macAddresses?.length > 0) {
        // Log a sample of discovered MAC addresses (up to 5)
        const sampleMacs = result.macAddresses.slice(0, 5);
        console.log(`Sample of discovered MAC addresses:`, sampleMacs);
        
        // Log counts by VLAN
        const macsByVlan = new Map<number, number>();
        result.macAddresses.forEach(mac => {
          const count = macsByVlan.get(mac.vlanId) || 0;
          macsByVlan.set(mac.vlanId, count + 1);
        });
        
        console.log(`MAC addresses by VLAN:`);
        macsByVlan.forEach((count, vlanId) => {
          console.log(`VLAN ${vlanId}: ${count} MAC addresses`);
        });
      } else {
        console.warn("No MAC addresses were discovered. This could indicate a problem with the SNMP configuration or permissions.");
      }
      
      // Ensure we return a properly formatted result
      return {
        macAddresses: result.macAddresses || [],
        vlanIds: result.vlanIds || sortedVlanIds
      };
    } catch (error) {
      console.error("Error in MAC address discovery:", error);
      if (progressCallback) {
        progressCallback(`Error during MAC address discovery: ${error instanceof Error ? error.message : String(error)}`, 100);
      }
      throw error;
    }
  } catch (error) {
    console.error("Error in discoverMacAddresses:", error);
    throw error;
  }
}

/**
 * Try to determine device type from MAC address OUI
 */
function getMacDeviceType(mac: string): string {
  // Extract OUI (first 3 bytes of MAC)
  const oui = mac.split(':').slice(0, 3).join(':').toUpperCase();
  
  // This would ideally be a lookup against an OUI database
  // For demo purposes, just assigning random types based on hash
  const types = ['Desktop', 'Mobile', 'IoT', 'Server', 'Network'];
  const hash = oui.split(':').reduce((acc, val) => acc + parseInt(val, 16), 0);
  
  return types[hash % types.length];
}
