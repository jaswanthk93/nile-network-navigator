
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
    
    // Double-check to ensure frontend also enforces the valid VLAN ID range
    const validVlans = result.vlans.filter((vlan: any) => 
      isValidVlanId(vlan.vlanId)
    );
    
    if (result.vlans.length !== validVlans.length) {
      console.warn(`Additional filtering removed ${result.vlans.length - validVlans.length} invalid VLANs on frontend`);
    }
    
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
