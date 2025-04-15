import { DiscoveredMacAddress } from "@/types/network";
import { executeSnmpWalk } from "@/utils/apiClient";

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

      return {
        hostname: data?.device?.sysName || null,
        make: data?.device?.manufacturer || null,
        model: data?.device?.model || null,
        category: data?.device?.type || 'Unknown',
        sysDescr: data?.device?.sysDescr || null
      };
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
 * This function uses VLANs retrieved from the database to perform targeted SNMP walks
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

    // If no VLANs are provided, log a warning but try to continue with default VLAN 1
    if (!vlanIds || vlanIds.length === 0) {
      console.warn("No VLANs provided for MAC address discovery. Will use default VLAN 1.");
      vlanIds = [1];
    }

    console.log(`Starting MAC address discovery with ${vlanIds.length} VLANs: ${vlanIds.join(', ')}`);
    
    if (progressCallback) {
      progressCallback(`Using ${vlanIds.length} VLANs for MAC address discovery...`, 10);
    }

    // MAC address collection - do a targeted SNMP walk for each VLAN
    const macAddresses: DiscoveredMacAddress[] = [];
    const macOid = '1.3.6.1.2.1.17.4.3.1.2'; // Bridge MIB - dot1dTpFdbPort

    for (let i = 0; i < vlanIds.length; i++) {
      const vlanId = vlanIds[i];
      if (progressCallback) {
        progressCallback(`Processing VLAN ${vlanId} (${i + 1}/${vlanIds.length})...`, 10 + (i / vlanIds.length) * 80);
      }

      console.log(`Processing VLAN ${vlanId} (${i + 1}/${vlanIds.length})...`);

      // For VLAN 1, use regular community string, for others use community@vlanId format
      const vlanCommunity = vlanId === 1 ? community : `${community}@${vlanId}`;

      try {
        console.log(`Executing SNMP walk for VLAN ${vlanId} with OID ${macOid} and community string ${vlanCommunity}`);
        
        // Call our backend API directly to avoid potential redirection issues
        const response = await fetch('/api/snmp/walk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ip,
            oid: macOid,
            community: vlanCommunity,
            version
          }),
        });
        
        // Check if the response is successful
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`SNMP walk failed for VLAN ${vlanId}: ${errorText}`);
          continue; // Skip this VLAN but try the others
        }
        
        // Check if the response is JSON
        const contentType = response.headers.get("content-type");
        let macData;
        
        if (contentType && contentType.includes("application/json")) {
          macData = await response.json();
        } else {
          const textResponse = await response.text();
          console.error(`Received non-JSON response for VLAN ${vlanId}:`, textResponse);
          
          // Check if it's HTML and log a more specific error
          if (textResponse.trim().startsWith("<!DOCTYPE") || textResponse.trim().startsWith("<html")) {
            console.error(`Received HTML instead of JSON. This likely indicates a server issue or redirection.`);
          }
          
          continue; // Skip this VLAN but try the others
        }

        if (!macData || !macData.results) {
          console.warn(`No MAC addresses found for VLAN ${vlanId}`);
          continue;
        }

        // Process the results - extract MAC addresses from the OID
        for (const result of macData.results) {
          try {
            const oidParts = result.oid.split('.');
            // Check if we have the expected OID pattern
            if (oidParts.length >= 6) {
              // Extract the MAC address from the OID parts (last 6 parts)
              const macParts = oidParts.slice(-6);
              const mac = macParts.map(part => {
                const hex = parseInt(part).toString(16).toUpperCase();
                return hex.length === 1 ? `0${hex}` : hex;
              }).join(':');

              // Add MAC address to our list with VLAN ID
              macAddresses.push({
                macAddress: mac,
                vlanId: vlanId,
                deviceType: getMacDeviceType(mac),
                port: undefined 
              });
            }
          } catch (err) {
            console.warn(`Error processing MAC result: ${err}`);
          }
        }
      } catch (error) {
        console.warn(`Failed to query VLAN ${vlanId}:`, error);
      }
    }

    if (progressCallback) {
      progressCallback(`MAC address discovery complete. Found ${macAddresses.length} MAC addresses.`, 100);
    }

    console.log(`MAC address discovery complete. Found ${macAddresses.length} MAC addresses.`);
    
    return {
      macAddresses,
      vlanIds
    };
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
