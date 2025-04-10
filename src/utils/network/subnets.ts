
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
    // For each device, write to the database
    for (const device of devices) {
      // Add site_id, subnet_id, and user_id to each device record
      const deviceRecord = {
        ...device,
        site_id: siteId,
        subnet_id: subnetId,
        user_id: userId
      };
      
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
    
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching subnets:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Unknown error fetching subnets') 
    };
  }
}
