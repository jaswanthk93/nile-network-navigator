import { supabase } from "@/integrations/supabase/client";

// Helper function to parse CIDR notation and get IP information
export function parseCIDR(cidr: string) {
  const [baseIP, mask] = cidr.split('/');
  const maskBits = parseInt(mask);
  return { baseIP, maskBits };
}

// Convert IP address to numeric value for subnet comparison
function ipToLong(ip: string): number {
  const parts = ip.split('.');
  return (parseInt(parts[0]) << 24) | 
         (parseInt(parts[1]) << 16) | 
         (parseInt(parts[2]) << 8) | 
         parseInt(parts[3]);
}

// Check if IP is in the same subnet
function isInSameSubnet(ip1: string, ip2: string, maskBits: number): boolean {
  const ip1Long = ipToLong(ip1);
  const ip2Long = ipToLong(ip2);
  const mask = ~((1 << (32 - maskBits)) - 1);
  return (ip1Long & mask) === (ip2Long & mask);
}

// Expanded OUI prefixes for common network equipment manufacturers
const OUI_DATABASE: Record<string, string> = {
  // Cisco prefixes
  "00:00:0C": "Cisco",
  "00:01:42": "Cisco",
  "00:01:43": "Cisco",
  "00:01:97": "Cisco",
  "00:03:6B": "Cisco",
  "00:04:9A": "Cisco",
  "00:05:9A": "Cisco",
  "00:07:0D": "Cisco",
  "00:0A:8A": "Cisco",
  "00:0C:CE": "Cisco",
  "00:0E:08": "Cisco",
  "00:0E:38": "Cisco",
  "00:0F:23": "Cisco",
  "00:0F:34": "Cisco",
  "00:11:92": "Cisco",
  "00:12:7F": "Cisco",
  "00:12:80": "Cisco",
  "00:13:C4": "Cisco",
  "00:15:C6": "Cisco",
  "00:17:5A": "Cisco",
  "00:17:DF": "Cisco",
  "00:18:BA": "Cisco",
  "00:19:2F": "Cisco",
  "00:19:AA": "Cisco",
  "00:1A:2F": "Cisco",
  "00:1B:67": "Cisco",
  "00:1B:D4": "Cisco",
  "00:1B:D5": "Cisco",
  "00:1C:0F": "Cisco",
  "00:1C:57": "Cisco",
  "00:1C:58": "Cisco",
  "00:1E:13": "Cisco",
  "00:1E:14": "Cisco",
  "00:21:55": "Cisco",
  "00:21:A0": "Cisco",
  "00:22:6B": "Cisco",
  "00:24:98": "Cisco",
  "00:50:0F": "Cisco",
  "00:50:54": "Cisco",
  "00:50:F0": "Cisco",
  "00:60:09": "Cisco",
  "00:60:2F": "Cisco",
  "00:60:3E": "Cisco",
  "00:90:92": "Cisco",
  "00:90:AB": "Cisco",
  "00:90:F2": "Cisco",
  "00:D0:58": "Cisco",
  "00:D0:63": "Cisco",
  "00:D0:97": "Cisco",
  "00:D0:BA": "Cisco",
  "00:D0:BB": "Cisco",
  "00:D0:BC": "Cisco",
  "00:E0:14": "Cisco",
  "00:E0:1E": "Cisco",
  "00:E0:F7": "Cisco",
  "00:E0:F9": "Cisco",
  "00:E0:FE": "Cisco",
  "04:FE:7F": "Cisco",
  "08:96:AD": "Cisco",
  "30:37:A6": "Cisco",
  "3C:CE:73": "Cisco",
  "58:6D:8F": "Cisco",
  "5C:50:15": "Cisco",
  "64:9E:F3": "Cisco",
  "74:A0:2F": "Cisco",
  "A4:0C:C3": "Cisco",
  "C8:9C:1D": "Cisco",
  "D0:D0:FD": "Cisco",
  "FC:FB:FB": "Cisco",
  
  // Juniper prefixes
  "00:05:85": "Juniper",
  "00:10:DB": "Juniper",
  "00:12:1E": "Juniper",
  "00:14:F6": "Juniper",
  "00:19:E2": "Juniper",
  "00:1B:C0": "Juniper",
  "00:1F:12": "Juniper",
  "00:21:59": "Juniper",
  "00:22:83": "Juniper",
  "00:23:9C": "Juniper",
  "00:24:DC": "Juniper",
  "20:4E:71": "Juniper",
  "28:8A:1C": "Juniper",
  "28:C0:DA": "Juniper",
  "2C:21:31": "Juniper",
  "2C:6B:F5": "Juniper",
  "30:7C:5E": "Juniper",
  "3C:8A:B0": "Juniper",
  "3C:94:D5": "Juniper",
  "40:71:83": "Juniper",
  "4C:16:FC": "Juniper",
  "4C:96:14": "Juniper",
  "5C:45:27": "Juniper",
  "5C:5E:AB": "Juniper",
  "64:87:88": "Juniper",
  "78:19:F7": "Juniper",
  "84:18:88": "Juniper",
  
  // Aruba prefixes
  "00:0B:86": "Aruba",
  "00:1A:1E": "Aruba",
  "00:24:6C": "Aruba",
  "04:BD:88": "Aruba",
  "18:64:72": "Aruba",
  "20:4C:03": "Aruba",
  "24:77:03": "Aruba",
  "24:DE:C6": "Aruba",
  "64:E8:81": "Aruba",
  "70:3A:0E": "Aruba",
  "84:D4:7E": "Aruba",
  "94:B4:0F": "Aruba",
  "9C:1C:12": "Aruba",
  "AC:A3:1E": "Aruba",
  "D8:C7:C8": "Aruba",
  
  // HP/HPE prefixes
  "00:01:E7": "HP",
  "00:02:A5": "HP",
  "00:04:EA": "HP",
  "00:08:02": "HP",
  "00:0B:CD": "HP",
  "00:0D:9D": "HP",
  "00:10:83": "HP",
  "00:11:0A": "HP",
  "00:11:85": "HP",
  "00:12:79": "HP",
  "00:14:38": "HP",
  "00:15:60": "HP",
  "00:17:A4": "HP",
  "00:18:71": "HP",
  "00:1A:4B": "HP",
  "00:1B:78": "HP",
  "00:1C:C4": "HP",
  "00:1E:0B": "HP",
  "00:21:5A": "HP",
  "00:22:64": "HP",
  "00:23:7D": "HP",
  "00:24:A8": "HP",
  "00:25:B3": "HP",
  "00:26:55": "HP",
  "00:30:C1": "HP",
  "00:50:8B": "HP",
  "00:60:B0": "HP",
  "00:80:5F": "HP",
  "08:00:09": "HP",
  "10:1F:74": "HP",
  "14:58:D0": "HP",
  "1C:C1:DE": "HP",
  "24:BE:05": "HP",
  "2C:41:38": "HP",
  "2C:76:8A": "HP",
  "3C:D9:2B": "HP",
  "6C:C2:17": "HP",
  "80:C1:6E": "HP",
  "94:57:A5": "HP",
  "A0:D3:C1": "HP",
  "B8:AF:67": "HP",
  "B8:86:87": "HP",
  "C8:CB:B8": "HP",
  "CC:3E:5F": "HP",
  "D4:C9:EF": "HP",
  "E8:39:35": "HP",
  
  // Dell prefixes
  "00:08:74": "Dell",
  "00:0B:DB": "Dell",
  "00:11:43": "Dell",
  "00:12:3F": "Dell",
  "00:13:72": "Dell",
  "00:15:C5": "Dell",
  "00:18:8B": "Dell",
  "00:19:B9": "Dell",
  "00:1A:A0": "Dell",
  "00:1C:23": "Dell",
  "00:1D:09": "Dell",
  "00:21:70": "Dell",
  "00:21:9B": "Dell",
  "00:22:19": "Dell",
  "00:25:64": "Dell",
  "00:B0:D0": "Dell",
  "08:00:20": "Dell",
  "14:18:77": "Dell",
  "14:5A:05": "Dell",
  "18:03:73": "Dell",
  "18:FB:7B": "Dell",
  "24:B6:FD": "Dell",
  "28:F1:0E": "Dell",
  "50:9A:4C": "Dell",
  "5C:26:0A": "Dell",
  "84:2B:2B": "Dell",
  "A4:BA:DB": "Dell",
  "B8:AC:6F": "Dell",
  "BC:30:5B": "Dell",
  "BC:30:FB": "Dell",
  "D0:67:E5": "Dell",
  "D4:AE:52": "Dell",
  "E0:DB:55": "Dell",
  "F0:1F:AF": "Dell",
  "F8:B1:56": "Dell",
  "F8:DB:88": "Dell",
  
  // Huawei prefixes
  "00:18:82": "Huawei",
  "00:1E:10": "Huawei",
  "00:25:68": "Huawei",
  "00:25:9E": "Huawei",
  "00:34:FE": "Huawei",
  "00:46:4B": "Huawei",
  "00:5A:13": "Huawei",
  "00:66:4B": "Huawei",
  "00:9A:CD": "Huawei",
  "00:E0:FC": "Huawei",
  "04:25:C5": "Huawei",
  "04:F9:38": "Huawei",
  "08:19:A6": "Huawei",
  "08:63:61": "Huawei",
  "08:7A:4C": "Huawei",
  "0C:37:DC": "Huawei",
  "10:1B:54": "Huawei",
  "10:47:80": "Huawei",
  "10:C6:1F": "Huawei",
  "18:DE:D7": "Huawei",
  "20:0B:C7": "Huawei",
  "24:DB:AC": "Huawei",
  "28:31:52": "Huawei",
  "2C:9D:1E": "Huawei",
  "48:AD:08": "Huawei",
  "4C:B1:6C": "Huawei",
  "54:39:DF": "Huawei",
  "58:2A:F7": "Huawei",
  "5C:09:79": "Huawei",
  "5C:4C:A9": "Huawei",
  "60:DE:44": "Huawei",
  "70:54:F5": "Huawei",
  "78:D1:53": "Huawei",
  "7C:60:97": "Huawei",
  "80:71:1F": "Huawei",
  "80:B6:86": "Huawei",
  "AC:CF:85": "Huawei",
  "C4:FF:1F": "Huawei",
  "D4:40:F0": "Huawei",
  "D4:A1:48": "Huawei",
  "D4:B1:10": "Huawei",
  "E8:CD:2D": "Huawei",
  "EC:4D:47": "Huawei",
  "F4:55:9C": "Huawei",
  "F4:9F:F3": "Huawei",
  
  // Ubiquiti prefixes
  "00:15:6D": "Ubiquiti",
  "00:27:22": "Ubiquiti",
  "04:18:D6": "Ubiquiti",
  "18:E8:29": "Ubiquiti",
  "24:A4:3C": "Ubiquiti",
  "44:D9:E7": "Ubiquiti",
  "68:72:51": "Ubiquiti",
  "74:83:C2": "Ubiquiti",
  "78:8A:20": "Ubiquiti",
  "80:2A:A8": "Ubiquiti",
  "DC:9F:DB": "Ubiquiti",
  "FC:EC:DA": "Ubiquiti",
  
  // Ruckus prefixes
  "00:13:38": "Ruckus",
  "00:18:6E": "Ruckus",
  "00:22:7F": "Ruckus",
  "00:24:82": "Ruckus",
  "04:4F:AA": "Ruckus",
  "0C:F4:D5": "Ruckus",
  "24:C9:A1": "Ruckus",
  "50:A7:33": "Ruckus",
  "58:B6:33": "Ruckus",
  "68:92:34": "Ruckus",
  "6C:AA:B3": "Ruckus",
  "74:91:1A": "Ruckus",
  "AC:67:B2": "Ruckus",
  "C0:8A:DE": "Ruckus",
  "D4:68:4D": "Ruckus",
  "F0:3E:90": "Ruckus",
  
  // Meraki prefixes
  "00:18:0A": "Meraki",
  "58:8D:09": "Meraki",
  "88:15:44": "Meraki",
  "AC:17:C8": "Meraki",
  "D4:CA:6D": "Meraki",
  "D8:84:66": "Meraki",
  "E0:55:3D": "Meraki",
  
  // Extreme Networks prefixes
  "00:04:96": "Extreme",
  "00:0F:CB": "Extreme",
  "00:11:88": "Extreme",
  "00:13:65": "Extreme",
  "00:1F:45": "Extreme",
  "00:23:A2": "Extreme",
  "00:25:45": "Extreme",
  "00:E0:2B": "Extreme",
  "5C:CC:A0": "Extreme",
  "74:67:F7": "Extreme",
  "B8:26:D4": "Extreme",
  
  // FortiNet prefixes
  "00:09:0F": "Fortinet",
  "08:5B:0E": "Fortinet",
  "0C:17:F1": "Fortinet",
  "18:56:80": "Fortinet",
  "28:D0:7B": "Fortinet",
  "54:3C:8F": "Fortinet",
  "70:45:C9": "Fortinet",
  "90:6C:AC": "Fortinet",
  "94:5F:9D": "Fortinet",
  "B8:A3:86": "Fortinet",
  "E8:1C:BA": "Fortinet"
};

