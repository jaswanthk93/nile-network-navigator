
import { DiscoveredVlan } from "@/types/network";
import { discoverVlans } from "./vlanDiscovery";
import { callBackendApi } from "../apiClient";

export async function getVlansFromSwitch(
  ip: string,
  community: string = "public",
  version: "1" | "2c" | "3" = "2c",
  make: string = "Cisco"
): Promise<DiscoveredVlan[]> {
  try {
    console.log(`Getting VLANs from switch ${ip}...`);
    
    // First, get the hostname of the device using SNMP sysName
    let hostname = await getDeviceHostname(ip, community, version);
    
    // If hostname retrieval fails, use IP address as fallback
    const deviceIdentifier = hostname || ip;
    console.log(`Device identifier: ${deviceIdentifier} (${ip})`);
    
    const result = await discoverVlans(ip, community, version, make);
    
    if (result.vlans && result.vlans.length > 0) {
      console.log(`Successfully retrieved ${result.vlans.length} VLANs from ${deviceIdentifier}`);
      
      // Log how many VLANs have subnet information
      const vlansWithSubnets = result.vlans.filter(v => v.subnet).length;
      if (vlansWithSubnets > 0) {
        console.log(`${vlansWithSubnets} VLANs have subnet information`);
      }
      
      // Update the usedBy array to use the hostname instead of IP
      result.vlans = result.vlans.map(vlan => ({
        ...vlan,
        usedBy: hostname ? [hostname] : [ip]
      }));
      
      return result.vlans;
    } else {
      console.warn(`No VLANs found on ${deviceIdentifier}`);
      return [];
    }
  } catch (error) {
    console.error(`Error getting VLANs from ${ip}:`, error);
    throw error;
  }
}

/**
 * Get the hostname of a device using SNMP sysName
 */
async function getDeviceHostname(
  ip: string, 
  community: string = "public", 
  version: "1" | "2c" | "3" = "2c"
): Promise<string | null> {
  try {
    console.log(`Getting hostname for device ${ip} using SNMP sysName...`);
    
    // Call the backend API to execute the SNMP walk for sysName
    const result = await callBackendApi("/snmp/get", {
      ip,
      community,
      version,
      oids: ["1.3.6.1.2.1.1.5.0"] // sysName OID
    });
    
    if (result && result.results && result.results["1.3.6.1.2.1.1.5.0"]) {
      const fullHostname = result.results["1.3.6.1.2.1.1.5.0"];
      console.log(`Full hostname from SNMP: ${fullHostname}`);
      
      // Extract the hostname part before the domain
      const hostname = fullHostname.split('.')[0];
      console.log(`Using device hostname: ${hostname}`);
      return hostname;
    }
    
    console.warn(`No hostname found for ${ip}, using IP address instead`);
    return null;
  } catch (error) {
    console.error(`Error getting hostname for ${ip}:`, error);
    return null;
  }
}
