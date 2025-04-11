
import { supabase } from "@/integrations/supabase/client";
import { DiscoveredVlan, SubnetData } from "../../types/network";
import { SwitchConnectionDetails } from "../deviceConnection";
import { getVlansFromSwitch } from "./deviceVlans";

/**
 * Discover VLANs from multiple network switches
 */
export async function discoverVlans(
  devices: any[], 
  progressCallback?: (message: string, progress: number) => void
): Promise<DiscoveredVlan[]> {
  const allVlans: DiscoveredVlan[] = [];
  const uniqueVlanIds = new Set<number>();
  
  // Filter devices to just get switches
  const switches = devices.filter(device => 
    device.category === 'Switch' || 
    (device.make && (
      device.make.toLowerCase().includes('cisco') || 
      device.make.toLowerCase().includes('juniper') || 
      device.make.toLowerCase().includes('hp') || 
      device.make.toLowerCase().includes('aruba')
    ))
  );
  
  if (switches.length === 0) {
    console.log("No switches found for VLAN discovery");
    return [];
  }
  
  // Get subnet information for credential lookup
  const subnetsResult = await supabase
    .from('subnets')
    .select('*');
    
  if (subnetsResult.error) {
    console.error("Error fetching subnet information:", subnetsResult.error);
    return [];
  }
  
  const subnets = subnetsResult.data as SubnetData[] || [];
  
  // Log discovery process
  console.log(`Starting VLAN discovery on ${switches.length} switches`);
  
  // Process each switch - limit to one switch for testing
  const primarySwitch = switches[0]; // Focus on the first switch only initially
  console.log(`Limiting VLAN discovery to primary switch: ${primarySwitch.hostname || primarySwitch.ip_address}`);
  
  if (progressCallback) {
    progressCallback(
      `Connecting to ${primarySwitch.hostname || primarySwitch.ip_address}...`, 
      10
    );
  }
  
  // Find subnet for this device to get credentials
  const subnet = subnets.find(s => {
    const [subnetBase, mask] = s.cidr.split('/');
    const ipParts = subnetBase.split('.');
    const deviceIpParts = primarySwitch.ip_address.split('.');
    
    // Basic check - just compare first three octets for a /24
    return (
      ipParts[0] === deviceIpParts[0] && 
      ipParts[1] === deviceIpParts[1] && 
      (mask === '24' ? ipParts[2] === deviceIpParts[2] : true)
    );
  });
  
  if (!subnet) {
    console.warn(`No subnet information found for ${primarySwitch.ip_address}`);
    return [];
  }
  
  // Get connection details from the subnet information
  const connectionDetails: SwitchConnectionDetails = {
    ip: primarySwitch.ip_address,
    method: subnet.access_method || 'snmp',
    make: primarySwitch.make || "Cisco", // Default to Cisco
    model: primarySwitch.model
  };
  
  // Set credentials based on access method
  if (connectionDetails.method === 'snmp') {
    connectionDetails.community = subnet.snmp_community || 'public';
    connectionDetails.version = subnet.snmp_version as "1" | "2c" | "3" || '2c';
  } else {
    connectionDetails.username = subnet.username || 'admin';
    connectionDetails.password = subnet.password || 'password';
  }
  
  try {
    console.log(`Discovering VLANs from ${primarySwitch.ip_address} (${primarySwitch.hostname || 'unknown'}) via ${connectionDetails.method}`);
    
    if (progressCallback) {
      progressCallback(
        `Retrieving VLAN data from ${primarySwitch.hostname || primarySwitch.ip_address}...`, 
        30
      );
    }
    
    const discoveredVlans = await getVlansFromSwitch(connectionDetails);
    console.log(`Found ${discoveredVlans.length} valid VLANs on ${primarySwitch.ip_address}`);
    
    if (progressCallback) {
      progressCallback(
        `Processing ${discoveredVlans.length} VLANs...`, 
        70
      );
    }
    
    // Add the discovered VLANs to our collection
    for (const vlan of discoveredVlans) {
      if (!uniqueVlanIds.has(vlan.vlanId)) {
        uniqueVlanIds.add(vlan.vlanId);
        
        // Add the current device to usedBy if not already present
        const deviceName = primarySwitch.hostname || primarySwitch.ip_address;
        if (!vlan.usedBy.includes(deviceName)) {
          vlan.usedBy.push(deviceName);
        }
        
        allVlans.push(vlan);
      }
    }
  } catch (error) {
    console.error(`Error discovering VLANs from ${primarySwitch.ip_address}:`, error);
  }
  
  if (progressCallback) {
    progressCallback("VLAN discovery complete", 100);
  }
  
  // Sort VLANs by ID for consistency
  const sortedVlans = allVlans.sort((a, b) => a.vlanId - b.vlanId);
  console.log(`VLAN discovery complete. Found ${sortedVlans.length} unique valid VLANs.`);
  return sortedVlans;
}
