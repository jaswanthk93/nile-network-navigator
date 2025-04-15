
import { supabase } from "@/integrations/supabase/client";
import { SubnetData } from "@/types/network";

export async function saveDiscoveredDevices(
  devices: any[],
  siteId: string,
  subnetId: string,
  userId: string
): Promise<{ error: Error | null }> {
  try {
    console.log('Saving discovered devices:', devices.length);
    
    for (const device of devices) {
      console.log('Processing device:', device);
      
      // Prioritize SNMP discovered hostname over existing hostname
      const deviceHostname = device.sysName || device.hostname || null;
      
      const deviceRecord = {
        ip_address: device.ip_address,
        hostname: deviceHostname,  // Use SNMP hostname first
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
      
      console.log('Prepared device record:', deviceRecord);
      
      const { error } = await supabase
        .from('devices')
        .insert(deviceRecord);
      
      if (error) {
        console.error('Error inserting device:', error);
        return { error };
      }
    }
    
    return { error: null };
  } catch (error) {
    console.error('Error saving devices:', error);
    return { error: error instanceof Error ? error : new Error('Unknown error saving devices') };
  }
}
