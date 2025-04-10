import { supabase } from "@/integrations/supabase/client";
import { DiscoveredVlan, SubnetData } from "../types/network";

// Interface for switch connection details
export interface SwitchConnectionDetails {
  ip: string;
  community?: string;  // SNMP community string (typically 'public' or 'private')
  version?: "1" | "2c" | "3";  // SNMP version
  username?: string;  // For SNMPv3 or SSH/Telnet
  password?: string;  // For SNMPv3 or SSH/Telnet
  method: "snmp" | "ssh" | "telnet";
  make?: string;
  model?: string;
}

// Configuration for the agent
const BACKEND_URL = "http://localhost:3001/api"; // Update this to match your agent URL

// Handles API requests to the backend agent
async function callBackendApi(endpoint: string, data: any): Promise<any> {
  try {
    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error calling ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Connect to a switch using selected method (SNMP, SSH, Telnet)
 */
export async function connectToSwitch(connectionDetails: SwitchConnectionDetails): Promise<string | null> {
  try {
    let endpoint;
    let requestData;
    
    // Determine the endpoint and data based on method
    if (connectionDetails.method === "snmp") {
      endpoint = "/snmp/connect";
      requestData = {
        ip: connectionDetails.ip,
        community: connectionDetails.community || "public",
        version: connectionDetails.version || "2c"
      };
    } else if (connectionDetails.method === "ssh") {
      endpoint = "/ssh/connect";
      requestData = {
        ip: connectionDetails.ip,
        username: connectionDetails.username,
        password: connectionDetails.password,
        port: 22
      };
    } else if (connectionDetails.method === "telnet") {
      endpoint = "/telnet/connect";
      requestData = {
        ip: connectionDetails.ip,
        username: connectionDetails.username,
        password: connectionDetails.password,
        port: 23
      };
    } else {
      throw new Error("Invalid connection method");
    }
    
    console.log(`Attempting to connect to ${connectionDetails.ip} via ${connectionDetails.method}...`);
    
    // Make the connection request
    const result = await callBackendApi(endpoint, requestData);
    return result.sessionId;
  } catch (error) {
    console.error("Error connecting to switch:", error);
    return null;
  }
}

/**
 * Execute SNMP queries on a connected switch
 */
export async function executeSnmpQueries(
  sessionId: string,
  oids: string[]
): Promise<Record<string, any> | null> {
  try {
    console.log(`Executing SNMP queries on session ${sessionId}...`);
    
    const result = await callBackendApi("/snmp/get", {
      sessionId,
      oids
    });
    
    return result.results;
  } catch (error) {
    console.error("Error executing SNMP queries:", error);
    return null;
  }
}

/**
 * Execute SNMP WALK on a connected switch
 */
export async function executeSnmpWalk(
  sessionId: string,
  oid: string
): Promise<Record<string, any> | null> {
  try {
    console.log(`Executing SNMP WALK on session ${sessionId} for OID ${oid}...`);
    
    const result = await callBackendApi("/snmp/walk", {
      sessionId,
      oid
    });
    
    return result.results;
  } catch (error) {
    console.error("Error executing SNMP WALK:", error);
    return null;
  }
}

/**
 * Execute commands on a connected switch (SSH/Telnet)
 */
export async function executeCommands(
  sessionId: string,
  method: "ssh" | "telnet", 
  commands: string[]
): Promise<string | null> {
  try {
    console.log(`Executing ${method.toUpperCase()} commands on session ${sessionId}...`);
    
    let output = "";
    
    // Execute each command sequentially
    for (const command of commands) {
      const endpoint = `/${method}/execute`;
      const result = await callBackendApi(endpoint, {
        sessionId,
        command
      });
      
      if (method === "ssh") {
        output += result.stdout + "\n";
        if (result.stderr) {
          output += "ERROR: " + result.stderr + "\n";
        }
      } else {
        output += result.output + "\n";
      }
    }
    
    return output;
  } catch (error) {
    console.error(`Error executing ${method} commands:`, error);
    return null;
  }
}

/**
 * Disconnect a session (SSH/Telnet)
 */
export async function disconnectSession(
  sessionId: string,
  method: "ssh" | "telnet"
): Promise<boolean> {
  try {
    const endpoint = `/${method}/disconnect`;
    await callBackendApi(endpoint, {
      sessionId
    });
    return true;
  } catch (error) {
    console.error(`Error disconnecting ${method} session:`, error);
    return false;
  }
}

/**
 * Retrieve VLAN information from a network switch
 */
export async function getVlansFromSwitch(connectionDetails: SwitchConnectionDetails): Promise<DiscoveredVlan[]> {
  try {
    if (connectionDetails.method === "snmp") {
      // Direct VLAN discovery via agent
      const result = await callBackendApi("/snmp/discover-vlans", {
        ip: connectionDetails.ip,
        community: connectionDetails.community || "public",
        version: connectionDetails.version || "2c",
        make: connectionDetails.make
      });
      
      return result.vlans;
    } else {
      // For SSH/Telnet, first establish a connection
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
      const output = await executeCommands(sessionId, connectionDetails.method, commandSet);
      
      // Disconnect the session
      await disconnectSession(sessionId, connectionDetails.method);
      
      if (!output) {
        throw new Error(`Failed to execute commands on switch at ${connectionDetails.ip}`);
      }
      
      // Parse the output to extract VLAN information
      return parseVlanOutput(output, connectionDetails.make || "unknown");
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
    
    // Get connection details from the subnet information
    const connectionDetails: SwitchConnectionDetails = {
      ip: switchDevice.ip_address,
      method: subnet.access_method || 'snmp',
      make: switchDevice.make,
      model: switchDevice.model
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
