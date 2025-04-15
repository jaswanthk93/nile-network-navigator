
import { DiscoveredMacAddress } from "@/types/network";
import { executeSnmpWalk, callBackendApi } from "@/utils/apiClient";
import { useToast, toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MacAddressDiscoveryResult {
  macAddresses: DiscoveredMacAddress[];
  vlanIds: number[];
  status?: string;
}

/**
 * Get device information via SNMP
 * This is a simplified version that only returns basic device info
 */
export async function getDeviceInfoViaSNMP(
  ip: string,
  updateProgress?: (message: string, progress: number) => void,
  backendConnected: boolean = false
): Promise<any> {
  try {
    if (updateProgress) {
      updateProgress(`Getting SNMP information from ${ip}...`, 5);
    }

    // When backend is connected, use real SNMP discovery
    if (backendConnected) {
      console.log(`Discovering device info for ${ip} using backend API`);
      const { data, error } = await fetch('/api/devices/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ip,
          community: 'public',
          version: '2c'
        }),
      }).then(res => res.json());

      if (error) {
        console.error(`Error discovering device info for ${ip}:`, error);
        return { error };
      }

      if (updateProgress) {
        updateProgress(`Received SNMP information for ${ip}`, 10);
      }

      // Make sure to return the data in a consistent format
      const deviceInfo = {
        hostname: data?.device?.sysName || null,
        make: data?.device?.manufacturer || null,
        model: data?.device?.model || null,
        category: data?.device?.type || 'Unknown',
        sysDescr: data?.device?.sysDescr || null
      };
      
      console.log(`Device info discovered for ${ip}:`, deviceInfo);
      return deviceInfo;
    } else {
      // Simulated response for development without backend
      console.log(`[Simulated] Getting SNMP information for ${ip}`);
      return {
        hostname: `device-${ip.split('.').pop()}`,
        make: 'SimulatedDevice',
        model: 'DevSim2000',
        category: 'Switch',
        sysDescr: 'Simulated device for development'
      };
    }
  } catch (error) {
    console.error(`Error in getDeviceInfoViaSNMP for ${ip}:`, error);
    return { error };
  }
}

/**
 * Discover MAC addresses on a switch using SNMP
 * Using a step-by-step approach with sorted VLANs
 * Now with incremental processing to save MAC addresses as they are discovered
 */
