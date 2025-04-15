
import { supabase } from "@/integrations/supabase/client";
import { SubnetData, DiscoveredMacAddress } from "@/types/network";
import { toast } from "@/hooks/use-toast";

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
      
      console.log('Saving device record:', deviceRecord);
      
      // Use upsert without onConflict parameter
      const { error: deviceError, data: savedDevice } = await supabase
        .from('devices')
        .upsert(deviceRecord);
      
      if (deviceError) {
        console.error('Error inserting device:', deviceError);
        return { error: deviceError };
      }
      
      console.log('Successfully saved device:', savedDevice || deviceRecord.ip_address);
      
      // Process MAC addresses if available
      if (device.macAddresses && Array.isArray(device.macAddresses) && device.macAddresses.length > 0) {
        console.log(`Processing ${device.macAddresses.length} MAC addresses for device ${device.ip_address}`);
        
        // Insert MAC addresses in batches for better performance
        const macBatchSize = 50;
        const macBatches = [];
        
        // Split MAC addresses into batches
        for (let i = 0; i < device.macAddresses.length; i += macBatchSize) {
          macBatches.push(device.macAddresses.slice(i, i + macBatchSize));
        }
        
        console.log(`Splitting ${device.macAddresses.length} MAC addresses into ${macBatches.length} batches`);
        
        for (let batchIndex = 0; batchIndex < macBatches.length; batchIndex++) {
          const macBatch = macBatches[batchIndex];
          const macRecords = macBatch.map(mac => ({
            mac_address: mac.macAddress,
            vlan_id: mac.vlanId,
            device_type: mac.deviceType || 'Unknown',
            site_id: siteId,
            subnet_id: subnetId,
            user_id: userId
          }));
          
          console.log(`Saving batch ${batchIndex + 1}/${macBatches.length} with ${macRecords.length} MAC addresses`);
          
          // Insert the batch
          const { error: macBatchError } = await supabase
            .from('mac_addresses')
            .upsert(macRecords);
          
          if (macBatchError) {
            console.error(`Error inserting MAC address batch ${batchIndex + 1}:`, macBatchError);
            toast({
              title: "Error Saving MAC Addresses",
              description: `Failed to save MAC address batch ${batchIndex + 1}: ${macBatchError.message}`,
              variant: "destructive",
            });
            // Continue with next batch instead of failing completely
          } else {
            console.log(`Successfully saved MAC address batch ${batchIndex + 1}`);
          }
        }
      }
    }
    
    return { error: null };
  } catch (error) {
    console.error('Error saving devices:', error);
    toast({
      title: "Error Saving Devices",
      description: error instanceof Error ? error.message : "Unknown error saving devices",
      variant: "destructive",
    });
    return { error: error instanceof Error ? error : new Error('Unknown error saving devices') };
  }
}
