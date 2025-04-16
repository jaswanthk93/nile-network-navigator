
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
  ifDescr: "1.3.6.1.2.1.2.2.1.2",
  entityPhysicalName: "1.3.6.1.2.1.47.1.1.1.1.13",
  // Enhanced OIDs for better device type identification
  ifType: "1.3.6.1.2.1.2.2.1.3",
  entPhysicalClass: "1.3.6.1.2.1.47.1.1.1.1.5",
  entPhysicalDescr: "1.3.6.1.2.1.47.1.1.1.1.2"
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

// New function: Extract exact model from Entity MIB response
export function getExactModelFromEntityMIB(entityMIBData: Record<string, string>): string | null {
  if (!entityMIBData || Object.keys(entityMIBData).length === 0) {
    return null;
  }
  
  // Sort the OIDs to process them in order (lower indices first)
  const sortedOids = Object.keys(entityMIBData).sort();
  
  // Check the first few entries for a non-empty model string
  for (const oid of sortedOids.slice(0, 5)) { // Only check first 5 entries
    const value = entityMIBData[oid]?.trim();
    if (value && value.length > 0 && value !== '""') {
      // For Cisco WS-C format models, return as is
      if (value.startsWith('WS-C') || value.startsWith('C')) {
        return value.trim();
      }
    }
  }
  
  return null;
}

// Enhanced function for determining device type with improved detection logic
export function determineDeviceTypeFromSNMP(sysDescr: string, sysObjectID: string): string {
  // First check based on sysObjectID which is often most reliable
  if (sysObjectID) {
    // Enhanced Cisco device type detection
    if (sysObjectID.includes("1.3.6.1.4.1.9.1.516") || 
        sysObjectID.includes("1.3.6.1.4.1.9.1.1745") ||
        sysObjectID.includes("1.3.6.1.4.1.9.1.1296") || // Catalyst 2960
        sysObjectID.includes("1.3.6.1.4.1.9.1.2067")) { // Catalyst 3850
      return "Switch";
    }
    
    if (sysObjectID.includes("1.3.6.1.4.1.9.1.525") || 
        sysObjectID.includes("1.3.6.1.4.1.9.1.1639") ||
        sysObjectID.includes("1.3.6.1.4.1.9.1.1290")) { // ISR 4000 series
      return "Router";
    }
    
    if (sysObjectID.includes("1.3.6.1.4.1.9.1.1372") || // Cisco Aironet 3700
        sysObjectID.includes("1.3.6.1.4.1.9.1.1158") || // Cisco Aironet 1140
        sysObjectID.includes("1.3.6.1.4.1.9.1.525")) { 
      return "AP";
    }
    
    if (sysObjectID.includes("1.3.6.1.4.1.9.1.1250") || 
        sysObjectID.includes("1.3.6.1.4.1.12356.101.1") ||
        sysObjectID.includes("1.3.6.1.4.1.9.1.1902")) { // ASA 5545-X
      return "Firewall";
    }
    
    // Juniper device detection
    if (sysObjectID.includes("1.3.6.1.4.1.2636.1.1.1.2")) { // Juniper MX
      return "Router";
    }
    
    if (sysObjectID.includes("1.3.6.1.4.1.2636.1.1.1.2.31")) { // Juniper EX
      return "Switch";
    }
    
    if (sysObjectID.includes("1.3.6.1.4.1.2636.1.1.1.2.39")) { // Juniper SRX
      return "Firewall";
    }
    
    // HP/Aruba device detection
    if (sysObjectID.includes("1.3.6.1.4.1.11.2.3.7.11")) { // HP ProCurve
      return "Switch";
    }
    
    if (sysObjectID.includes("1.3.6.1.4.1.4526.100")) { // Aruba Wireless
      return "AP";
    }
  }

  // Then check based on sysDescr text patterns - improved to catch more device types
  if (sysDescr) {
    const descLower = sysDescr.toLowerCase();
    
    // Enhanced switch detection
    if (descLower.includes("switch") || 
        descLower.includes("catalyst") || 
        descLower.includes("nexus") ||
        descLower.includes("c2960") ||
        descLower.includes("c3750") ||
        descLower.includes("c3850") ||
        descLower.includes("procurve") ||
        descLower.includes("comware") ||
        descLower.includes("3com") ||
        descLower.includes("ws-c")) {
      return "Switch";
    }
    
    // Enhanced router detection
    if (descLower.includes("router") || 
        descLower.includes("isr") || 
        descLower.includes("asr") ||
        descLower.includes("1900 series") ||
        descLower.includes("2900 series") ||
        descLower.includes("7200 series") ||
        descLower.includes("routing")) {
      return "Router";
    }
    
    // Enhanced AP detection
    if (descLower.includes("wireless") || 
        descLower.includes("access point") || 
        descLower.includes("aironet") ||
        descLower.includes("ap") ||
        descLower.includes("wap") ||
        descLower.includes("wifi")) {
      return "AP";
    }
    
    // Enhanced firewall detection
    if (descLower.includes("firewall") || 
        descLower.includes("asa") || 
        descLower.includes("fortigate") ||
        descLower.includes("checkpoint") ||
        descLower.includes("palo alto") ||
        descLower.includes("security appliance") ||
        descLower.includes("srx")) {
      return "Firewall";
    }
    
    // Enhanced controller detection
    if (descLower.includes("controller") ||
        descLower.includes("wlc") ||
        descLower.includes("wireless lan controller") ||
        descLower.includes("mobility controller")) {
      return "Controller";
    }
    
    // Enhanced server detection
    if (descLower.includes("server") ||
        descLower.includes("ucs") ||
        descLower.includes("poweredge") ||
        descLower.includes("proliant")) {
      return "Server";
    }
  }

  return "Other";
}

