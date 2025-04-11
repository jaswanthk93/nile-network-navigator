
import { DiscoveredVlan } from "../../types/network";
import { connectToSwitch } from "../deviceConnection";
import { executeCommands } from "../deviceConnection";
import { parseVlanOutput } from "./vlanParsing";
import { isValidVlanId } from "../networkValidation";
import { callBackendApi, disconnectSession, getDeviceHostname } from "../apiClient";

/**
 * Discover VLANs from a network switch using specified connection details
 */
export async function discoverVlans(
  ip: string,
  community: string = "public",
  version: "1" | "2c" | "3" = "2c",
  make: string = "Cisco"
): Promise<{
  vlans: DiscoveredVlan[];
  deviceHostname?: string;
  rawData?: {
    vlanState: { oid: string; value: string }[];
    vlanName: { oid: string; value: string }[];
    ipAddrIfIndex?: { oid: string; value: string; ipAddress: string; ifIndex: number }[];
    ipAddrNetMask?: { oid: string; value: string; ipAddress: string; subnet: string }[];
    ifDescr?: { oid: string; value: string; ifIndex: number; vlanId: number }[];
  };
}> {
  console.log(`Discovering VLANs from ${ip} via SNMP...`);
  
  try {
    // Get device hostname first
    let deviceHostname = null;
    try {
      deviceHostname = await getDeviceHostname(ip, community, version);
      console.log(`Using hostname for device: ${deviceHostname || 'Not available'}`);
    } catch (e) {
      console.warn(`Could not retrieve device hostname: ${e.message}`);
    }
    
    // Use the backend agent for VLAN discovery
    const result = await callBackendApi("/snmp/discover-vlans", {
      ip,
      community,
      version,
      make
    });
    
    if (!result.vlans || !Array.isArray(result.vlans)) {
      console.error("Invalid response format from VLAN discovery");
      return { vlans: [], rawData: { vlanState: [], vlanName: [] } };
    }
    
    // Log the raw VLAN IDs returned from backend for debugging
    console.log(`Raw VLAN IDs from backend: ${result.vlans.map((v: any) => v.vlanId).join(', ')}`);
    
    // Use hostname from backend response if available
    const deviceIdentifier = result.deviceHostname || deviceHostname || ip;
    console.log(`Using device identifier: ${deviceIdentifier}`);
    
    // Process VLAN data and handle duplicates
    const processedVlans = new Map<number, DiscoveredVlan>();
    
    // First, process all VLANs and filter out duplicates
    for (const vlan of result.vlans) {
      // Skip if not a valid VLAN ID
      if (!isValidVlanId(vlan.vlanId)) {
        console.warn(`Filtering out invalid VLAN ID: ${vlan.vlanId}`);
        continue;
      }
      
      // If we've already seen this VLAN ID, skip it
      if (processedVlans.has(vlan.vlanId)) {
        console.warn(`Skipping duplicate VLAN ID: ${vlan.vlanId}`);
        // Optionally merge data from duplicate entries
        const existingVlan = processedVlans.get(vlan.vlanId)!;
        
        // Merge usedBy arrays if available and not duplicates
        if (vlan.usedBy && Array.isArray(vlan.usedBy)) {
          const existingUsedBy = new Set(existingVlan.usedBy);
          vlan.usedBy.forEach(device => existingUsedBy.add(device));
          existingVlan.usedBy = Array.from(existingUsedBy);
        }
        
        continue;
      }
      
      // Add this VLAN to our processed map
      processedVlans.set(vlan.vlanId, {
        vlanId: vlan.vlanId,
        name: vlan.name,
        subnet: vlan.subnet,
        // Use hostname instead of IP address if available
        usedBy: Array.isArray(vlan.usedBy) && vlan.usedBy.length > 0 ? vlan.usedBy : [deviceIdentifier]
      });
    }
    
    // Convert the Map to an array and sort by VLAN ID
    const validVlans = Array.from(processedVlans.values()).sort((a, b) => a.vlanId - b.vlanId);
    
    // Log the final list of VLANs for clarity
    console.log(`Processed ${validVlans.length} valid VLANs, IDs: ${validVlans.map(v => v.vlanId).join(', ')}`);
    
    // Log subnet information if available
    const vlansWithSubnets = validVlans.filter(v => v.subnet).length;
    if (vlansWithSubnets > 0) {
      console.log(`Found subnet information for ${vlansWithSubnets} VLANs:`);
      validVlans.filter(v => v.subnet).forEach(v => {
        console.log(`VLAN ${v.vlanId} (${v.name}): ${v.subnet}`);
      });
    } else {
      console.log("No subnet information found for any VLANs");
    }
    
    // Log active vs inactive counts if available in the response
    if (result.activeCount !== undefined && result.inactiveCount !== undefined) {
      console.log(`Discovered ${validVlans.length} active VLANs from ${deviceIdentifier} (backend reported ignoring ${result.inactiveCount} inactive VLANs)`);
    } else {
      console.log(`Discovered ${validVlans.length} VLANs from ${deviceIdentifier}`);
    }
    
    if (validVlans.length > 4094) {
      console.error(`Found ${validVlans.length} VLANs which exceeds the maximum of 4094!`);
      // This shouldn't happen since the backend now enforces this, but just in case:
      return {
        vlans: validVlans.slice(0, 4094),
        deviceHostname: deviceIdentifier !== ip ? deviceIdentifier : undefined,
        rawData: result.rawData
      };
    }
    
    return {
      vlans: validVlans,
      deviceHostname: deviceIdentifier !== ip ? deviceIdentifier : undefined,
      rawData: result.rawData
    };
  } catch (error) {
    console.error("Error discovering VLANs:", error);
    return { vlans: [], rawData: { vlanState: [], vlanName: [] } };
  }
}
