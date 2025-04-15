
import { DiscoveredVlan } from "@/types/network";
import { supabase } from "@/integrations/supabase/client";
import { discoverVlans } from "./vlanDiscovery";

/**
 * Get VLANs from a switch and save them to the database
 */
export async function getVlansFromSwitch(
  ip: string,
  community: string = "public",
  version: "1" | "2c" | "3" = "2c",
  siteId: string,
  userId: string,
  updateProgress?: (message: string, progress: number) => void
): Promise<DiscoveredVlan[]> {
  try {
    console.log(`Getting VLANs from switch ${ip} for site ${siteId}...`);
    
    if (updateProgress) {
      updateProgress("Discovering VLANs via SNMP...", 10);
    }
    
    // Discover VLANs from the switch
    const { vlans, deviceHostname } = await discoverVlans(ip, community, version);
    
    if (updateProgress) {
      updateProgress(`Discovered ${vlans.length} VLANs, saving to database...`, 50);
    }
    
    console.log(`Discovered ${vlans.length} VLANs from ${ip}, device hostname: ${deviceHostname || 'unknown'}`);
    
    // First delete any existing VLANs for this site
    const { error: deleteError } = await supabase
      .from('vlans')
      .delete()
      .eq('site_id', siteId);
      
    if (deleteError) {
      console.error("Error deleting existing VLANs:", deleteError);
    }
    
    // Save the new VLANs to the database with device hostname in the description field
    const vlansToInsert = vlans.map(vlan => ({
      site_id: siteId,
      user_id: userId,
      vlan_id: vlan.vlanId,
      name: vlan.name || `VLAN ${vlan.vlanId}`,
      description: vlan.deviceHostname || deviceHostname || undefined
    }));
    
    console.log(`Saving ${vlansToInsert.length} VLANs to database with site ID ${siteId}...`);
    
    const { error: insertError } = await supabase
      .from('vlans')
      .insert(vlansToInsert);
      
    if (insertError) {
      console.error("Error inserting VLANs:", insertError);
      throw new Error(`Failed to save VLANs to database: ${insertError.message}`);
    }
    
    // Also update any existing devices with the discovered hostname if it's a switch
    if (deviceHostname) {
      console.log(`Updating any existing Switch devices with hostname ${deviceHostname} for IP ${ip}`);
      
      // First get the existing device record to preserve any user-defined settings
      const { data: existingDevice, error: getDeviceError } = await supabase
        .from('devices')
        .select('*')
        .eq('ip_address', ip)
        .eq('site_id', siteId)
        .eq('category', 'Switch')
        .single();
        
      if (getDeviceError && getDeviceError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error("Error getting existing device:", getDeviceError);
      }
      
      const updatePayload: {
        hostname: string;
        needs_verification: boolean;
        confirmed: boolean;
        sysdescr?: string;
      } = {
        hostname: deviceHostname, // Always use the SNMP-discovered hostname
        needs_verification: false,
        confirmed: true
      };
      
      // If we have an existing device with sysDescr, make sure to preserve it
      if (existingDevice?.sysdescr) {
        console.log(`Preserving existing sysDescr for device at ${ip}`);
        updatePayload.sysdescr = existingDevice.sysdescr;
      }
      
      const { error: updateDeviceError } = await supabase
        .from('devices')
        .update(updatePayload)
        .eq('ip_address', ip)
        .eq('site_id', siteId)
        .eq('category', 'Switch');
      
      if (updateDeviceError) {
        console.error("Error updating device hostname:", updateDeviceError);
      } else {
        console.log(`Successfully updated hostname for switch at ${ip} to ${deviceHostname}`);
      }
    }
    
    if (updateProgress) {
      updateProgress(`Saved ${vlans.length} VLANs to database`, 100);
    }
    
    console.log(`Successfully saved ${vlans.length} VLANs to database for site ${siteId}`);
    
    return vlans;
  } catch (error) {
    console.error("Error in getVlansFromSwitch:", error);
    throw error;
  }
}
