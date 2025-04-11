import { DiscoveredVlan } from "@/types/network";
import { discoverVlans } from "./vlanDiscovery";

export async function getVlansFromSwitch(
  ip: string,
  community: string = "public",
  version: "1" | "2c" | "3" = "2c",
  make: string = "Cisco"
): Promise<DiscoveredVlan[]> {
  try {
    console.log(`Getting VLANs from switch ${ip}...`);
    const result = await discoverVlans(ip, community, version, make);
    
    if (result.vlans && result.vlans.length > 0) {
      console.log(`Successfully retrieved ${result.vlans.length} VLANs from ${ip}`);
      
      // Log how many VLANs have subnet information
      const vlansWithSubnets = result.vlans.filter(v => v.subnet).length;
      if (vlansWithSubnets > 0) {
        console.log(`${vlansWithSubnets} VLANs have subnet information`);
      }
      
      return result.vlans;
    } else {
      console.warn(`No VLANs found on ${ip}`);
      return [];
    }
  } catch (error) {
    console.error(`Error getting VLANs from ${ip}:`, error);
    throw error;
  }
}
