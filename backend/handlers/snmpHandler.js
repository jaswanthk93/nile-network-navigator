
const snmp = require('net-snmp');

// In-memory session store
const sessions = {};

/**
 * Create an SNMP session
 */
exports.connect = (req, res) => {
  try {
    const { ip, community = 'public', version = '2c', port = 161 } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: 'IP address is required' });
    }
    
    const snmpVersion = version === '1' ? snmp.Version1 : snmp.Version2c;
    
    // Create session
    const session = snmp.createSession(ip, community, {
      port,
      version: snmpVersion,
      retries: 1,
      timeout: 5000
    });
    
    // Generate session ID
    const sessionId = `snmp_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    sessions[sessionId] = { session, ip, lastActivity: Date.now() };
    
    // Clean up on error
    session.on('error', (error) => {
      console.error(`SNMP Error for ${ip}:`, error);
      if (sessions[sessionId]) {
        sessions[sessionId].session.close();
        delete sessions[sessionId];
      }
    });
    
    res.json({ 
      sessionId, 
      status: 'connected',
      message: `SNMP session established with ${ip} using SNMPv${version}`
    });
  } catch (error) {
    console.error('SNMP connection error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Execute SNMP GET request
 */
exports.get = (req, res) => {
  try {
    const { sessionId, oids } = req.body;
    
    if (!sessionId || !sessions[sessionId]) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }
    
    if (!oids || !Array.isArray(oids) || oids.length === 0) {
      return res.status(400).json({ error: 'OIDs array is required' });
    }
    
    const { session } = sessions[sessionId];
    sessions[sessionId].lastActivity = Date.now();
    
    session.get(oids, (error, varbinds) => {
      if (error) {
        console.error('SNMP GET error:', error);
        return res.status(500).json({ error: error.message });
      }
      
      // Process results
      const results = {};
      
      for (let i = 0; i < varbinds.length; i++) {
        if (snmp.isVarbindError(varbinds[i])) {
          results[oids[i]] = {
            error: snmp.varbindError(varbinds[i])
          };
        } else {
          const oid = varbinds[i].oid;
          const value = varbinds[i].value;
          
          // Convert Buffer to the appropriate JavaScript type
          let parsedValue;
          if (Buffer.isBuffer(value)) {
            if (varbinds[i].type === snmp.ObjectType.OctetString) {
              parsedValue = value.toString();
            } else if (varbinds[i].type === snmp.ObjectType.Integer ||
                      varbinds[i].type === snmp.ObjectType.Counter ||
                      varbinds[i].type === snmp.ObjectType.Gauge) {
              parsedValue = parseInt(value.toString(), 10);
            } else {
              parsedValue = value.toString('hex');
            }
          } else {
            parsedValue = value;
          }
          
          results[oid] = {
            value: parsedValue,
            type: varbinds[i].type
          };
        }
      }
      
      res.json({ results });
    });
  } catch (error) {
    console.error('SNMP GET error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Execute SNMP WALK request
 */
exports.walk = (req, res) => {
  try {
    const { sessionId, oid } = req.body;
    
    if (!sessionId || !sessions[sessionId]) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }
    
    if (!oid) {
      return res.status(400).json({ error: 'OID is required' });
    }
    
    const { session } = sessions[sessionId];
    sessions[sessionId].lastActivity = Date.now();
    
    const results = {};
    
    function doneCb(error) {
      if (error) {
        console.error('SNMP WALK error:', error);
        return res.status(500).json({ error: error.message });
      }
      
      res.json({ results });
    }
    
    function feedCb(varbinds) {
      for (const varbind of varbinds) {
        if (snmp.isVarbindError(varbind)) {
          console.error('SNMP WALK varbind error:', snmp.varbindError(varbind));
        } else {
          const oid = varbind.oid;
          const value = varbind.value;
          
          // Convert Buffer to the appropriate JavaScript type
          let parsedValue;
          if (Buffer.isBuffer(value)) {
            if (varbind.type === snmp.ObjectType.OctetString) {
              parsedValue = value.toString();
            } else if (varbind.type === snmp.ObjectType.Integer ||
                      varbind.type === snmp.ObjectType.Counter ||
                      varbind.type === snmp.ObjectType.Gauge) {
              parsedValue = parseInt(value.toString(), 10);
            } else {
              parsedValue = value.toString('hex');
            }
          } else {
            parsedValue = value;
          }
          
          results[oid] = {
            value: parsedValue,
            type: varbind.type
          };
        }
      }
    }
    
    session.walk(oid, feedCb, doneCb);
  } catch (error) {
    console.error('SNMP WALK error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Health check endpoint for backend connectivity testing
 */
exports.health = (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    message: 'SNMP backend agent is running'
  });
};

/**
 * Discover device details using SNMP
 */
exports.discoverDevice = async (req, res) => {
  try {
    const { ip, community = 'public', version = '2c' } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: 'IP address is required' });
    }
    
    // Create a temporary session for discovery
    const snmpVersion = version === '1' ? snmp.Version1 : snmp.Version2c;
    const session = snmp.createSession(ip, community, {
      version: snmpVersion,
      retries: 1,
      timeout: 5000
    });
    
    // Key OIDs for device identification
    const oids = [
      "1.3.6.1.2.1.1.1.0",  // sysDescr
      "1.3.6.1.2.1.1.2.0",  // sysObjectID
      "1.3.6.1.2.1.1.5.0",  // sysName
      "1.3.6.1.2.1.1.6.0",  // sysLocation
    ];
    
    // Get system information
    const deviceInfo = {};
    
    try {
      await new Promise((resolve, reject) => {
        session.get(oids, (error, varbinds) => {
          if (error) {
            return reject(error);
          }
          
          for (let i = 0; i < varbinds.length; i++) {
            if (snmp.isVarbindError(varbinds[i])) {
              console.warn(`Error for OID ${oids[i]}: ${snmp.varbindError(varbinds[i])}`);
              continue;
            }
            
            const value = varbinds[i].value;
            let parsedValue = null;
            
            if (Buffer.isBuffer(value)) {
              parsedValue = value.toString();
            } else {
              parsedValue = value;
            }
            
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
      
      res.json({ 
        status: 'success',
        device: deviceInfo
      });
    } catch (snmpError) {
      console.error('SNMP discovery error:', snmpError);
      res.status(500).json({ 
        status: 'error',
        error: snmpError.message,
        message: 'Failed to retrieve device information via SNMP'
      });
    } finally {
      session.close();
    }
  } catch (error) {
    console.error('SNMP device discovery error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Discover VLANs using SNMP
 */
exports.discoverVlans = async (req, res) => {
  try {
    const { ip, community = 'public', version = '2c', make } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: 'IP address is required' });
    }
    
    // Different OIDs based on device make
    let vlanOids = {
      vlanList: "1.3.6.1.2.1.17.7.1.4.3.1.1", // Standard Bridge-MIB
      vlanName: "1.3.6.1.2.1.17.7.1.4.3.1.2"  // Standard Bridge-MIB
    };
    
    if (make && make.toLowerCase().includes('cisco')) {
      vlanOids = {
        vlanList: "1.3.6.1.4.1.9.9.46.1.3.1.1.2", // CISCO-VTP-MIB::vtpVlanState
        vlanName: "1.3.6.1.4.1.9.9.46.1.3.1.1.4", // CISCO-VTP-MIB::vtpVlanName
      };
    }
    
    // Create temporary session
    const snmpVersion = version === '1' ? snmp.Version1 : snmp.Version2c;
    const session = snmp.createSession(ip, community, {
      version: snmpVersion,
      retries: 1,
      timeout: 5000
    });
    
    const vlans = [];
    
    // Walk through VLAN list
    await new Promise((resolve, reject) => {
      session.walk(vlanOids.vlanList, (varbinds) => {
        for (const varbind of varbinds) {
          if (!snmp.isVarbindError(varbind)) {
            const oidParts = varbind.oid.split('.');
            const vlanId = parseInt(oidParts[oidParts.length - 1], 10);
            
            if (!isNaN(vlanId)) {
              vlans.push({
                vlanId,
                name: `VLAN${vlanId}`, // Default name, will be updated
                usedBy: [ip]
              });
            }
          }
        }
      }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
    
    // Get VLAN names
    if (vlans.length > 0) {
      await new Promise((resolve, reject) => {
        session.walk(vlanOids.vlanName, (varbinds) => {
          for (const varbind of varbinds) {
            if (!snmp.isVarbindError(varbind)) {
              const oidParts = varbind.oid.split('.');
              const vlanId = parseInt(oidParts[oidParts.length - 1], 10);
              
              if (!isNaN(vlanId)) {
                const vlan = vlans.find(v => v.vlanId === vlanId);
                if (vlan && Buffer.isBuffer(varbind.value)) {
                  vlan.name = varbind.value.toString().trim();
                }
              }
            }
          }
        }, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }
    
    // Close session
    session.close();
    
    res.json({ vlans });
  } catch (error) {
    console.error('SNMP VLAN discovery error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Helper function to get manufacturer from sysObjectID
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

// Helper function to parse model information from sysDescr
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

// Helper function to determine device type from SNMP
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

// Cleanup old sessions periodically
setInterval(() => {
  const now = Date.now();
  const sessionIds = Object.keys(sessions);
  
  for (const sessionId of sessionIds) {
    // Close sessions inactive for more than 30 minutes
    if (now - sessions[sessionId].lastActivity > 30 * 60 * 1000) {
      try {
        sessions[sessionId].session.close();
      } catch (e) {
        console.error('Error closing SNMP session:', e);
      }
      delete sessions[sessionId];
      console.log(`Closed inactive SNMP session: ${sessionId}`);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes
