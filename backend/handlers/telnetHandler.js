
const Telnet = require('telnet-client');

// In-memory session store
const sessions = {};

/**
 * Connect to a device via Telnet
 */
exports.connect = async (req, res) => {
  try {
    const { 
      ip, 
      username, 
      password,
      port = 23, 
      loginPrompt = 'login:', 
      passwordPrompt = 'Password:',
      enablePrompt = '>',
      enableCommand = 'enable',
      enablePassword
    } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: 'IP address is required' });
    }
    
    const connection = new Telnet();
    
    // Configure connection parameters
    const params = {
      host: ip,
      port: port,
      shellPrompt: /[#>$%]\s*$/,
      loginPrompt: loginPrompt,
      passwordPrompt: passwordPrompt,
      username: username,
      password: password,
      timeout: 10000,
      negotiationMandatory: false
    };
    
    // Connect to the device
    await connection.connect(params);
    
    // If enable password is provided, enter privileged mode
    if (enablePassword) {
      try {
        await connection.send(enableCommand);
        await connection.waitFor(passwordPrompt);
        await connection.send(enablePassword);
        await connection.waitFor(params.shellPrompt);
      } catch (enableError) {
        console.warn(`Warning: Unable to enter enable mode: ${enableError.message}`);
      }
    }
    
    // Generate session ID
    const sessionId = `telnet_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    sessions[sessionId] = { connection, ip, lastActivity: Date.now() };
    
    res.json({ 
      sessionId, 
      status: 'connected',
      message: `Telnet connection established with ${ip}`
    });
  } catch (error) {
    console.error('Telnet connection error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Execute a command via Telnet
 */
exports.execute = async (req, res) => {
  try {
    const { sessionId, command } = req.body;
    
    if (!sessionId || !sessions[sessionId]) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }
    
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }
    
    const { connection } = sessions[sessionId];
    sessions[sessionId].lastActivity = Date.now();
    
    const response = await connection.send(command);
    
    res.json({
      output: response
    });
  } catch (error) {
    console.error('Telnet execution error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Disconnect a Telnet session
 */
exports.disconnect = async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId || !sessions[sessionId]) {
      return res.status(404).json({ error: 'Session not found or already closed' });
    }
    
    const { connection, ip } = sessions[sessionId];
    
    // Disconnect
    await connection.end();
    delete sessions[sessionId];
    
    res.json({ 
      status: 'disconnected', 
      message: `Telnet connection to ${ip} closed successfully` 
    });
  } catch (error) {
    console.error('Telnet disconnect error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Cleanup old sessions periodically
setInterval(() => {
  const now = Date.now();
  const sessionIds = Object.keys(sessions);
  
  for (const sessionId of sessionIds) {
    // Close sessions inactive for more than 30 minutes
    if (now - sessions[sessionId].lastActivity > 30 * 60 * 1000) {
      try {
        sessions[sessionId].connection.end();
      } catch (e) {
        console.error('Error closing Telnet session:', e);
      }
      delete sessions[sessionId];
      console.log(`Closed inactive Telnet session: ${sessionId}`);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes
