
/**
 * Subnet scanning strategies for different network sizes
 */

import { simulatePingAndARPLookup } from "./ipUtils";

/**
 * Scan a single network device
 */
export async function scanNetworkDevice(ip: string): Promise<{isReachable: boolean, macAddress?: string}> {
  // Simulate a ping to check if device is reachable
  const pingResult = simulatePingAndARPLookup(ip, "192.168.1.1", 24); // Use default values for local IP and mask
  
  return {
    isReachable: pingResult.reachable,
    macAddress: pingResult.macAddress
  };
}

/**
 * Scan a single host (/32 subnet)
 */
export async function scanSingleHost(
  ip: string,
  localIP: string,
  maskBits: number,
  updateProgress: (message: string, progress: number) => void,
  getDeviceInfo: (ip: string) => Promise<any>
): Promise<any[]> {
  const devices: any[] = [];
  updateProgress(`Beginning scan of host ${ip}...`, 0);
  updateProgress(`Scanning ${ip}...`, 20);
  
  // Check if device responds to ping
  const pingResult = simulatePingAndARPLookup(ip, localIP, maskBits);
  
  if (pingResult.reachable) {
    // Basic device info
    const newDevice: any = {
      ip_address: ip,
      hostname: null,
      mac_address: pingResult.macAddress,
      confirmed: false,
      needs_verification: true,
      category: "Unknown",
      make: null,
      model: null,
      sysDescr: null,
      last_seen: new Date().toISOString()
    };
    
    // Try to get more device info
    try {
      updateProgress(`Getting SNMP information from ${ip}...`, 40);
      const additionalInfo = await getDeviceInfo(ip);
      
      if (!additionalInfo.error) {
        newDevice.hostname = additionalInfo.hostname;
        newDevice.make = additionalInfo.make;
        newDevice.model = additionalInfo.model;
        newDevice.category = additionalInfo.category;
        newDevice.sysDescr = additionalInfo.sysDescr;
      } else {
        console.warn(`Device information retrieval failed for ${ip}:`, additionalInfo.error);
      }
    } catch (error) {
      console.warn(`Device information retrieval failed for ${ip}:`, error);
    }
    
    devices.push(newDevice);
  }
  
  updateProgress(`Scan complete. Found ${devices.length} device(s).`, 100);
  return devices;
}

/**
 * Generate a subset of IPs to scan for large subnets
 */
export function generateIPScanList(
  startOctets: number[],
  endOctets: number[],
  startIP: string,
  endIP: string,
  totalIPs: number,
  maskBits: number
): {
  ipsToScan: string[],
  ipCount: number
} {
  // For practical reasons, limit scanning to manageable ranges
  const maxIPsToScan = 254; // Maximum IPs to scan for performance
  let ipsToScan: string[] = [];
  
  // If there are too many IPs, create a representative sample
  if (totalIPs > maxIPsToScan && maskBits < 24) {
    console.log(`Subnet contains ${totalIPs} IPs, sampling ${maxIPsToScan}`);
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
    
    return { ipsToScan, ipCount: ipsToScan.length };
  } else {
    // For smaller subnets, scan all IPs
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
      console.log(`Subnet is too large, sampling ${maxIPsToScan} IPs`);
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
    
    return { ipsToScan, ipCount: ipsToScan.length };
  }
}

/**
 * Scan a network range (subnet)
 */
export async function scanNetworkRange(
  startOctets: number[],
  endOctets: number[],
  startIP: string,
  endIP: string,
  totalIPs: number,
  localIP: string,
  maskBits: number,
  cidr: string,
  updateProgress: (message: string, progress: number) => void,
  getDeviceInfo: (ip: string) => Promise<any>
): Promise<any[]> {
  const devices: any[] = [];
  
  updateProgress(`Beginning scan of subnet ${cidr}...`, 0);
  
  // Get the list of IPs to scan
  const { ipsToScan, ipCount } = generateIPScanList(
    startOctets, 
    endOctets, 
    startIP, 
    endIP, 
    totalIPs, 
    maskBits
  );
  
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
        confirmed: false,
        needs_verification: true,
        category: "Unknown",
        make: null,
        model: null,
        sysDescr: null,
        last_seen: new Date().toISOString()
      };
      
      // Try to get more device info
      try {
        const additionalInfo = await getDeviceInfo(ipAddress);
        
        if (!additionalInfo.error) {
          newDevice.hostname = additionalInfo.hostname;
          newDevice.make = additionalInfo.make;
          newDevice.model = additionalInfo.model;
          newDevice.category = additionalInfo.category;
          newDevice.sysDescr = additionalInfo.sysDescr;
        } else {
          console.warn(`Device information retrieval failed for ${ipAddress}:`, additionalInfo.error);
        }
      } catch (error) {
        console.warn(`Device information retrieval failed for ${ipAddress}:`, error);
      }
      
      devices.push(newDevice);
    }
    
    scannedCount++;
  }
  
  updateProgress(`Scan complete. Found ${devices.length} devices.`, 100);
  return devices;
}