// Accurately identify device manufacturer from MAC address
// This should be called only when we've properly obtained a MAC address
export function identifyDeviceFromMAC(macAddress: string): string | null {
  if (!macAddress) return null;
  
  // Normalize MAC address format (remove separators and uppercase)
  const normalizedMAC = macAddress.toUpperCase().replace(/[^A-F0-9]/g, '');
  
  // Try different OUI lengths (most manufacturers use 6 characters/3 bytes)
  const ouiPrefixes = [
    normalizedMAC.substring(0, 6),  // First 3 bytes
    normalizedMAC.substring(0, 8),  // First 4 bytes (some manufacturers)
    normalizedMAC.substring(0, 10)  // First 5 bytes (some manufacturers)
  ];
  
  // Check OUI prefixes against our database
  for (const oui of ouiPrefixes) {
    for (const [prefix, manufacturer] of Object.entries(OUI_DATABASE)) {
      const normalizedPrefix = prefix.replace(/[^A-F0-9]/g, '');
      if (oui.startsWith(normalizedPrefix) || normalizedPrefix.startsWith(oui)) {
        return manufacturer;
      }
    }
  }
  
  return null;
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
  
  // Simulate reachability - in reality this would be an actual ping
  const isReachable = Math.random() > 0.3; // 70% chance the device is reachable
  
  if (!isReachable) {
    return { reachable: false, macAddress: null, isRouted };
  }
  
  // If traffic would be routed, we can't accurately determine the MAC
  if (isRouted) {
    console.log(`Routed traffic detected for ${ipAddress}. Cannot accurately determine MAC address.`);
    return { reachable: true, macAddress: null, isRouted: true };
  }
  
  // For non-routed traffic, we can simulate finding the actual MAC
  // In reality, this would come from an ARP table lookup
  const macBytes = [];
  
  // Create a deterministic but pseudo-random MAC based on IP just for simulation
  // This is only for simulation - in reality we would use actual ARP data
  const ipNum = ipToLong(ipAddress);
  const seed = ipNum % 1000;
  
  // Pick a random OUI from our database based on the seed
  const ouis = Object.keys(OUI_DATABASE);
  const selectedOUI = ouis[seed % ouis.length].replace(/:/g, '');
  
  // Format the MAC address properly with the OUI prefix
  const lastThreeBytes = [
    ((seed * 7) % 256).toString(16).padStart(2, '0'),
    ((seed * 13) % 256).toString(16).padStart(2, '0'),
    ((seed * 17) % 256).toString(16).padStart(2, '0')
  ];
  
  const fullMAC = `${selectedOUI.substring(0, 2)}:${selectedOUI.substring(2, 4)}:${selectedOUI.substring(4, 6)}:${lastThreeBytes[0]}:${lastThreeBytes[1]}:${lastThreeBytes[2]}`;
  
  return { reachable: true, macAddress: fullMAC, isRouted: false };
}

