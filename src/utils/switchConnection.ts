
import { supabase } from "@/integrations/supabase/client";

// Interface for switch connection details
export interface SwitchConnectionDetails {
  ip: string;
  username: string;
  password: string;
  method: "ssh" | "telnet";
  make?: string;
  model?: string;
}

// Interface for discovered VLAN
export interface DiscoveredVlan {
  vlanId: number;
  name: string;
  subnet?: string;
  usedBy: string[];
}

// Vendor-specific commands to retrieve VLAN information
const VLAN_COMMANDS: Record<string, string[]> = {
  "Cisco": [
    "terminal length 0",
    "show vlan brief"
  ],
  "Juniper": [
    "set cli screen-length 0",
    "show vlans detail"
  ],
  "HP": [
    "no page",
    "show vlans"
  ],
  "Aruba": [
    "no paging",
    "show vlan"
  ],
  "Default": [
    "terminal length 0",
    "show vlan"
  ]
};

/**
 * Parse VLAN output based on device make
 * @param output Command output from switch
 * @param make Device manufacturer
 * @returns Array of discovered VLANs
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
            const portList = ports.split(',').map(p => p.trim()).filter(Boolean);
            
            vlans.push({
              vlanId: parseInt(vlanId),
              name,
              usedBy: portList
            });
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
            const vlanId = parseInt(idMatch[1]);
            
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
    } else if (vendorName.includes("hp") || vendorName.includes("aruba")) {
      // Parse HP/Aruba output
      const lines = output.split('\n');
      
      for (const line of lines) {
        // Match pattern like: "1    DEFAULT_VLAN                Port-based   No    No"
        const match = line.match(/^\s*(\d+)\s+(\S+)\s+/);
        if (match) {
          const [_, vlanId, name] = match;
          
          vlans.push({
            vlanId: parseInt(vlanId),
            name,
            usedBy: [] // HP/Aruba often requires a separate command for port mapping
          });
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
          
          vlans.push({
            vlanId: parseInt(vlanId),
            name,
            usedBy: []
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error parsing VLAN output for ${make}:`, error);
  }
  
  return vlans;
}

/**
 * Connect to a switch and execute commands
 * In a real implementation, this would use a library like ssh2 or telnet-client
 * For now, we'll simulate the connection based on device make
 */
export async function connectToSwitch(connectionDetails: SwitchConnectionDetails): Promise<string | null> {
  try {
    console.log(`Connecting to ${connectionDetails.ip} via ${connectionDetails.method}...`);
    
    // In a real implementation, we would establish a connection here
    // For demonstration, we'll simulate the connection
    
    // Check credentials - in reality this would be handled by the connection library
    if (!connectionDetails.username || !connectionDetails.password) {
      throw new Error("Username and password are required to connect to network devices");
    }
    
    // For now, just return a successful connection message
    return "Connected successfully";
  } catch (error) {
    console.error("Error connecting to switch:", error);
    return null;
  }
}

/**
 * Execute commands on a connected switch
 * In a real implementation, this would send commands over an established connection
 * For now, we'll simulate responses based on the device make
 */
export async function executeCommands(
  connectionDetails: SwitchConnectionDetails, 
  commands: string[]
): Promise<string | null> {
  try {
    console.log(`Executing commands on ${connectionDetails.ip}...`);
    console.log("Commands:", commands);
    
    // In a real implementation, we would send these commands over the connection
    // and collect the output
    
    // For demonstration, return a simulated response based on make
    const make = connectionDetails.make || "Unknown";
    
    // In a real implementation, this would be actual output from the device
    let simulatedResponse = "";
    
    if (make.toLowerCase().includes("cisco")) {
      simulatedResponse = `
VLAN Name                             Status    Ports
---- -------------------------------- --------- -------------------------------
1    default                          active    Gi0/1, Gi0/2
10   Management                       active    Gi0/3, Gi0/4
20   User_Data                        active    Gi0/5, Gi0/6
30   Voice                            active    Gi0/7, Gi0/8
40   Guest                            active    Gi0/9, Gi0/10
`;
    } else if (make.toLowerCase().includes("juniper")) {
      simulatedResponse = `
Routing instance: default-switch

VLAN: default
  Tag: 1
  Interfaces: ge-0/0/1.0, ge-0/0/2.0

VLAN: management
  Tag: 10
  Interfaces: ge-0/0/3.0, ge-0/0/4.0
  
VLAN: user-data
  Tag: 20
  Interfaces: ge-0/0/5.0, ge-0/0/6.0
  
VLAN: voice
  Tag: 30
  Interfaces: ge-0/0/7.0, ge-0/0/8.0
`;
    } else if (make.toLowerCase().includes("hp") || make.toLowerCase().includes("aruba")) {
      simulatedResponse = `
Status and Counters - VLAN Information

Maximum VLANs to support : 256
Primary VLAN : DEFAULT_VLAN
Management VLAN :

VLAN ID Name         Status     Voice Jumbo
------- ------------ ---------- ----- -----
1       DEFAULT_VLAN Port-based No    No
10      MANAGEMENT   Port-based No    No
20      USER_DATA    Port-based No    No
30      VOICE        Port-based Yes   No
`;
    } else {
      // Generic response for unknown devices
      simulatedResponse = `
VLAN ID  Name        Status
-------  ----------  ------
1        default     active
10       vlan10      active
20       vlan20      active
`;
    }
    
    return simulatedResponse;
  } catch (error) {
    console.error("Error executing commands:", error);
    return null;
  }
}

