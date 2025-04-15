
const snmp = require('net-snmp');

/**
 * Discover device information using SNMP
 * @param {string} ip - The IP address of the device
 * @param {string} community - The SNMP community string
 * @param {string} version - The SNMP version
 * @returns {Object} - Object containing device information
 */
exports.discoverDeviceInfo = async (ip, community = 'public', version = '2c') => {
  // Create a temporary session for discovery
  const snmpVersion = version === '1' ? snmp.Version1 : snmp.Version2c;
  const session = snmp.createSession(ip, community, {
    version: snmpVersion,
    retries: 1,
    timeout: 5000
  });
  
  // Key OIDs for device identification - only the essentials
  const oids = [
    "1.3.6.1.2.1.1.1.0",  // sysDescr
    "1.3.6.1.2.1.1.2.0",  // sysObjectID
    "1.3.6.1.2.1.1.5.0",  // sysName
    "1.3.6.1.2.1.1.6.0",  // sysLocation
  ];
  
  try {
    // Get system information with a targeted, focused query
    const deviceInfo = {};
    logger.info(`[SNMP] STRICT GET: Executing device info query for IP ${ip} with ONLY the following specific OIDs:`);
    logger.info(`[SNMP] STRICT GET: 1. sysDescr: 1.3.6.1.2.1.1.1.0`);
    logger.info(`[SNMP] STRICT GET: 2. sysObjectID: 1.3.6.1.2.1.1.2.0`);
    logger.info(`[SNMP] STRICT GET: 3. sysName: 1.3.6.1.2.1.1.5.0`);
    logger.info(`[SNMP] STRICT GET: 4. sysLocation: 1.3.6.1.2.1.1.6.0`);
    logger.info(`[SNMP] Command equivalent: snmpget -v${version} -c ${community} ${ip} ${oids.join(' ')}`);
    
    await new Promise((resolve, reject) => {
      session.get(oids, (error, varbinds) => {
        if (error) {
          logger.error(`[SNMP] Error getting device info for ${ip}: ${error.message}`);
          return reject(error);
        }
        
        for (let i = 0; i < varbinds.length; i++) {
          if (snmp.isVarbindError(varbinds[i])) {
            logger.warn(`[SNMP] Error for OID ${oids[i]}: ${snmp.varbindError(varbinds[i])}`);
            continue;
          }
          
          const value = varbinds[i].value;
          let parsedValue = null;
          
          if (Buffer.isBuffer(value)) {
            parsedValue = value.toString();
          } else {
            parsedValue = value;
          }
          
          // Log the raw SNMP response
          const oidName = getOidName(oids[i]);
          const valueType = Buffer.isBuffer(value) ? "STRING" : "INTEGER";
          logger.info(`[RAW SNMP DEVICE INFO] ${oids[i]} (${oidName}) = ${valueType}: ${parsedValue}`);
          
          // Store in deviceInfo
          switch (varbinds[i].oid) {
            case "1.3.6.1.2.1.1.1.0":
              deviceInfo.sysDescr = parsedValue;
              break;
            case "1.3.6.1.2.1.1.2.0":
              deviceInfo.sysObjectID = parsedValue;
              break;
            case "1.3.6.1.2.1.1.5.0":
              deviceInfo.sysName = parsedValue;
              break;
            case "1.3.6.1.2.1.1.6.0":
              deviceInfo.sysLocation = parsedValue;
              break;
          }
        }
        
        resolve();
      });
    });
    
    // Identify device manufacturer and type
    deviceInfo.manufacturer = getManufacturerFromOID(deviceInfo.sysObjectID);
    deviceInfo.model = parseModelFromSNMP(deviceInfo.sysDescr, deviceInfo.manufacturer);
    deviceInfo.type = determineDeviceTypeFromSNMP(deviceInfo.sysDescr, deviceInfo.sysObjectID);
    
    logger.info(`[SNMP] Device info discovery complete for ${ip}:`, 
      JSON.stringify({ 
        hostname: deviceInfo.sysName,
        manufacturer: deviceInfo.manufacturer,
        model: deviceInfo.model,
        type: deviceInfo.type 
      }, null, 2)
    );
    
    return deviceInfo;
  } finally {
    session.close();
  }
};

/**
 * Get a human-readable name for standard OIDs
 * @private
 */
function getOidName(oid) {
  const oidMap = {
    "1.3.6.1.2.1.1.1.0": "sysDescr",
    "1.3.6.1.2.1.1.2.0": "sysObjectID",
    "1.3.6.1.2.1.1.3.0": "sysUpTime",
    "1.3.6.1.2.1.1.4.0": "sysContact",
    "1.3.6.1.2.1.1.5.0": "sysName",
    "1.3.6.1.2.1.1.6.0": "sysLocation",
    "1.3.6.1.2.1.1.7.0": "sysServices"
  };
  
  return oidMap[oid] || "unknown";
}

/**
 * Get manufacturer from sysObjectID
 * @private
 */
function getManufacturerFromOID(sysObjectID) {
  if (!sysObjectID) return null;
  
  const OID_MANUFACTURER_MAP = {
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
  
  for (const [oidPrefix, manufacturer] of Object.entries(OID_MANUFACTURER_MAP)) {
    if (sysObjectID.startsWith(oidPrefix)) {
      return manufacturer;
    }
  }
  
  return null;
}

/**
 * Parse model from sysDescr
 * @private
 */
function parseModelFromSNMP(sysDescr, manufacturer) {
  if (!sysDescr) return null;
  
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

/**
 * Determine device type from SNMP data
 * @private
 */
function determineDeviceTypeFromSNMP(sysDescr, sysObjectID) {
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
