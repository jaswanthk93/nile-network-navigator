
/**
 * Network IP address utilities
 */

import { OUI_DATABASE } from './deviceIdentification';

// Helper function to parse CIDR notation and get IP information
export function parseCIDR(cidr: string) {
  const [baseIP, mask] = cidr.split('/');
  const maskBits = parseInt(mask);
  return { baseIP, maskBits };
}

// Convert IP address to numeric value for subnet comparison
export function ipToLong(ip: string): number {
  const parts = ip.split('.');
  return (parseInt(parts[0]) << 24) | 
         (parseInt(parts[1]) << 16) | 
         (parseInt(parts[2]) << 8) | 
         parseInt(parts[3]);
}

// Convert long number to IP address string
export function longToIp(ipLong: number): string {
  return [
    (ipLong >>> 24) & 255,
    (ipLong >>> 16) & 255,
    (ipLong >>> 8) & 255,
    ipLong & 255
  ].join('.');
}

// Check if IP is in the same subnet
export function isInSameSubnet(ip1: string, ip2: string, maskBits: number): boolean {
  const ip1Long = ipToLong(ip1);
  const ip2Long = ipToLong(ip2);
  const mask = ~((1 << (32 - maskBits)) - 1);
  return (ip1Long & mask) === (ip2Long & mask);
}

// Calculate IP range for scanning based on subnet mask
export function getIPRange(cidr: string): { startIP: string, endIP: string, totalIPs: number, baseIP: string, maskBits: number } {
  const { baseIP, maskBits } = parseCIDR(cidr);
  const ipLong = ipToLong(baseIP);
  
  // For /32, we should only scan the exact IP
  if (maskBits === 32) {
    return {
      startIP: baseIP,
      endIP: baseIP,
      totalIPs: 1,
      baseIP,
      maskBits
    };
  }
  
  // For other subnets, calculate the range
  const hostBits = 32 - maskBits;
  const netmask = ~((1 << hostBits) - 1) >>> 0;
  const network = ipLong & netmask;
  const broadcast = network | ((1 << hostBits) - 1);
  
  // Calculate usable range (excluding network and broadcast for traditional subnets)
  let firstUsable = network;
  let lastUsable = broadcast;
  
  // For normal subnets (not /31 or /32), exclude network and broadcast addresses
  if (maskBits < 31) {
    firstUsable = network + 1;
    lastUsable = broadcast - 1;
  }
  
  return {
    startIP: longToIp(firstUsable),
    endIP: longToIp(lastUsable),
    totalIPs: lastUsable - firstUsable + 1,
    baseIP,
    maskBits
  };
}

// Simulate ping and ARP lookup - in a real implementation this would use actual network calls
// This has been modified to consider subnet boundaries
export function simulatePingAndARPLookup(ipAddress: string, localIP: string, subnetMask: number): { 
  reachable: boolean, 
  macAddress: string | null,
  isRouted: boolean 
} {
  // Determine if this would be a routed request
  const isRouted = !isInSameSubnet(ipAddress, localIP, subnetMask);
  
  // In our simulation, always consider the device reachable
  const isReachable = true;
  
  if (!isReachable) {
    return { reachable: false, macAddress: null, isRouted };
  }
  
  // If traffic would be routed, we can't accurately determine the MAC but the device is still discoverable
  if (isRouted) {
    console.log(`Routed traffic detected for ${ipAddress}. Cannot accurately determine MAC address.`);
    return { reachable: true, macAddress: null, isRouted: true };
  }
  
  // For non-routed traffic, we can simulate finding the actual MAC
  const ipNum = ipToLong(ipAddress);
  const seed = ipNum % 1000;
  
  // Generate a deterministic MAC address based on the IP for consistency
  // Use specific OUI ranges for specific devices to prevent misidentification
  // Cisco devices often have IPs ending in .1, .100, .254, etc.
  const lastOctet = parseInt(ipAddress.split('.')[3]);
  
  let manufacturerOUIs = Object.keys(OUI_DATABASE).filter(oui => OUI_DATABASE[oui] === "Cisco");
  
  // Use IP characteristics to bias towards correct manufacturer
  // This is a heuristic approach to improve simulation accuracy
  if (lastOctet === 1 || lastOctet === 254 || lastOctet % 10 === 0) {
    // These are likely network infrastructure devices (routers, core switches) - use Cisco OUIs
    manufacturerOUIs = Object.keys(OUI_DATABASE).filter(oui => OUI_DATABASE[oui] === "Cisco");
  } else if (lastOctet >= 200 && lastOctet < 254) {
    // These might be wireless devices - higher chance of being Aruba or similar
    manufacturerOUIs = Object.keys(OUI_DATABASE).filter(oui => 
      ["Aruba", "Cisco", "Ubiquiti", "Ruckus", "Meraki"].includes(OUI_DATABASE[oui])
    );
  }
  
  // If we don't have any specific OUIs for the manufacturer, use all OUIs
  if (manufacturerOUIs.length === 0) {
    manufacturerOUIs = Object.keys(OUI_DATABASE);
  }
  
  // Pick a random OUI from our database based on the seed
  const selectedOUI = manufacturerOUIs[seed % manufacturerOUIs.length].replace(/:/g, '');
  
  // Format the MAC address properly with the OUI prefix
  const lastThreeBytes = [
    ((seed * 7) % 256).toString(16).padStart(2, '0'),
    ((seed * 13) % 256).toString(16).padStart(2, '0'),
    ((seed * 17) % 256).toString(16).padStart(2, '0')
  ];
  
  const fullMAC = `${selectedOUI.substring(0, 2)}:${selectedOUI.substring(2, 4)}:${selectedOUI.substring(4, 6)}:${lastThreeBytes[0]}:${lastThreeBytes[1]}:${lastThreeBytes[2]}`;
  
  return { reachable: true, macAddress: fullMAC, isRouted: false };
}
