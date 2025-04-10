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

// SNMP OIDs for device information
const SNMP_OIDS = {
  sysDescr: "1.3.6.1.2.1.1.1.0",
  sysName: "1.3.6.1.2.1.1.5.0",
  sysLocation: "1.3.6.1.2.1.1.6.0",
  sysContact: "1.3.6.1.2.1.1.4.0",
  sysObjectID: "1.3.6.1.2.1.1.2.0",
  sysUpTime: "1.3.6.1.2.1.1.3.0",
  ifNumber: "1.3.6.1.2.1.2.1.0",
  ifDescr: "1.3.6.1.2.1.2.2.1.2"
};

// Manufacturer lookup based on SNMP sysObjectID
const OID_MANUFACTURER_MAP: Record<string, string> = {
  "1.3.6.1.4.1.9.": "Cisco",
  "1.3.6.1.4.1.2636.": "Juniper",
  "1.3.6.1.4.1.4526.": "Aruba",
  "1.3.6.1.4.1.11.": "HP",
  "1.3.6.1.4.1.171.": "D-Link",
  "1.3.6.1.4.1.1916.": "Extreme",
  "1.3.6.1.4.1.6889.": "Avaya",
  "1.3.6.1.4.1.890.": "Zyxel",
  "1.3.6.1.4.1.3375.": "F5",
  "1.3.6.1.4.1.12356.": "Fortinet",
  "1.3.6.1.4.1.14988.": "Mikrotik",
  "1.3.6.1.4.1.25461.": "Palo Alto",
  "1.3.6.1.4.1.1991.": "Brocade",
};

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
  
  // IMPORTANT FIX: In our simulation, always consider the device reachable
  // In a real implementation, this would be the result of an actual ping
  const isReachable = true; // Changed from random to always true
  
  if (!isReachable) {
    return { reachable: false, macAddress: null, isRouted };
  }
  
  // If traffic would be routed, we can't accurately determine the MAC but the device is still discoverable
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

// Determine device type based on SNMP information
function determineDeviceTypeFromSNMP(sysDescr: string, sysObjectID: string): string {
  // First check based on sysObjectID which is often most reliable
  if (sysObjectID) {
    if (sysObjectID.includes("1.3.6.1.4.1.9.1.516") || 
        sysObjectID.includes("1.3.6.1.4.1.9.1.1745")) return "Switch";
    if (sysObjectID.includes("1.3.6.1.4.1.9.1.525") || 
        sysObjectID.includes("1.3.6.1.4.1.9.1.1639")) return "Router";
    if (sysObjectID.includes("1.3.6.1.4.1.9.1.525")) return "AP";
    if (sysObjectID.includes("1.3.6.1.4.1.9.1.1250") || 
        sysObjectID.includes("1.3.6.1.4.1.12356.101.1")) return "Firewall";
  }

  // Then check based on sysDescr text patterns
  if (sysDescr) {
    const descLower = sysDescr.toLowerCase();
    if (descLower.includes("switch") || 
        descLower.includes("catalyst") || 
        descLower.includes("nexus")) return "Switch";
    if (descLower.includes("router") || 
        descLower.includes("isr") || 
        descLower.includes("asr")) return "Router";
    if (descLower.includes("wireless") || 
        descLower.includes("access point") || 
        descLower.includes("aironet")) return "AP";
    if (descLower.includes("firewall") || 
        descLower.includes("asa") || 
        descLower.includes("fortigate")) return "Firewall";
    if (descLower.includes("controller")) return "Controller";
  }

  return "Other";
}

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

// Get manufacturer from sysObjectID
function getManufacturerFromOID(sysObjectID: string): string | null {
  for (const [oidPrefix, manufacturer] of Object.entries(OID_MANUFACTURER_MAP)) {
    if (sysObjectID.startsWith(oidPrefix)) {
      return manufacturer;
    }
  }
  return null;
}

