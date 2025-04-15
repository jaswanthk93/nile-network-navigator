
import { discoverMacAddresses } from "./snmpDiscovery";
import { supabase } from "@/integrations/supabase/client";

interface MacAddressResult {
  macAddresses: Array<{
    id: string;
    macAddress: string;
    vlanId: number;
    segmentName: string;
    deviceType: string;
    port?: string;
    selected: boolean;
  }>;
  error: string | null;
}

/**
 * Fetch MAC addresses for a site using SNMP
 */
export async function fetchMacAddressesForSite(
  siteId: string,
  userId: string,
  progressCallback?: (message: string, progress: number) => void
): Promise<MacAddressResult> {
  try {
    console.log(`Fetching MAC addresses for site ${siteId}`);
    
    if (!siteId) {
      console.error("No site ID provided");
      return {
        macAddresses: [],
        error: "No site selected. Please select a site first."
      };
    }
    
    // Get the subnets for the selected site
    const { data: subnets, error: subnetsError } = await supabase
      .from('subnets')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false });
      
    if (subnetsError) {
      console.error("Error fetching subnets:", subnetsError);
      return {
        macAddresses: [],
        error: "Error fetching subnet information. Please try again."
      };
    }
    
    if (!subnets || subnets.length === 0) {
      console.error("No subnets found for site:", siteId);
      return {
        macAddresses: [],
        error: "No subnet information found. Please complete network discovery first."
      };
    }
    
    console.log(`Found ${subnets.length} subnets for site ${siteId}`);
    
    // Get the VLANs for the site
    const { data: vlans, error: vlansError } = await supabase
      .from('vlans')
      .select('*')
      .eq('site_id', siteId);
      
    if (vlansError) {
      console.error("Error fetching VLANs:", vlansError);
      return {
        macAddresses: [],
        error: "Error fetching VLAN information. Please try again."
      };
    }
    
    if (!vlans || vlans.length === 0) {
      console.error("No VLANs found for site:", siteId);
      return {
        macAddresses: [],
        error: "No VLANs found. Please discover VLANs first."
      };
    }
    
    console.log(`Found ${vlans.length} VLANs for site ${siteId}`);
    
    // Get switch devices from the database
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('*')
      .eq('site_id', siteId)
      .eq('category', 'Switch')
      .limit(1);
      
    if (devicesError) {
      console.error("Error fetching switch devices:", devicesError);
      return {
        macAddresses: [],
        error: "Error fetching switch devices. Please try again."
      };
    }
    
    if (!devices || devices.length === 0) {
      console.error("No switch devices found for site:", siteId);
      return {
        macAddresses: [],
        error: "No switch devices found. Please complete device discovery first."
      };
    }
    
    const switchIp = devices[0].ip_address;
    const subnet = subnets[0]; // Use the first subnet for SNMP credentials
    const community = subnet.snmp_community || 'public';
    const version = subnet.snmp_version || '2c';
    
    console.log(`Using switch ${switchIp} with community ${community} and version ${version}`);
    
    // Extract VLAN IDs from the database records
    const vlanIds = vlans.map(vlan => vlan.vlan_id);
    console.log(`Using VLAN IDs: ${vlanIds.join(', ')}`);
    
    // Get MAC addresses from the switch using our discoverMacAddresses function
    const macAddressResults = await discoverMacAddresses(
      switchIp,
      community,
      version,
      vlanIds,
      progressCallback
    );
    
    console.log(`Discovered ${macAddressResults.macAddresses.length} MAC addresses across ${macAddressResults.vlanIds.length} VLANs`);
    
    // Create a map of VLAN IDs to names from the database
    const vlanMap = new Map();
    vlans.forEach(vlan => {
      vlanMap.set(vlan.vlan_id, vlan.name || `VLAN ${vlan.vlan_id}`);
    });
    
    // Transform the MAC addresses into our format with unique IDs
    const transformedMacs = macAddressResults.macAddresses.map((mac, index) => ({
      id: `mac-${index}`,
      macAddress: mac.macAddress,
      vlanId: mac.vlanId,
      segmentName: vlanMap.get(mac.vlanId) || `VLAN ${mac.vlanId}`,
      deviceType: mac.deviceType || 'Unknown',
      port: mac.port || undefined,  // Handle the case when port is not available
      selected: true
    }));
    
    if (transformedMacs.length === 0) {
      return {
        macAddresses: [],
        error: "No MAC addresses found. The switch did not return any MAC address information."
      };
    }
    
    return {
      macAddresses: transformedMacs,
      error: null
    };
  } catch (error) {
    console.error("Error in fetchMacAddressesForSite:", error);
    return {
      macAddresses: [],
      error: error instanceof Error ? error.message : "An unexpected error occurred"
    };
  }
}