// New function: Create a map of interface types based on SNMP ifType values
export function getInterfaceTypes(ifTypeData: Record<string, number>): Record<string, string> {
  const interfaceTypeMap: Record<number, string> = {
    1: "Other",
    6: "Ethernet",
    7: "ISDN",
    23: "PPP",
    24: "Loopback",
    53: "Virtual",
    131: "Tunnel",
    135: "L2VLAN",
    136: "L3VLAN",
    150: "MPLS",
    161: "IEEE 802.11"
  };
  
  const result: Record<string, string> = {};
  
  for (const [oid, typeValue] of Object.entries(ifTypeData)) {
    result[oid] = interfaceTypeMap[typeValue] || "Unknown";
  }
  
  return result;
}

// New function: Determine device category from multiple data sources
export function determineDeviceCategory(sysDescr: string, sysObjectID: string, entityData?: Record<string, any>): string {
  // Start with basic device type from SNMP
  let category = determineDeviceTypeFromSNMP(sysDescr, sysObjectID);
  
  // If we have entity data, try to make a more precise determination
  if (entityData && Object.keys(entityData).length > 0) {
    // Check if we have physical class data which can tell us chassis type
    const physicalClassData = entityData.entPhysicalClass || {};
    
    // Look for chassis (3) or module (9) entries
    const chassisEntries = Object.entries(physicalClassData).filter(([_, value]) => value === 3);
    const moduleEntries = Object.entries(physicalClassData).filter(([_, value]) => value === 9);
    
    if (chassisEntries.length > 0) {
      // Get descriptions for chassis entries
      const chassisDescriptions = chassisEntries.map(([oid, _]) => {
        const descOid = oid.replace('.5.', '.2.'); // Convert class OID to description OID
        return entityData.entPhysicalDescr?.[descOid];
      }).filter(Boolean);
      
      // Look for specific terms in chassis descriptions
      const descText = chassisDescriptions.join(' ').toLowerCase();
      
      if (descText.includes('router') || descText.includes('routing')) {
        category = 'Router';
      } else if (descText.includes('switch')) {
        category = 'Switch';
      } else if (descText.includes('firewall') || descText.includes('security')) {
        category = 'Firewall';
      } else if (descText.includes('access point') || descText.includes('wireless')) {
        category = 'AP';
      }
    }
    
    // If we have a lot of modules, it's probably a modular switch or router
    if (moduleEntries.length > 3 && category === 'Other') {
      // Check module descriptions
      const moduleDescs = moduleEntries.map(([oid, _]) => {
        const descOid = oid.replace('.5.', '.2.');
        return entityData.entPhysicalDescr?.[descOid];
      }).filter(Boolean).join(' ').toLowerCase();
      
      if (moduleDescs.includes('line card') || moduleDescs.includes('supervisor')) {
        category = 'Switch';
      } else if (moduleDescs.includes('router') || moduleDescs.includes('routing')) {
        category = 'Router';
      }
    }
  }
  
  return category;
}