// Parse model information from SNMP data
function parseModelFromSNMP(sysDescr: string, manufacturer: string | null): string | null {
  if (!sysDescr) return null;
  
  // Different parsing strategies based on manufacturer
  if (manufacturer === "Cisco") {
    // Extract model from Cisco descriptions like "Cisco IOS Software, C2960 Software..."
    const ciscoModelRegex = /C\d+|CSR\d+|ASR\d+|ISR\d+|Nexus \d+|WS-\w+/i;
    const match = sysDescr.match(ciscoModelRegex);
    return match ? match[0] : null;
  } else if (manufacturer === "Juniper") {
    // Extract model from Juniper descriptions
    const juniperModelRegex = /srx\d+|ex\d+|mx\d+|qfx\d+/i;
    const match = sysDescr.match(juniperModelRegex);
    return match ? match[0].toUpperCase() : null;
  } else if (manufacturer === "HP" || manufacturer === "Aruba") {
    // Extract model from HP descriptions
    const hpModelRegex = /\b[A-Z]\d{4}[A-Z]?\b|\bJ\d{4}[A-Z]\b/;
    const match = sysDescr.match(hpModelRegex);
    return match ? match[0] : null;
  }
  
  // Generic fallback - try to find any model-like pattern
  const genericModelRegex = /[A-Z0-9]+-[A-Z0-9]+/;
  const match = sysDescr.match(genericModelRegex);
  return match ? match[0] : null;
}

// Use SNMP to get device information
async function getDeviceInfoViaSNMP(
  ipAddress: string, 
  updateProgress: (message: string, progress: number) => void
): Promise<{
  hostname: string | null;
  make: string | null;
  model: string | null;
  category: string | null;
}> {
  try {
    updateProgress(`Retrieving SNMP information from ${ipAddress}...`, 1);
    
    // In a real implementation, we would use actual SNMP queries
    // For now, we'll simulate this with some sample data
    const sysName = `Device-${ipAddress.split('.').join('-')}`;
    const sysDescr = `Cisco IOS Software, C2960 Software (C2960-LANBASEK9-M), Version 15.0(2)SE, RELEASE SOFTWARE (fc1)`;
    const sysObjectID = "1.3.6.1.4.1.9.1.716"; // Cisco 2960
    
    // Extract manufacturer from OID
    const make = getManufacturerFromOID(sysObjectID);
    
    // Extract model from system description
    const model = parseModelFromSNMP(sysDescr, make);
    
    // Determine device type/category
    const category = determineDeviceTypeFromSNMP(sysDescr, sysObjectID);
    
    updateProgress(`SNMP information retrieved from ${ipAddress}`, 3);
    
    return {
      hostname: sysName,
      make,
      model,
      category
    };
  } catch (error) {
    console.error(`Error getting SNMP info from ${ipAddress}:`, error);
    return {
      hostname: null,
      make: null,
      model: null,
      category: null
    };
  }
}

// Function to discover devices in a subnet and gather information about them
export async function discoverDevicesInSubnet(
  cidr: string,
  updateProgress: (message: string, progress: number) => void
): Promise<any[]> {
  const devices: any[] = [];
  const { baseIP, maskBits } = parseCIDR(cidr);
  
  // Parse the base IP components and calculate network range
  const ipParts = baseIP.split('.');
  const ipPrefix = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
  
  // Get our local IP address for subnet calculation
  // In browser, we can't directly get the client's IP, so we'll use the base IP as a proxy
  const localIP = baseIP;
  
  // We'll scan a limited range in the last octet (1-254) to avoid timeouts
  // In a real implementation, this would be more comprehensive
  const startRange = 1;
  const endRange = 254;
  const ipCount = endRange - startRange + 1;
  let scannedCount = 0;
  
  updateProgress(`Beginning scan of subnet ${cidr}...`, 0);
  
  for (let i = startRange; i <= endRange; i++) {
    const ipAddress = `${ipPrefix}.${i}`;
    
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
      // This should only be used when we have a backend agent capable of SNMP
      try {
        const snmpInfo = await getDeviceInfoViaSNMP(ipAddress, updateProgress);
        
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

// Function to save discovered devices to the database
export async function saveDiscoveredDevices(
  devices: any[],
  siteId: string,
  subnetId: string,
  userId: string
): Promise<{ error: Error | null }> {
  try {
    // For each device, write to the database
    for (const device of devices) {
      // Add site_id, subnet_id, and user_id to each device record
      const deviceRecord = {
        ...device,
        site_id: siteId,
        subnet_id: subnetId,
        user_id: userId
      };
      
      // Insert the device record
      const { error } = await supabase
        .from('devices')
        .insert(deviceRecord);
      
      if (error) {
        console.error('Error inserting device:', error);
        return { error };
      }
    }
    
    return { error: null };
  } catch (error) {
    console.error('Error saving devices:', error);
    return { error: error instanceof Error ? error : new Error('Unknown error saving devices') };
  }
}
