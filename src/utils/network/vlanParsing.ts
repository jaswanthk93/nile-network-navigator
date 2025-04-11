
import { DiscoveredVlan } from "../../types/network";
import { isValidVlanId } from "../networkValidation";

/**
 * Parse VLAN output based on device make
 */
export function parseVlanOutput(output: string, make: string): DiscoveredVlan[] {
  const processedVlans = new Map<number, DiscoveredVlan>();
  
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
            if (isValidVlanId(vlanIdNumber) && !processedVlans.has(vlanIdNumber)) {
              const portList = ports.split(',').map(p => p.trim()).filter(Boolean);
              
              processedVlans.set(vlanIdNumber, {
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
            
            // Only include valid VLAN IDs and skip duplicates
            if (isValidVlanId(vlanId) && !processedVlans.has(vlanId)) {
              // Extract interfaces
              const interfaces: string[] = [];
              const interfaceMatches = block.matchAll(/(\S+\.\d+)(?:,|\s|$)/g);
              for (const match of interfaceMatches) {
                interfaces.push(match[1]);
              }
              
              processedVlans.set(vlanId, {
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
          
          // Only include valid VLAN IDs and skip duplicates
          if (isValidVlanId(vlanIdNumber) && !processedVlans.has(vlanIdNumber)) {
            processedVlans.set(vlanIdNumber, {
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
          
          // Only include valid VLAN IDs and skip duplicates
          if (isValidVlanId(vlanIdNumber) && !processedVlans.has(vlanIdNumber)) {
            processedVlans.set(vlanIdNumber, {
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
  
  // Convert the Map to an array and sort by VLAN ID for consistency
  return Array.from(processedVlans.values()).sort((a, b) => a.vlanId - b.vlanId);
}
