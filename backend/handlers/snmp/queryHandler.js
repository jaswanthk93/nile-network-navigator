
const snmp = require('net-snmp');
const { getSessions } = require('./connectionHandler');

/**
 * Execute SNMP GET request
 */
exports.get = (req, res) => {
  try {
    const { sessionId, oids } = req.body;
    const sessions = getSessions();
    
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
    const sessions = getSessions();
    
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
