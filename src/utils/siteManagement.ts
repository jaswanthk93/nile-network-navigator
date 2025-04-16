
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
    
    const subnetIds = (subnetData?.map(subnet => subnet.id) || []) as string[];
    console.log(`Found ${subnetIds.length} subnets to delete`, subnetIds);
    
    // Step 2: Delete MAC addresses by site_id first
    console.log("Deleting MAC addresses by site_id...");
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
      console.log("Deleting MAC addresses by subnet_id for each subnet...");
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
      
      // Step 4: Check for any remaining MAC addresses by subnet
      console.log("Checking for any remaining MAC addresses by subnet...");
      for (const subnetId of subnetIds) {
        const { data: remainingMacs, error: checkError } = await supabase
          .from('mac_addresses')
          .select('id')
          .eq('subnet_id', subnetId);
          
        if (checkError) {
          console.error(`Error checking remaining MACs for subnet ${subnetId}:`, checkError);
          continue;
        }
        
        if (remainingMacs && remainingMacs.length > 0) {
          console.log(`Found ${remainingMacs.length} remaining MAC addresses for subnet ${subnetId}, attempting individual deletion...`);
          
          for (const mac of remainingMacs) {
            const { error: individualDeleteError } = await supabase
              .from('mac_addresses')
              .delete()
              .eq('id', mac.id);
              
            if (individualDeleteError) {
              console.error(`Error deleting individual MAC address ${mac.id}:`, individualDeleteError);
            }
          }
        }
      }
      
      // Step 5: Final sweep to delete any remaining MAC addresses
      console.log("Final sweep to delete any remaining MAC addresses...");
      if (subnetIds.length > 0) {
        const { error: finalSweepError } = await supabase
          .from('mac_addresses')
          .delete()
          .in('subnet_id', subnetIds);
          
        if (finalSweepError) {
          console.error("Error in final MAC address sweep:", finalSweepError);
        }
      }
    }
    
    console.log("MAC addresses deletion complete");
    
    // Step 6: Delete related VLANs
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
    
    // Step 7: Delete related devices
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
    
    // Step 8: Verify no MAC addresses remain before deleting subnets
    if (subnetIds.length > 0) {
      console.log("Verifying no MAC addresses remain before deleting subnets...");
      
      const { count: siteRemainingMacs, error: siteCheckError } = await supabase
        .from('mac_addresses')
        .select('*', { count: 'exact', head: true })
        .eq('site_id', siteId);
      
      if (siteCheckError) {
        console.error("Error checking for site MAC addresses:", siteCheckError);
        throw new Error(`Failed to check for remaining site MAC addresses: ${siteCheckError.message}`);
      }
      
      if (siteRemainingMacs && siteRemainingMacs > 0) {
        const errorMsg = `Cannot delete site: ${siteRemainingMacs} MAC addresses still reference it`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      const { count: subnetRemainingMacs, error: subnetCheckError } = await supabase
        .from('mac_addresses')
        .select('*', { count: 'exact', head: true })
        .in('subnet_id', subnetIds);
      
      if (subnetCheckError) {
        console.error("Error checking for subnet MAC addresses:", subnetCheckError);
        throw new Error(`Failed to check for remaining subnet MAC addresses: ${subnetCheckError.message}`);
      }
      
      if (subnetRemainingMacs && subnetRemainingMacs > 0) {
        const errorMsg = `Cannot delete subnets: ${subnetRemainingMacs} MAC addresses still reference them`;
        console.error(errorMsg);
        
        console.log("Emergency: attempting to delete remaining MAC addresses...");
        for (const subnetId of subnetIds) {
          await supabase.rpc('force_delete_macs_by_subnet', { subnet_id_param: subnetId });
        }
        
        const { count: emergencyCheck, error: emergencyCheckError } = await supabase
          .from('mac_addresses')
          .select('*', { count: 'exact', head: true })
          .in('subnet_id', subnetIds);
          
        if (emergencyCheckError || (emergencyCheck && emergencyCheck > 0)) {
          throw new Error(errorMsg);
        }
      }
    }
    
    // Step 9: Delete subnets
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
    
    // Step 10: Delete site
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
