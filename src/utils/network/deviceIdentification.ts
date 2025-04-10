
/**
 * Device identification utilities for network discovery
 */

// Manufacturer lookup based on SNMP sysObjectID
export const OID_MANUFACTURER_MAP: Record<string, string> = {
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

// SNMP OIDs for device information
export const SNMP_OIDS = {
  sysDescr: "1.3.6.1.2.1.1.1.0",
  sysName: "1.3.6.1.2.1.1.5.0",
  sysLocation: "1.3.6.1.2.1.1.6.0",
  sysContact: "1.3.6.1.2.1.1.4.0",
  sysObjectID: "1.3.6.1.2.1.1.2.0",
  sysUpTime: "1.3.6.1.2.1.1.3.0",
  ifNumber: "1.3.6.1.2.1.2.1.0",
  ifDescr: "1.3.6.1.2.1.2.2.1.2"
};

// Get manufacturer from sysObjectID
export function getManufacturerFromOID(sysObjectID: string): string | null {
  for (const [oidPrefix, manufacturer] of Object.entries(OID_MANUFACTURER_MAP)) {
    if (sysObjectID.startsWith(oidPrefix)) {
      return manufacturer;
    }
  }
  return null;
}

// Parse model information from SNMP data
export function parseModelFromSNMP(sysDescr: string, manufacturer: string | null): string | null {
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

// Determine device type from SNMP information
export function determineDeviceTypeFromSNMP(sysDescr: string, sysObjectID: string): string {
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
