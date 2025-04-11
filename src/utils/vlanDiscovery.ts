
import { supabase } from "@/integrations/supabase/client";
import { DiscoveredVlan, SubnetData } from "../types/network";
import { isValidVlanId } from "./networkValidation";
import { SwitchConnectionDetails, connectToSwitch, executeCommands } from "./deviceConnection";
import { callBackendApi, disconnectSession } from "./apiClient";

/**
 * Retrieve VLAN information from a network switch
 */
export async function getVlansFromSwitch(connectionDetails: SwitchConnectionDetails): Promise<DiscoveredVlan[]> {
  try {
    if (connectionDetails.method === "snmp") {
      // Direct VLAN discovery via agent
      console.log(`Discovering VLANs from ${connectionDetails.ip} via SNMP`);
      
      // Always use Cisco OIDs for the provided switch based on the user's output
      const result = await callBackendApi("/snmp/discover-vlans", {
        ip: connectionDetails.ip,
        community: connectionDetails.community || "public",
        version: connectionDetails.version || "2c",
        make: connectionDetails.make || "Cisco" // Default to Cisco if not specified
      });
      
      // Log raw results for debugging
      console.log(`Raw VLANs from ${connectionDetails.ip}:`, result);
      
      if (!result.vlans || !Array.isArray(result.vlans)) {
        console.error("Invalid response format from VLAN discovery");
        return [];
      }
      
      // Filter out invalid VLANs
      const validVlans = result.vlans.filter((vlan: any) => 
        isValidVlanId(vlan.vlanId)
      );
      
      if (result.vlans.length !== validVlans.length) {
        console.warn(`Filtered out ${result.vlans.length - validVlans.length} invalid VLANs from ${connectionDetails.ip}`);
      }
      
      console.log(`Final valid VLANs from ${connectionDetails.ip}:`, validVlans);
      return validVlans;
    } else {
      // For SSH/Telnet, first establish a connection
      console.log(`Discovering VLANs from ${connectionDetails.ip} via ${connectionDetails.method.toUpperCase()}`);
      const sessionId = await connectToSwitch(connectionDetails);
      
      if (!sessionId) {
        throw new Error(`Failed to connect to switch at ${connectionDetails.ip}`);
      }
      
      // Determine which commands to use based on the device make
      let commandSet = ["show vlan"]; // Default
      const make = connectionDetails.make?.toLowerCase() || "";
      
      if (make.includes("cisco")) {
        commandSet = [
          "terminal length 0",
          "show vlan brief"
        ];
      } else if (make.includes("juniper")) {
        commandSet = [
          "set cli screen-length 0",
          "show vlans detail"
        ];
      } else if (make.includes("hp") || make.includes("aruba")) {
        commandSet = [
          "no page",
          "show vlans"
        ];
      }
      
      // Execute the commands
      console.log(`Executing ${connectionDetails.method.toUpperCase()} commands on ${connectionDetails.ip}: ${commandSet.join(", ")}`);
      const output = await executeCommands(sessionId, connectionDetails.method, commandSet);
      
      // Disconnect the session
      await disconnectSession(sessionId, connectionDetails.method);
      
      if (!output) {
        throw new Error(`Failed to execute commands on switch at ${connectionDetails.ip}`);
      }
      
      // Parse the output to extract VLAN information
      const parsedVlans = parseVlanOutput(output, connectionDetails.make || "unknown");
      
      // Filter out invalid VLANs
      const validVlans = parsedVlans.filter(vlan => isValidVlanId(vlan.vlanId));
      
      console.log(`Final valid VLANs from ${connectionDetails.ip} (via ${connectionDetails.method}):`, validVlans);
      return validVlans;
    }
  } catch (error) {
    console.error("Error retrieving VLANs from switch:", error);
    return [];
  }
}

/**
 * Parse VLAN output based on device make
 */
