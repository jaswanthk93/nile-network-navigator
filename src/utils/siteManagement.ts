
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

export interface DeleteSiteOptions {
  siteId: string;
  siteName: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export const deleteSite = async ({ 
  siteId, 
  siteName, 
  onSuccess, 
  onError 
}: DeleteSiteOptions): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log(`Starting deletion process for site: ${siteId}`);
    
    // Step 1: Fetch subnets for this site
    console.log("Fetching subnets for this site...");
    const { data: subnetData, error: subnetFetchError } = await supabase
      .from('subnets')
      .select('id')
      .eq('site_id', siteId);
    
    if (subnetFetchError) {
      console.error("Error fetching subnets:", subnetFetchError);
      throw new Error(`Failed to fetch subnets: ${subnetFetchError.message}`);
    }
    
    // Ensure subnetIds is an array of strings, fallback to empty array
    const subnetIds: string[] = subnetData ? 
      subnetData.map(subnet => subnet.id).filter(Boolean) : 
      [];
    
    console.log(`Found ${subnetIds.length} subnets to delete`, subnetIds);
    
    // CRITICAL CHANGE: Aggressively delete all MAC addresses first
    // Step 2: Delete MAC addresses by site_id 
    console.log("Deleting all MAC addresses by site_id...");
    const { error: macSiteError } = await supabase
      .from('mac_addresses')
      .delete()
      .eq('site_id', siteId);
    
    if (macSiteError) {
      console.error("Error deleting MAC addresses by site_id:", macSiteError);
      throw new Error(`Failed to delete MAC addresses by site_id: ${macSiteError.message}`);
    }
    
    // Step 3: Delete MAC addresses by subnet_id for each subnet
    if (subnetIds.length > 0) {
      console.log("Deleting all MAC addresses by subnet_id for each subnet...");
      for (const subnetId of subnetIds) {
        const { error: macSubnetError } = await supabase
          .from('mac_addresses')
          .delete()
          .eq('subnet_id', subnetId);
        
        if (macSubnetError) {
          console.error(`Error deleting MAC addresses for subnet ${subnetId}:`, macSubnetError);
          throw new Error(`Failed to delete MAC addresses for subnet: ${macSubnetError.message}`);
        }
      }
    }
    
    // Final Check: Verify all MAC addresses are deleted
    if (subnetIds.length > 0) {
      console.log("Final verification: Checking for any remaining MAC addresses...");
      
      const { count: remainingMacs, error: checkError } = await supabase
        .from('mac_addresses')
        .select('*', { count: 'exact', head: true })
        .in('subnet_id', subnetIds);
      
      if (checkError) {
        console.error("Error checking for remaining MAC addresses:", checkError);
      } else if (remainingMacs && remainingMacs > 0) {
        console.warn(`WARNING: ${remainingMacs} MAC addresses still remain. Will attempt deletion anyway.`);
        
        // Brute force delete all MAC addresses with matching subnet_ids
        for (const subnetId of subnetIds) {
          await supabase
            .from('mac_addresses')
            .delete()
            .eq('subnet_id', subnetId);
        }
      } else {
        console.log("All MAC addresses successfully deleted");
      }
    }
    
    // Step 4: Delete related VLANs
    console.log("Deleting related VLANs...");
    const { error: vlanError } = await supabase
      .from('vlans')
      .delete()
      .eq('site_id', siteId);
    
    if (vlanError) {
      console.error("Error deleting VLANs:", vlanError);
      throw new Error(`Failed to delete VLANs: ${vlanError.message}`);
    }
    console.log("VLANs deleted successfully");
    
    // Step 5: Delete related devices
    console.log("Deleting related devices...");
    
    const { error: deviceSiteError } = await supabase
      .from('devices')
      .delete()
      .eq('site_id', siteId);
    
    if (deviceSiteError) {
      console.error("Error deleting devices by site_id:", deviceSiteError);
      throw new Error(`Failed to delete devices by site_id: ${deviceSiteError.message}`);
    }
    
    if (subnetIds.length > 0) {
      for (const subnetId of subnetIds) {
        const { error: deviceSubnetError } = await supabase
          .from('devices')
          .delete()
          .eq('subnet_id', subnetId);
        
        if (deviceSubnetError) {
          console.error(`Error deleting devices for subnet ${subnetId}:`, deviceSubnetError);
          throw new Error(`Failed to delete devices for subnet: ${deviceSubnetError.message}`);
        }
      }
    }
    
    console.log("Devices deleted successfully");
    
    // Step 6: Delete subnets
    console.log("Deleting subnets...");
    const { error: subnetError } = await supabase
      .from('subnets')
      .delete()
      .eq('site_id', siteId);
    
    if (subnetError) {
      console.error("Error deleting subnets:", subnetError);
      throw new Error(`Failed to delete subnets: ${subnetError.message}`);
    }
    
    console.log("Subnets deleted successfully");
    
    // Step 7: Delete site
    console.log("Deleting site...");
    const { error: siteError } = await supabase
      .from('sites')
      .delete()
      .eq('id', siteId);
    
    if (siteError) {
      console.error("Error deleting site:", siteError);
      throw new Error(`Failed to delete site: ${siteError.message}`);
    }
    
    console.log("Site deletion completed successfully");
    toast({
      title: "Site deleted",
      description: `Site "${siteName}" and all associated data have been removed.`,
    });
    
    if (onSuccess) onSuccess();
    return { success: true };
  } catch (error) {
    console.error("Error in deletion process:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    toast({
      title: "Error deleting site",
      description: "Failed to delete site. See error details for more information.",
      variant: "destructive",
    });
    
    if (onError) onError(errorMessage);
    return { success: false, error: errorMessage };
  }
};