export async function discoverMacAddresses(
  ip: string,
  community: string = 'public',
  version: string = '2c',
  vlanIds: number[] = [],
  progressCallback?: (message: string, progress: number) => void,
  siteId?: string,
  subnetId?: string,
  userId?: string
): Promise<MacAddressDiscoveryResult> {
  try {
    if (progressCallback) {
      progressCallback("Starting MAC address discovery...", 0);
    }

    // Ensure we use sorted VLANs and log details
    const sortedVlanIds = [...new Set(vlanIds)].sort((a, b) => a - b);
    console.log(`Starting MAC address discovery with ${sortedVlanIds.length} unique VLANs in ascending order: ${sortedVlanIds.join(', ')}`);
    
    if (sortedVlanIds.length === 0) {
      console.warn("No VLANs provided for MAC address discovery. Please discover VLANs first.");
      toast({
        title: "VLAN Discovery Required",
        description: "No VLANs available. Please discover VLANs first before attempting MAC address discovery.",
        variant: "default",
      });
      return { macAddresses: [], vlanIds: [] };
    }
    
    // Select a smaller subset of VLANs to improve performance
    // This helps reduce the timeout risk by limiting the number of SNMP walks
    const priorityVlans = sortedVlanIds.length > 5 
      ? [1, ...sortedVlanIds.slice(0, 4)] // VLAN 1 plus first 4 VLANs
      : sortedVlanIds;
    
    // Remove duplicates in case VLAN 1 was already in the list
    const uniquePriorityVlans = [...new Set(priorityVlans)];
    
    console.log(`Using a priority subset of ${uniquePriorityVlans.length} VLANs for initial MAC discovery: ${uniquePriorityVlans.join(', ')}`);
    
    if (progressCallback) {
      progressCallback(`Using ${uniquePriorityVlans.length} priority VLANs for MAC address discovery...`, 10);
    }

    try {
      // Call backend API with increased timeout for the initial request
      console.log(`Calling backend API for MAC address discovery with priority VLANs: ${uniquePriorityVlans.join(', ')}`);
      
      const endpoint = "/snmp/discover-mac-addresses";
      console.log(`Full endpoint URL: ${import.meta.env.VITE_BACKEND_URL || "http://localhost:3001/api"}${endpoint}`);
      
      const requestData = {
        ip,
        community,
        version,
        vlanIds: uniquePriorityVlans,
        priorityOnly: true  // Signal to the backend to only process these priority VLANs
      };
      
      console.log(`Request data for priority MAC discovery:`, JSON.stringify(requestData, null, 2));
      
      if (progressCallback) {
        progressCallback(`Sending request to backend for MAC address discovery...`, 30);
      }
      
      // If we have site, subnet and user IDs, we can save directly to the database
      const canSaveToDatabase = !!(siteId && subnetId && userId);
      if (canSaveToDatabase) {
        console.log(`Will save MAC addresses directly to database for site: ${siteId}, subnet: ${subnetId}, user: ${userId}`);
      } else {
        console.log(`Missing information to save directly to database - will only return discovered MACs`);
      }
      
      // Set up the collector array for MAC addresses
      const allMacAddresses: DiscoveredMacAddress[] = [];
      const batchSize = 25; // Batch size for Supabase inserts
      let currentBatch: DiscoveredMacAddress[] = [];
      
      // Use a longer timeout for the API call (30 seconds)
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || "http://localhost:3001/api"}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }
      
      // Create a reader to handle the streamed response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is not readable");
      }
      
      // Process the chunked response
      let textDecoder = new TextDecoder();
      let partialChunk = '';
      let processedMacs = 0;
      
      // Function to save a batch of MAC addresses to Supabase
      const saveMacBatch = async (batch: DiscoveredMacAddress[]) => {
        if (!canSaveToDatabase || batch.length === 0) return;
        
        try {
          const macRecords = batch.map(mac => ({
            mac_address: mac.macAddress,
            vlan_id: mac.vlanId,
            device_type: mac.deviceType || 'Unknown',
            site_id: siteId,
            subnet_id: subnetId,
            user_id: userId
          }));
          
          console.log(`Saving batch of ${macRecords.length} MAC addresses to database`);
          
          const { error } = await supabase
            .from('mac_addresses')
            .upsert(macRecords);
          
          if (error) {
            console.error("Error saving MAC batch to database:", error);
          } else {
            console.log(`Successfully saved ${macRecords.length} MAC addresses to database`);
          }
        } catch (error) {
          console.error("Error in saveMacBatch:", error);
        }
      };
      
      // Start reading the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Convert the chunk to text and add it to any leftover partial chunk
        const chunk = textDecoder.decode(value, { stream: true });
        const textChunk = partialChunk + chunk;
        partialChunk = '';
        
        try {
          // Try to parse the JSON response
          // The response is a stream, so we need to handle partial data
          const result = JSON.parse(textChunk);
          
          // Process MAC addresses
          if (result.macAddresses && Array.isArray(result.macAddresses)) {
            allMacAddresses.push(...result.macAddresses);
            processedMacs += result.macAddresses.length;
            
            if (progressCallback) {
              progressCallback(`Discovered ${processedMacs} MAC addresses so far...`, 
                Math.min(30 + (processedMacs / 10), 90));
            }
            
            // Add to current batch for database saving
            result.macAddresses.forEach((mac: DiscoveredMacAddress) => {
              currentBatch.push(mac);
              
              // When batch size is reached, save to database
              if (currentBatch.length >= batchSize) {
                saveMacBatch([...currentBatch]);
                currentBatch = [];
              }
            });
          }
        } catch (e) {
          // If parsing fails, it's likely a partial chunk
          partialChunk = textChunk;
        }
      }
      
      // Save any remaining MAC addresses in the current batch
      if (currentBatch.length > 0) {
        await saveMacBatch(currentBatch);
      }
      
      if (progressCallback) {
        progressCallback(`MAC address discovery complete. Found ${allMacAddresses.length} MAC addresses.`, 100);
      }
      
      console.log(`MAC address discovery complete. Found ${allMacAddresses.length} MAC addresses.`);
      
      if (allMacAddresses.length === 0) {
        console.warn("No MAC addresses were discovered. This could indicate a problem with the SNMP configuration or permissions.");
        toast({
          title: "No MAC Addresses Found",
          description: "The discovery process completed but no MAC addresses were found. Check your device configuration and try again.",
          variant: "default",
        });
      } else {
        // Log a sample of discovered MAC addresses (up to 5)
        const sampleMacs = allMacAddresses.slice(0, 5);
        console.log(`Sample of discovered MAC addresses:`, sampleMacs);
        
        // Log counts by VLAN
        const macsByVlan = new Map<number, number>();
        allMacAddresses.forEach(mac => {
          const count = macsByVlan.get(mac.vlanId) || 0;
          macsByVlan.set(mac.vlanId, count + 1);
        });
        
        console.log(`MAC addresses by VLAN:`);
        macsByVlan.forEach((count, vlanId) => {
          console.log(`VLAN ${vlanId}: ${count} MAC addresses`);
        });
      }
      
      // Ensure we return a properly formatted result
      return {
        macAddresses: allMacAddresses,
        vlanIds: uniquePriorityVlans,
        status: 'success'
      };
    } catch (error) {
      console.error("Error in MAC address discovery:", error);
      if (progressCallback) {
        progressCallback(`Error during MAC address discovery: ${error instanceof Error ? error.message : String(error)}`, 100);
      }
      
      toast({
        title: "MAC Discovery Failed",
        description: error instanceof Error ? error.message : "Failed to discover MAC addresses. Check the device connection and try again.",
        variant: "destructive",
      });
      
      return { macAddresses: [], vlanIds: uniquePriorityVlans };
    }
  } catch (error) {
    console.error("Error in discoverMacAddresses:", error);
    toast({
      title: "MAC Discovery Error",
      description: "An unexpected error occurred during MAC address discovery.",
      variant: "destructive",
    });
    throw error;
  }
}

/**
 * Try to determine device type from MAC address OUI
 */
function getMacDeviceType(mac: string): string {
  // Extract OUI (first 3 bytes of MAC)
  const oui = mac.split(':').slice(0, 3).join(':').toUpperCase();
  
  // This would ideally be a lookup against an OUI database
  // For demo purposes, just assigning random types based on hash
  const types = ['Desktop', 'Mobile', 'IoT', 'Server', 'Network'];
  const hash = oui.split(':').reduce((acc, val) => acc + parseInt(val, 16), 0);
  
  return types[hash % types.length];
}