// Expanded device patterns - port and protocol patterns for device identification
const DEVICE_PATTERNS: Record<string, { type: string, patterns: string[] }> = {
  "Router": {
    type: "Router",
    patterns: ["23/tcp", "80/tcp", "443/tcp", "161/udp", "53/udp", "67/udp", "68/udp", "520/udp"]
  },
  "Switch": {
    type: "Switch",
    patterns: ["23/tcp", "22/tcp", "80/tcp", "443/tcp", "161/udp", "162/udp"]
  },
  "AP": {
    type: "AP",
    patterns: ["80/tcp", "443/tcp", "8080/tcp", "8443/tcp", "161/udp"]
  },
  "Firewall": {
    type: "Firewall",
    patterns: ["443/tcp", "8443/tcp", "161/udp", "500/udp", "4500/udp"]
  },
  "Server": {
    type: "Server",
    patterns: ["22/tcp", "80/tcp", "443/tcp", "3389/tcp", "5060/tcp"]
  }
};

// Determine device type based on ports and protocols (simulated)
export function determineDeviceType(ipAddress: string, make: string | null = null): string {
  // In a real implementation, this would scan for open ports
  // For now, use a heuristic approach based on IP and manufacturer
  const lastOctet = parseInt(ipAddress.split('.')[3]);
  
  // Use manufacturer to help guess device type if available
  if (make) {
    if (make === "Cisco" || make === "Juniper" || make === "Huawei") {
      if (lastOctet % 2 === 0) return "Router";
      if (lastOctet % 3 === 0) return "Switch";
      if (lastOctet % 5 === 0) return "Firewall";
    }
    
    if (make === "Aruba" || make === "Ubiquiti" || make === "Ruckus" || make === "Meraki") {
      return "AP";
    }
    
    if (make === "Dell" || make === "HP") {
      if (lastOctet % 7 === 0) return "Server";
      if (lastOctet % 5 === 0) return "Switch";
    }
    
    if (make === "Fortinet") {
      return "Firewall";
    }
  }
  
  // If we couldn't determine from make, use IP-based fallback
  if (lastOctet < 20) return "Router";
  if (lastOctet < 50) return "Switch";
  if (lastOctet < 100) return "Firewall";
  if (lastOctet < 150) return "AP";
  return "Unknown";
}