function parseVlanOutput(output: string, make: string): DiscoveredVlan[] {
  const vlans: DiscoveredVlan[] = [];
  
  // Normalize make to handle case sensitivity
  const vendorName = make ? make.toLowerCase() : "default";
  
  try {
    if (vendorName.includes("cisco")) {
      // Parse Cisco output
      // Example format:
      // VLAN Name                             Status    Ports
      // ---- -------------------------------- --------- -------------------------------
      // 1    default                          active    Gi0/1, Gi0/2
      // 10   Management                       active    Gi0/3, Gi0/4
      const lines = output.split('\n');
      let startParsing = false;
      
      for (const line of lines) {
        if (!startParsing && line.includes("----")) {
          startParsing = true;
          continue;
        }
        
        if (startParsing && line.trim()) {
          const match = line.match(/^(\d+)\s+(\S+)\s+(\S+)\s+(.*)$/);
          if (match) {
            const [_, vlanId, name, status, ports] = match;
            const vlanIdNumber = parseInt(vlanId, 10);
            
            // Only include valid VLAN IDs (1-4094)
            if (isValidVlanId(vlanIdNumber)) {
              const portList = ports.split(',').map(p => p.trim()).filter(Boolean);
              
              vlans.push({
                vlanId: vlanIdNumber,
                name,
                usedBy: portList
              });
            }
          }
        }
      }
    } else if (vendorName.includes("juniper")) {
      // Parse Juniper output
      // Different format with more detailed information
      const vlanBlocks = output.split("Routing instance:");
      
      for (const block of vlanBlocks) {
        if (block.includes("VLAN:")) {
          const nameMatch = block.match(/VLAN:\s+(\S+)/);
          const idMatch = block.match(/Tag:\s+(\d+)/);
          
          if (nameMatch && idMatch) {
            const vlanName = nameMatch[1];
            const vlanId = parseInt(idMatch[1], 10);
            
            // Only include valid VLAN IDs
            if (isValidVlanId(vlanId)) {
              // Extract interfaces
              const interfaces: string[] = [];
              const interfaceMatches = block.matchAll(/(\S+\.\d+)(?:,|\s|$)/g);
              for (const match of interfaceMatches) {
                interfaces.push(match[1]);
              }
              
              vlans.push({
                vlanId,
                name: vlanName,
                usedBy: interfaces
              });
            }
          }
        }
      }
    } else if (vendorName.includes("hp") || vendorName.includes("aruba")) {
      // Parse HP/Aruba output
      const lines = output.split('\n');
      
      for (const line of lines) {
        // Match pattern like: "1    DEFAULT_VLAN                Port-based   No    No"
        const match = line.match(/^\s*(\d+)\s+(\S+)\s+/);
        if (match) {
          const [_, vlanId, name] = match;
          const vlanIdNumber = parseInt(vlanId, 10);
          
          // Only include valid VLAN IDs
          if (isValidVlanId(vlanIdNumber)) {
            vlans.push({
              vlanId: vlanIdNumber,
              name,
              usedBy: [] // HP/Aruba often requires a separate command for port mapping
            });
          }
        }
      }
    } else {
      // Generic parser for other vendors (best effort)
      const lines = output.split('\n');
      
      for (const line of lines) {
        // Try to match any number followed by a name
        const match = line.match(/(\d+)\s+(\S+)/);
        if (match) {
          const [_, vlanId, name] = match;
          const vlanIdNumber = parseInt(vlanId, 10);
          
          // Only include valid VLAN IDs
          if (isValidVlanId(vlanIdNumber)) {
            vlans.push({
              vlanId: vlanIdNumber,
              name,
              usedBy: []
            });
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error parsing VLAN output for ${make}:`, error);
  }
  
  // Sort by VLAN ID for consistency
  return vlans.sort((a, b) => a.vlanId - b.vlanId);
}

/**
 * Discover VLANs from multiple network switches
 */
export async function discoverVlans(
  devices: any[], 
  progressCallback?: (message: string, progress: number) => void
): Promise<DiscoveredVlan[]> {
  const allVlans: DiscoveredVlan[] = [];
  const uniqueVlanIds = new Set<number>();
  
  // Filter devices to just get switches
  const switches = devices.filter(device => 
    device.category === 'Switch' || 
    (device.make && (
      device.make.toLowerCase().includes('cisco') || 
      device.make.toLowerCase().includes('juniper') || 
      device.make.toLowerCase().includes('hp') || 
      device.make.toLowerCase().includes('aruba')
    ))
  );
  
  if (switches.length === 0) {
    console.log("No switches found for VLAN discovery");
    return [];
  }
  
  // Get subnet information for credential lookup
  const subnetsResult = await supabase
    .from('subnets')
    .select('*');
    
  if (subnetsResult.error) {
    console.error("Error fetching subnet information:", subnetsResult.error);
    return [];
  }
  
  const subnets = subnetsResult.data as SubnetData[] || [];
  let processedDevices = 0;
  
  // Log discovery process
  console.log(`Starting VLAN discovery on ${switches.length} switches`);
  
  // Process each switch - limit to one switch for testing
  const primarySwitch = switches[0]; // Focus on the first switch only initially
  console.log(`Limiting VLAN discovery to primary switch: ${primarySwitch.hostname || primarySwitch.ip_address}`);
  
  if (progressCallback) {
    progressCallback(
      `Connecting to ${primarySwitch.hostname || primarySwitch.ip_address}...`, 
      10
    );
  }
  
  // Find subnet for this device to get credentials
  const subnet = subnets.find(s => {
    const [subnetBase, mask] = s.cidr.split('/');
    const ipParts = subnetBase.split('.');
    const deviceIpParts = primarySwitch.ip_address.split('.');
    
    // Basic check - just compare first three octets for a /24
    return (
      ipParts[0] === deviceIpParts[0] && 
      ipParts[1] === deviceIpParts[1] && 
      (mask === '24' ? ipParts[2] === deviceIpParts[2] : true)
    );
  });
  
  if (!subnet) {
    console.warn(`No subnet information found for ${primarySwitch.ip_address}`);
    return [];
  }
  
  // Get connection details from the subnet information
  const connectionDetails: SwitchConnectionDetails = {
    ip: primarySwitch.ip_address,
    method: subnet.access_method || 'snmp',
    make: primarySwitch.make || "Cisco", // Default to Cisco
    model: primarySwitch.model
  };
  
  // Set credentials based on access method
  if (connectionDetails.method === 'snmp') {
    connectionDetails.community = subnet.snmp_community || 'public';
    connectionDetails.version = subnet.snmp_version as "1" | "2c" | "3" || '2c';
  } else {
    connectionDetails.username = subnet.username || 'admin';
    connectionDetails.password = subnet.password || 'password';
  }
  
  try {
    console.log(`Discovering VLANs from ${primarySwitch.ip_address} (${primarySwitch.hostname || 'unknown'}) via ${connectionDetails.method}`);
    
    if (progressCallback) {
      progressCallback(
        `Retrieving VLAN data from ${primarySwitch.hostname || primarySwitch.ip_address}...`, 
        30
      );
    }
    
    const discoveredVlans = await getVlansFromSwitch(connectionDetails);
    console.log(`Found ${discoveredVlans.length} valid VLANs on ${primarySwitch.ip_address}`);
    
    if (progressCallback) {
      progressCallback(
        `Processing ${discoveredVlans.length} VLANs...`, 
        70
      );
    }
    
    // Add the discovered VLANs to our collection
    for (const vlan of discoveredVlans) {
      if (!uniqueVlanIds.has(vlan.vlanId)) {
        uniqueVlanIds.add(vlan.vlanId);
        
        // Add the current device to usedBy if not already present
        const deviceName = primarySwitch.hostname || primarySwitch.ip_address;
        if (!vlan.usedBy.includes(deviceName)) {
          vlan.usedBy.push(deviceName);
        }
        
        allVlans.push(vlan);
      }
    }
  } catch (error) {
    console.error(`Error discovering VLANs from ${primarySwitch.ip_address}:`, error);
  }
  
  if (progressCallback) {
    progressCallback("VLAN discovery complete", 100);
  }
  
  // Sort VLANs by ID for consistency
  const sortedVlans = allVlans.sort((a, b) => a.vlanId - b.vlanId);
  console.log(`VLAN discovery complete. Found ${sortedVlans.length} unique valid VLANs.`);
  return sortedVlans;
}
