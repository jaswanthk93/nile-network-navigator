
/**
 * Subnet management utilities
 */

import { supabase } from "@/integrations/supabase/client";
import { SubnetData } from "@/types/network";

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
    
    // For each device, write to the database
    for (const device of devices) {
      console.log('Processing device:', device);
      
      // Add site_id, subnet_id, and user_id to each device record
      // Ensure all property names match database column names (lowercase)
      const deviceRecord = {
        ip_address: device.ip_address,
        hostname: device.hostname || null,
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
        // Fix the column name - important: use lowercase 'sysdescr' to match database column
        sysdescr: device.sysDescr || null  // Explicitly map from sysDescr to sysdescr
      };
      
      console.log('Prepared device record:', deviceRecord);
      
      // Insert the device record
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

/**
 * Fetch subnets from the database
 */
export async function fetchSubnets(userId: string): Promise<{ data: SubnetData[] | null, error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('subnets')
      .select('*')
      .eq('user_id', userId);
      
    if (error) {
      return { data: null, error: new Error(error.message) };
    }
    
    // Add type casting to ensure data conforms to SubnetData interface
    // This handles the case where access_method might be null or an invalid value
    const typedData: SubnetData[] = data.map(subnet => ({
      ...subnet,
      // Type casting for access_method to match SubnetData type
      access_method: (subnet.access_method as "snmp" | "ssh" | "telnet" | null),
      // Type casting for other fields that might need it
      snmp_version: subnet.snmp_version as "1" | "2c" | "3" | null
    }));
    
    return { data: typedData, error: null };
  } catch (error) {
    console.error('Error fetching subnets:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Unknown error fetching subnets') 
    };
  }
}