interface DiscoveredDevice {
  ip_address: string;
  hostname: string | null;
  mac_address: string | null;
  make: string | null;
  model: string | null;
  category: string | null;
  status: string;
  needs_verification: boolean;
}

// Function to discover devices in a subnet
export async function discoverDevicesInSubnet(
  cidr: string,
  updateProgress: (message: string, progress: number) => void
): Promise<DiscoveredDevice[]> {
  const { baseIP, maskBits } = parseCIDR(cidr);
  const devices: DiscoveredDevice[] = [];
  
  // Simulate local host IP - in reality this would be obtained from the system
  const localHostIP = "192.168.1.100"; // Simulated local IP of the machine running the app
  
  // If it's a /32, we're just checking a single IP
  if (maskBits === 32) {
    updateProgress(`Scanning ${baseIP}...`, 25);
    
    const { reachable, macAddress, isRouted } = simulatePingAndARPLookup(baseIP, localHostIP, maskBits);
    
    if (reachable) {
      const make = macAddress ? identifyDeviceFromMAC(macAddress) : null;
      const category = determineDeviceType(baseIP, make);
      
      updateProgress(`Device found at ${baseIP}`, 50);
      
      devices.push({
        ip_address: baseIP,
        hostname: `HOST-${baseIP.replace(/\./g, "-")}`,
        mac_address: macAddress,
        make,
        model: make ? `${make}-${Math.floor(1000 + Math.random() * 9000)}` : null,
        category,
        status: "online",
        needs_verification: isRouted || !macAddress
      });
    }
    
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
    
    // Simulate a network ping and ARP lookup
    const { reachable, macAddress, isRouted } = simulatePingAndARPLookup(ip, localHostIP, maskBits);
    
    if (reachable) {
      const make = macAddress ? identifyDeviceFromMAC(macAddress) : null;
      const category = determineDeviceType(ip, make);
      
      devices.push({
        ip_address: ip,
        hostname: `HOST-${ip.replace(/\./g, "-")}`,
        mac_address: macAddress,
        make,
        model: make ? `${make}-${Math.floor(1000 + Math.random() * 9000)}` : null,
        category,
        status: "online",
        needs_verification: isRouted || !macAddress
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
    mac_address: device.mac_address,
    needs_verification: device.needs_verification
  }));
  
  const { error } = await supabase
    .from('devices')
    .insert(devicesToInsert);
    
  return { error };
}
