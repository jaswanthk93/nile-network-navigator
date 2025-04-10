
import { callBackendApi, disconnectSession } from "./apiClient";

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
