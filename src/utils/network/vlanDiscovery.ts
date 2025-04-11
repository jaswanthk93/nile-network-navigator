
import { DiscoveredVlan } from "../../types/network";
import { connectToSwitch } from "../deviceConnection";
import { executeCommands } from "../deviceConnection";
import { parseVlanOutput } from "./vlanParsing";
import { isValidVlanId } from "../networkValidation";
import { callBackendApi, disconnectSession } from "../apiClient";

/**
 * Discover VLANs from a network switch using specified connection details
 */
export async function discoverVlans(
  ip: string,
  community: string = "public",
  version: "1" | "2c" | "3" = "2c",
  make: string = "Cisco"
): Promise<DiscoveredVlan[]> {
  console.log(`Discovering VLANs from ${ip} via SNMP...`);
  
  try {
    // Use the backend agent for VLAN discovery
    const result = await callBackendApi("/snmp/discover-vlans", {
      ip,
      community,
      version,
      make
    });
    
    if (!result.vlans || !Array.isArray(result.vlans)) {
      console.error("Invalid response format from VLAN discovery");
      return [];
    }
    
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
        usedBy: Array.isArray(vlan.usedBy) ? vlan.usedBy : [ip]
      });
    }
    
    // Convert the Map to an array
    const validVlans = Array.from(processedVlans.values());
    
    // Log active vs inactive counts if available in the response
    if (result.activeCount !== undefined && result.inactiveCount !== undefined) {
      console.log(`Discovered ${validVlans.length} active VLANs from ${ip} (backend reported ignoring ${result.inactiveCount} inactive VLANs)`);
    } else {
      console.log(`Discovered ${validVlans.length} VLANs from ${ip}`);
    }
    
    if (validVlans.length > 4094) {
      console.error(`Found ${validVlans.length} VLANs which exceeds the maximum of 4094!`);
      // This shouldn't happen since the backend now enforces this, but just in case:
      return validVlans.slice(0, 4094);
    }
    
    return validVlans;
  } catch (error) {
    console.error("Error discovering VLANs:", error);
    return [];
  }
}
