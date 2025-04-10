
const snmp = require('net-snmp');
const vlanHandler = require('./vlanHandler');
const deviceDiscovery = require('../utils/deviceDiscovery');
const { isValidVlanId } = require('../utils/validation');

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
    
    const deviceInfo = await deviceDiscovery.discoverDeviceInfo(ip, community, version);
    
    res.json({ 
      status: 'success',
      device: deviceInfo
    });
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
    
    const result = await vlanHandler.discoverVlans(ip, community, version, make);
    
    res.json(result);
  } catch (error) {
    console.error('SNMP VLAN discovery error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Helper function to access the session store - for testing/debugging
exports.getSessionCount = () => {
  return Object.keys(sessions).length;
};

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
