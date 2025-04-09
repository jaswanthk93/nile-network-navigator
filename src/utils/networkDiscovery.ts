
import { supabase } from "@/integrations/supabase/client";

// Helper function to parse CIDR notation and get IP information
export function parseCIDR(cidr: string) {
  const [baseIP, mask] = cidr.split('/');
  const maskBits = parseInt(mask);
  return { baseIP, maskBits };
}

// OUI prefixes for common network equipment manufacturers
// This is a simplified version - a real implementation would use a complete database
const OUI_DATABASE: Record<string, string> = {
  "00:00:0C": "Cisco",
  "00:1B:67": "Cisco",
  "00:1E:13": "Cisco",
  "00:05:85": "Juniper",
  "00:19:E2": "Juniper",
  "2C:6B:F5": "Juniper",
  "24:B6:FD": "Aruba",
  "94:B4:0F": "Aruba",
  "00:0E:8E": "SparkLAN",
  "00:26:F1": "HP",
  "B8:AF:67": "HP",
  "80:C1:6E": "HP",
};

// Function to identify device manufacturer from MAC address
export function identifyDeviceFromMAC(macAddress: string): string | null {
  if (!macAddress) return null;
  
  // Normalize MAC address format
  const normalizedMAC = macAddress.toUpperCase().replace(/[^A-F0-9]/g, '');
  
  // Check OUI prefixes (first 6 characters of MAC address)
  const oui = normalizedMAC.substring(0, 6);
  for (const [prefix, manufacturer] of Object.entries(OUI_DATABASE)) {
    if (prefix.replace(/[^A-F0-9]/g, '').startsWith(oui)) {
      return manufacturer;
    }
  }
  
  return null;
}

// Generate possible MAC address for an IP (simulation)
// In a real implementation, this would use ARP tables or similar
export function simulateARPLookup(ipAddress: string): string {
  // Create a deterministic but random-looking MAC based on IP
  // This is just for simulation purposes
  const ipParts = ipAddress.split('.').map(part => parseInt(part));
  const macParts: string[] = [];
  
  // Use some popular OUIs for the first part to get realistic manufacturer identification
  const popularOUIs = Object.keys(OUI_DATABASE);
  const ipSum = ipParts.reduce((sum, part) => sum + part, 0);
  const selectedOUI = popularOUIs[ipSum % popularOUIs.length].replace(/:/g, '');
  
  macParts.push(selectedOUI);
  
  // Generate the rest of the MAC address based on IP
  const lastThreeBytes = [
    ((ipParts[1] * 7) % 256).toString(16).padStart(2, '0'),
    ((ipParts[2] * 13) % 256).toString(16).padStart(2, '0'),
    ((ipParts[3] * 17) % 256).toString(16).padStart(2, '0')
  ];
  
  const fullMAC = `${selectedOUI.substring(0, 2)}:${selectedOUI.substring(2, 4)}:${selectedOUI.substring(4, 6)}:${lastThreeBytes[0]}:${lastThreeBytes[1]}:${lastThreeBytes[2]}`;
  return fullMAC;
}

// Determine device type based on ports and protocols (simulated)
export function determineDeviceType(ipAddress: string): string {
  // In reality, you would check for open ports, protocols, etc.
  // This is a simplified simulation based on the IP address
  const lastOctet = parseInt(ipAddress.split('.')[3]);
  
  // Just a deterministic way to assign device types for simulation
  if (lastOctet % 5 === 0) return "Router";
  if (lastOctet % 3 === 0) return "Switch";
  if (lastOctet % 2 === 0) return "AP";
  return "Unknown";
}

interface DiscoveredDevice {
  ip_address: string;
  hostname: string | null;
  mac_address: string;
  make: string | null;
  model: string | null;
  category: string | null;
  status: string;
}

// Function to discover devices in a subnet
export async function discoverDevicesInSubnet(
  cidr: string,
  updateProgress: (message: string, progress: number) => void
): Promise<DiscoveredDevice[]> {
  const { baseIP, maskBits } = parseCIDR(cidr);
  const devices: DiscoveredDevice[] = [];
  
  // If it's a /32, we're just checking a single IP
  if (maskBits === 32) {
    updateProgress(`Scanning ${baseIP}...`, 25);
    const macAddress = simulateARPLookup(baseIP);
    const make = identifyDeviceFromMAC(macAddress);
    const category = determineDeviceType(baseIP);
    
    updateProgress(`Device found at ${baseIP}`, 50);
    
    devices.push({
      ip_address: baseIP,
      hostname: `HOST-${baseIP.replace(/\./g, "-")}`,
      mac_address: macAddress,
      make,
      model: make ? `${make}-${Math.floor(1000 + Math.random() * 9000)}` : null,
      category,
      status: "online"
    });
    
    updateProgress(`Completed scan of ${baseIP}`, 100);
    return devices;
  }
  
  // For other subnet sizes, determine how many IPs to scan
  // In a real implementation, you would scan the entire subnet
  const ipCount = Math.min(Math.pow(2, 32 - maskBits), 254);
  
  // For demonstration, we'll just scan a few IPs
  const baseParts = baseIP.split('.');
  const baseNum = parseInt(baseParts[3]);
  
  for (let i = 0; i < Math.min(ipCount, 10); i++) {
    const lastOctet = (baseNum + i) % 256;
    const ip = `${baseParts[0]}.${baseParts[1]}.${baseParts[2]}.${lastOctet}`;
    
    updateProgress(`Scanning ${ip} (${i+1}/${Math.min(ipCount, 10)})...`, Math.min(25 + (i * 75 / Math.min(ipCount, 10)), 95));
    
    // Simulate a scan - in reality, this would be an actual network probe
    const isReachable = Math.random() > 0.3; // 70% chance the device is reachable
    
    if (isReachable) {
      const macAddress = simulateARPLookup(ip);
      const make = identifyDeviceFromMAC(macAddress);
      const category = determineDeviceType(ip);
      
      devices.push({
        ip_address: ip,
        hostname: `HOST-${ip.replace(/\./g, "-")}`,
        mac_address: macAddress,
        make,
        model: make ? `${make}-${Math.floor(1000 + Math.random() * 9000)}` : null,
        category,
        status: "online"
      });
    }
  }
  
  updateProgress(`Completed scan. Found ${devices.length} devices.`, 100);
  return devices;
}

// Save discovered devices to the database
export async function saveDiscoveredDevices(
  devices: DiscoveredDevice[],
  siteId: string,
  subnetId: string,
  userId: string
) {
  const devicesToInsert = devices.map(device => ({
    site_id: siteId,
    subnet_id: subnetId,
    user_id: userId,
    ip_address: device.ip_address,
    hostname: device.hostname,
    make: device.make,
    model: device.model,
    category: device.category,
    status: device.status,
    mac_address: device.mac_address
  }));
  
  const { error } = await supabase
    .from('devices')
    .insert(devicesToInsert);
    
  return { error };
}
