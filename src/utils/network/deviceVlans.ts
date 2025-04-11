
import { DiscoveredVlan } from "../../types/network";
import { isValidVlanId } from "../networkValidation";
import { connectToSwitch, executeCommands, SwitchConnectionDetails } from "../deviceConnection";
import { callBackendApi, disconnectSession } from "../apiClient";
import { parseVlanOutput } from "./vlanParsing";

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