/**
 * Retrieve VLAN information from a network switch
 */
export async function getVlansFromSwitch(connectionDetails: SwitchConnectionDetails): Promise<DiscoveredVlan[]> {
  try {
    // Connect to the switch
    const connectionStatus = await connectToSwitch(connectionDetails);
    if (!connectionStatus) {
      throw new Error(`Failed to connect to switch at ${connectionDetails.ip}`);
    }
    
    // Determine which commands to use based on the device make
    const make = connectionDetails.make || "Unknown";
    let commandSet = VLAN_COMMANDS["Default"];
    
    // Find matching command set for the device vendor
    for (const [vendor, commands] of Object.entries(VLAN_COMMANDS)) {
      if (make.toLowerCase().includes(vendor.toLowerCase())) {
        commandSet = commands;
        break;
      }
    }
    
    // Execute the commands
    const output = await executeCommands(connectionDetails, commandSet);
    if (!output) {
      throw new Error(`Failed to execute commands on switch at ${connectionDetails.ip}`);
    }
    
    // Parse the output to extract VLAN information
    const vlans = parseVlanOutput(output, make);
    
    return vlans;
  } catch (error) {
    console.error("Error retrieving VLANs from switch:", error);
    return [];
  }
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
  
  const subnets = subnetsResult.data || [];
  let processedDevices = 0;
  
  // Process each switch
  for (const switchDevice of switches) {
    if (progressCallback) {
      progressCallback(
        `Connecting to ${switchDevice.hostname || switchDevice.ip_address}...`, 
        (processedDevices / switches.length) * 100
      );
    }
    
    // Find subnet for this device to get credentials
    const subnet = subnets.find(s => {
      const [subnetBase, mask] = s.cidr.split('/');
      const ipParts = subnetBase.split('.');
      const deviceIpParts = switchDevice.ip_address.split('.');
      
      // Basic check - just compare first three octets for a /24
      // In a real implementation, you'd check subnet membership properly
      return (
        ipParts[0] === deviceIpParts[0] && 
        ipParts[1] === deviceIpParts[1] && 
        ipParts[2] === deviceIpParts[2]
      );
    });
    
    if (!subnet) {
      console.warn(`No subnet information found for ${switchDevice.ip_address}`);
      continue;
    }
    
    // In a real implementation, you'd get credentials from the subnet information
    // For now, use dummy values
    const connectionDetails: SwitchConnectionDetails = {
      ip: switchDevice.ip_address,
      username: 'admin', // In real implementation: get from subnet
      password: 'password', // In real implementation: get from subnet
      method: 'ssh', // In real implementation: get from subnet
      make: switchDevice.make,
      model: switchDevice.model
    };
    
    try {
      const vlans = await getVlansFromSwitch(connectionDetails);
      
      // Add discovered VLANs to the collection
      for (const vlan of vlans) {
        if (!uniqueVlanIds.has(vlan.vlanId)) {
          uniqueVlanIds.add(vlan.vlanId);
          
          // Add the current device to usedBy if not already present
          const deviceName = switchDevice.hostname || switchDevice.ip_address;
          if (!vlan.usedBy.includes(deviceName)) {
            vlan.usedBy.push(deviceName);
          }
          
          allVlans.push(vlan);
        } else {
          // Update existing VLAN entry
          const existingVlan = allVlans.find(v => v.vlanId === vlan.vlanId);
          if (existingVlan) {
            // Add the current device to usedBy if not already present
            const deviceName = switchDevice.hostname || switchDevice.ip_address;
            if (!existingVlan.usedBy.includes(deviceName)) {
              existingVlan.usedBy.push(deviceName);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error discovering VLANs from ${switchDevice.ip_address}:`, error);
    }
    
    processedDevices++;
  }
  
  if (progressCallback) {
    progressCallback("VLAN discovery complete", 100);
  }
  
  return allVlans;
}
