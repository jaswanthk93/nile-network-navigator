/**
 * Network discovery core functionality
 */

import { supabase } from "@/integrations/supabase/client";
import { SubnetData } from "@/types/network";
import { getIPRange, simulatePingAndARPLookup, parseCIDR } from './ipUtils';
import { 
  identifyDeviceFromMAC, 
  determineDeviceType, 
  getManufacturerFromOID,
  parseModelFromSNMP,
  determineDeviceTypeFromSNMP,
  SNMP_OIDS
} from './deviceIdentification';

/**
 * Use SNMP to get device information - enforces real backend connection
 */
async function getDeviceInfoViaSNMP(
  ipAddress: string, 
  updateProgress: (message: string, progress: number) => void,
  useBackendConnection: boolean
): Promise<{
  hostname: string | null;
  make: string | null;
  model: string | null;
  category: string | null;
  error?: string;
}> {
  try {
    updateProgress(`Retrieving SNMP information from ${ipAddress}...`, 1);
    
    // If backend connection is required but not available, throw an error
    if (!useBackendConnection) {
      throw new Error("Backend connection required for SNMP operations");
    }
    
    // Use backend connection for real SNMP data
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/snmp/get`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: ipAddress,
          oids: [
            SNMP_OIDS.sysDescr,
            SNMP_OIDS.sysName,
            SNMP_OIDS.sysObjectID
          ]
        }),
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`Backend returned status ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "SNMP query failed");
      }
      
      console.log("Real SNMP data received:", data);
      updateProgress(`SNMP information retrieved from ${ipAddress}`, 3);
      
      // Parse the real SNMP data
      const sysDescr = data.results[SNMP_OIDS.sysDescr] || '';
      const sysName = data.results[SNMP_OIDS.sysName] || null;
      const sysObjectID = data.results[SNMP_OIDS.sysObjectID] || '';
      
      // Extract manufacturer from OID
      const make = getManufacturerFromOID(sysObjectID);
      
      // Extract model from system description
      const model = parseModelFromSNMP(sysDescr, make);
      
      // Determine device type/category
      const category = determineDeviceTypeFromSNMP(sysDescr, sysObjectID);
      
      return {
        hostname: sysName,
        make,
        model,
        category
      };
    } catch (err) {
      console.error("Error connecting to backend or performing SNMP query:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown SNMP query error";
      return {
        hostname: null,
        make: null,
        model: null,
        category: null,
        error: errorMessage
      };
    }
  } catch (error) {
    console.error(`Error getting SNMP info from ${ipAddress}:`, error);
    return {
      hostname: null,
      make: null,
      model: null,
      category: null,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Function to discover devices in a subnet and gather information about them
 */
export async function discoverDevicesInSubnet(
  cidr: string,
  updateProgress: (message: string, progress: number) => void,
  backendConnected: boolean = false
): Promise<any[]> {
  if (!backendConnected) {
    throw new Error("Backend connection is required for device discovery");
  }
  
  const devices: any[] = [];
  const { baseIP, maskBits } = parseCIDR(cidr);
  
  // Get IP range based on subnet mask
  const { startIP, endIP, totalIPs } = getIPRange(cidr);
  
  // Get our local IP address for subnet calculation
  // In browser, we can't directly get the client's IP, so we'll use the base IP as a proxy
  const localIP = baseIP;
  
  // For /32 subnets, we only need to scan the exact IP
  if (maskBits === 32) {
    updateProgress(`Beginning scan of host ${baseIP}...`, 0);
    
    // For a /32, just check the single IP
    const ipAddress = baseIP;
    updateProgress(`Scanning ${ipAddress}...`, 20);
    
    // Check if device responds to ping
    const pingResult = simulatePingAndARPLookup(ipAddress, localIP, maskBits);
    
    if (pingResult.reachable) {
      // Basic device info
      const newDevice: any = {
        ip_address: ipAddress,
        hostname: null,
        mac_address: pingResult.macAddress,
        needs_verification: false,
        category: "Unknown",
        make: null,
        model: null,
        last_seen: new Date().toISOString()
      };
      
      // If we have a MAC address, try to identify the manufacturer
      if (pingResult.macAddress) {
        newDevice.make = identifyDeviceFromMAC(pingResult.macAddress);
      }
      
      // If we can guess the category based on MAC or IP, do so
      if (newDevice.make) {
        newDevice.category = determineDeviceType(ipAddress, newDevice.make);
      } else {
        newDevice.category = determineDeviceType(ipAddress);
      }
      
      // Check if we can get additional info via SNMP
      try {
        updateProgress(`Getting SNMP information from ${ipAddress}...`, 40);
        const snmpInfo = await getDeviceInfoViaSNMP(ipAddress, updateProgress, backendConnected);
        
        if (snmpInfo.error) {
          throw new Error(snmpInfo.error);
        }
        
        if (snmpInfo.hostname) {
          newDevice.hostname = snmpInfo.hostname;
        }
        
        if (snmpInfo.make) {
          newDevice.make = snmpInfo.make;
        }
        
        if (snmpInfo.model) {
          newDevice.model = snmpInfo.model;
        }
        
        if (snmpInfo.category) {
          newDevice.category = snmpInfo.category;
        }
      } catch (error) {
        console.warn(`SNMP information retrieval failed for ${ipAddress}:`, error);
        newDevice.needs_verification = true;
      }
      
      // If we're missing key information, mark for verification
      if (!newDevice.make || !newDevice.model || !newDevice.hostname) {
        newDevice.needs_verification = true;
      }
      
      devices.push(newDevice);
    }
    
    updateProgress(`Scan complete. Found ${devices.length} device(s).`, 100);
    return devices;
  }
  
  // For normal subnets, scan the range
  updateProgress(`Beginning scan of subnet ${cidr}...`, 0);
  
  // Parse the IP octets
  const startOctets = startIP.split('.').map(Number);
  const endOctets = endIP.split('.').map(Number);
  
  // For practical reasons, limit scanning to manageable ranges
  // If the subnet is too large, we'll sample it instead of scanning everything
  const maxIPsToScan = 254; // Maximum IPs to scan for performance
  let ipCount = totalIPs;
  let ipsToScan: string[] = [];
  
  // If there are too many IPs, create a representative sample
  if (totalIPs > maxIPsToScan && maskBits < 24) {
    console.log(`Subnet ${cidr} contains ${totalIPs} IPs, sampling ${maxIPsToScan}`);
    // Sample strategy: take evenly distributed IPs
    const step = Math.max(1, Math.floor(totalIPs / maxIPsToScan));
    
    // Start at network address + 1 (or network address for /31, /32)
    let currentIP = startOctets[0] << 24 | startOctets[1] << 16 | startOctets[2] << 8 | startOctets[3];
    const maxIP = endOctets[0] << 24 | endOctets[1] << 16 | endOctets[2] << 8 | endOctets[3];
    
    while (currentIP <= maxIP && ipsToScan.length < maxIPsToScan) {
      const ipStr = [
        (currentIP >>> 24) & 255,
        (currentIP >>> 16) & 255,
        (currentIP >>> 8) & 255,
        currentIP & 255
      ].join('.');
      
      ipsToScan.push(ipStr);
      currentIP += step;
    }
    
    ipCount = ipsToScan.length;
  } else {
    // For smaller subnets, scan all IPs
    // Generate all IPs in the range
    if (maskBits >= 24) {
      // For /24 or smaller subnets, just iterate over the last octet
      const subnet = startOctets.slice(0, 3).join('.');
      for (let i = startOctets[3]; i <= endOctets[3]; i++) {
        ipsToScan.push(`${subnet}.${i}`);
      }
    } else if (maskBits >= 16) {
      // For /16-/23 subnets, iterate over last two octets
      const subnet = startOctets.slice(0, 2).join('.');
      for (let i = startOctets[2]; i <= endOctets[2]; i++) {
        for (let j = (i === startOctets[2] ? startOctets[3] : 0); 
             j <= (i === endOctets[2] ? endOctets[3] : 255); j++) {
          ipsToScan.push(`${subnet}.${i}.${j}`);
          if (ipsToScan.length >= maxIPsToScan) break;
        }
        if (ipsToScan.length >= maxIPsToScan) break;
      }
    } else {
      // For very large subnets, just sample
      console.log(`Subnet ${cidr} is too large, sampling ${maxIPsToScan} IPs`);
      ipsToScan = [startIP, endIP]; // Just scan start and end as a minimum
      const step = Math.max(1, Math.floor(totalIPs / maxIPsToScan));
      let currentIP = parseInt(startOctets.join(''), 10) + step;
      
      while (ipsToScan.length < maxIPsToScan && currentIP < parseInt(endOctets.join(''), 10)) {
        const ipStr = [
          Math.floor(currentIP / 16777216) % 256,
          Math.floor(currentIP / 65536) % 256,
          Math.floor(currentIP / 256) % 256,
          currentIP % 256
        ].join('.');
        
        ipsToScan.push(ipStr);
        currentIP += step;
      }
    }
    
    ipCount = ipsToScan.length;
  }
  
  console.log(`Will scan ${ipCount} IPs in subnet ${cidr}`);
  let scannedCount = 0;
  
  // Process each IP in the subnet range
  for (const ipAddress of ipsToScan) {
    // Calculate percentage progress
    const progress = Math.floor((scannedCount / ipCount) * 100);
    
    // Update progress before starting this IP
    updateProgress(`Scanning ${ipAddress}...`, progress);
    
    // Check if device responds to ping
    const pingResult = simulatePingAndARPLookup(ipAddress, localIP, maskBits);
    
    if (pingResult.reachable) {
      // Basic device info
      const newDevice: any = {
        ip_address: ipAddress,
        hostname: null,
        mac_address: pingResult.macAddress,
        needs_verification: false,
        category: "Unknown",
        make: null,
        model: null,
        last_seen: new Date().toISOString()
      };
      
      // If we have a MAC address, try to identify the manufacturer
      if (pingResult.macAddress) {
        newDevice.make = identifyDeviceFromMAC(pingResult.macAddress);
      }
      
      // If we can guess the category based on MAC or IP, do so
      if (newDevice.make) {
        newDevice.category = determineDeviceType(ipAddress, newDevice.make);
      } else {
        newDevice.category = determineDeviceType(ipAddress);
      }
      
      // Check if we can get additional info via SNMP
      try {
        const snmpInfo = await getDeviceInfoViaSNMP(ipAddress, updateProgress, backendConnected);
        
        if (snmpInfo.error) {
          throw new Error(snmpInfo.error);
        }
        
        if (snmpInfo.hostname) {
          newDevice.hostname = snmpInfo.hostname;
        }
        
        if (snmpInfo.make) {
          newDevice.make = snmpInfo.make;
        }
        
        if (snmpInfo.model) {
          newDevice.model = snmpInfo.model;
        }
        
        if (snmpInfo.category) {
          newDevice.category = snmpInfo.category;
        }
      } catch (error) {
        console.warn(`SNMP information retrieval failed for ${ipAddress}:`, error);
        newDevice.needs_verification = true;
      }
      
      // If we're missing key information, mark for verification
      if (!newDevice.make || !newDevice.model || !newDevice.hostname) {
        newDevice.needs_verification = true;
      }
      
      devices.push(newDevice);
    }
    
    scannedCount++;
  }
  
  updateProgress(`Scan complete. Found ${devices.length} devices.`, 100);
  return devices;
}
