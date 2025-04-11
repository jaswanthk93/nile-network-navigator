
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
    
    // Filter out any invalid VLANs for safety
    const validVlans = result.vlans.filter((vlan: any) => 
      isValidVlanId(vlan.vlanId)
    );
    
    if (result.vlans.length !== validVlans.length) {
      console.warn(`Filtered out ${result.vlans.length - validVlans.length} invalid VLANs`);
    }
    
    console.log(`Discovered ${validVlans.length} VLANs from ${ip}`);
    return validVlans;
  } catch (error) {
    console.error("Error discovering VLANs:", error);
    return [];
  }
}
