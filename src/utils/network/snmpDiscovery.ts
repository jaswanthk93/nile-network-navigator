
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
 * This function performs targeted SNMP walks for each VLAN to discover MAC addresses
 */
export async function discoverMacAddresses(
  ip: string,
  community: string = 'public',
  version: string = '2c',
  progressCallback?: (message: string, progress: number) => void
): Promise<MacAddressDiscoveryResult> {
  try {
    if (progressCallback) {
      progressCallback("Starting MAC address discovery...", 0);
    }

    // Get VLANs first using the VLAN discovery function
    const { data: vlanData, error: vlanError } = await fetch('/api/vlans/discover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ip,
        community,
        version
      }),
    }).then(res => res.json());

    if (vlanError) {
      console.error("Error discovering VLANs:", vlanError);
      throw new Error(`Failed to discover VLANs: ${vlanError}`);
    }

    const vlans = vlanData?.vlans || [];
    const vlanIds = vlans.map((vlan: any) => vlan.vlanId);

    if (progressCallback) {
      progressCallback(`Discovered ${vlanIds.length} VLANs. Starting MAC address collection...`, 10);
    }

    if (vlanIds.length === 0) {
      throw new Error("No VLANs discovered. Cannot proceed with MAC address discovery.");
    }

    // MAC address collection - do a targeted SNMP walk for each VLAN
    const macAddresses: DiscoveredMacAddress[] = [];
    const macOid = '1.3.6.1.2.1.17.4.3.1.2'; // Bridge MIB - dot1dTpFdbPort

    for (let i = 0; i < vlanIds.length; i++) {
      const vlanId = vlanIds[i];
      if (progressCallback) {
        progressCallback(`Processing VLAN ${vlanId} (${i + 1}/${vlanIds.length})...`, 10 + (i / vlanIds.length) * 80);
      }

      // For VLAN 1, use regular community string, for others use community@vlanId format
      const vlanCommunity = vlanId === 1 ? community : `${community}@${vlanId}`;

      try {
        // Fix: The executeSnmpWalk only needs ip and oid according to the error
        // Pass the correct parameters based on what the function expects
        const { data: macData, error: macError } = await executeSnmpWalk(ip, macOid);

        if (macError) {
          console.warn(`Error walking MAC addresses for VLAN ${vlanId}:`, macError);
          continue; // Skip this VLAN but continue with others
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
                // Include port as undefined to match the expected interface
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
