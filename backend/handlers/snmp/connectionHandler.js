
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
    
    // Create session with reduced timeout and no retries
    const session = snmp.createSession(ip, community, {
      port,
      version: snmpVersion,
      retries: 0, // No retries
      timeout: 2000 // Reduced timeout to 2 seconds
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
 * Helper function to access the session store - for testing/debugging
 */
exports.getSessionCount = () => {
  return Object.keys(sessions).length;
};

/**
 * Get the session store for use by other modules
 */
exports.getSessions = () => {
  return sessions;
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
