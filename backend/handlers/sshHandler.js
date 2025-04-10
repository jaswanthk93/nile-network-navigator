
const { NodeSSH } = require('node-ssh');

// In-memory session store
const sessions = {};

/**
 * Connect to a device via SSH
 */
exports.connect = async (req, res) => {
  try {
    const { 
      ip, 
      username, 
      password, 
      privateKey,
      port = 22
    } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: 'IP address is required' });
    }
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    if (!password && !privateKey) {
      return res.status(400).json({ error: 'Either password or privateKey is required' });
    }
    
    const ssh = new NodeSSH();
    
    // Configure connection options
    const options = {
      host: ip,
      port,
      username,
      readyTimeout: 10000 // 10 seconds
    };
    
    // Add authentication method
    if (password) {
      options.password = password;
    } else if (privateKey) {
      options.privateKey = privateKey;
    }
    
    // Connect to the device
    await ssh.connect(options);
    
    // Generate session ID
    const sessionId = `ssh_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    sessions[sessionId] = { ssh, ip, lastActivity: Date.now() };
    
    res.json({ 
      sessionId, 
      status: 'connected',
      message: `SSH connection established with ${ip}`
    });
  } catch (error) {
    console.error('SSH connection error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Execute a command via SSH
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
    
    const { ssh } = sessions[sessionId];
    sessions[sessionId].lastActivity = Date.now();
    
    const result = await ssh.execCommand(command, {});
    
    res.json({
      stdout: result.stdout,
      stderr: result.stderr,
      code: result.code
    });
  } catch (error) {
    console.error('SSH execution error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Disconnect an SSH session
 */
exports.disconnect = async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId || !sessions[sessionId]) {
      return res.status(404).json({ error: 'Session not found or already closed' });
    }
    
    const { ssh, ip } = sessions[sessionId];
    
    // Disconnect
    ssh.dispose();
    delete sessions[sessionId];
    
    res.json({ 
      status: 'disconnected', 
      message: `SSH connection to ${ip} closed successfully` 
    });
  } catch (error) {
    console.error('SSH disconnect error:', error);
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
        sessions[sessionId].ssh.dispose();
      } catch (e) {
        console.error('Error closing SSH session:', e);
      }
      delete sessions[sessionId];
      console.log(`Closed inactive SSH session: ${sessionId}`);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes
