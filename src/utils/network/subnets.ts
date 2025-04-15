
import { supabase } from "@/integrations/supabase/client";
import { SubnetData, DiscoveredMacAddress } from "@/types/network";

/**
 * Save discovered devices to the database
 */
export async function saveDiscoveredDevices(
  devices: any[],
  siteId: string,
  subnetId: string,
  userId: string
): Promise<{ error: Error | null }> {
  try {
    console.log('Saving discovered devices:', devices.length);
    
    // First, save devices
    for (const device of devices) {
      console.log('Processing device:', device);
      
      const deviceRecord = {
        ip_address: device.ip_address,
        hostname: device.sysName || device.hostname || null,
        mac_address: device.mac_address || null,
        make: device.make || null,
        model: device.model || null,
        category: device.category || null,
        status: device.status || 'unknown',
        site_id: siteId,
        subnet_id: subnetId,
        user_id: userId,
        confirmed: device.confirmed || false,
        needs_verification: device.needs_verification || true,
        sysdescr: device.sysDescr || null
      };
      
      // Use upsert without specifying onConflict fields, let Supabase use the primary key
      const { error: deviceError } = await supabase
        .from('devices')
        .upsert(deviceRecord);
      
      if (deviceError) {
        console.error('Error inserting device:', deviceError);
        return { error: deviceError };
      }
      
      // Process MAC addresses if available
      if (device.macAddresses && Array.isArray(device.macAddresses) && device.macAddresses.length > 0) {
        console.log(`Processing ${device.macAddresses.length} MAC addresses for device ${device.ip_address}`);
        
        for (const mac of device.macAddresses) {
          const macAddressRecord = {
            mac_address: mac.macAddress,
            vlan_id: mac.vlanId,
            device_type: mac.deviceType || 'Unknown',
            site_id: siteId,
            subnet_id: subnetId,
            user_id: userId
          };

          // Insert each MAC address individually using simple upsert without onConflict
          const { error: macError } = await supabase
            .from('mac_addresses')
            .upsert(macAddressRecord);
          
          if (macError) {
            console.error('Error inserting MAC address:', macError);
            return { error: macError };
          }
        }
      }
    }
    
    return { error: null };
  } catch (error) {
    console.error('Error saving devices:', error);
    return { error: error instanceof Error ? error : new Error('Unknown error saving devices') };
  }
}
