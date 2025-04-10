const express = require('express');
const cors = require('cors');
const snmpHandler = require('./handlers/snmpHandler');
const sshHandler = require('./handlers/sshHandler');
const telnetHandler = require('./handlers/telnetHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// In-memory log storage
const logs = [];

// Log levels
const LOG_LEVELS = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

// Logger function
const logEntry = (level, message, details = null) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    details: details
  };
  
  console.log(`[${level.toUpperCase()}] ${message}`);
  if (details) {
    console.log(JSON.stringify(details, null, 2));
  }
  
  logs.unshift(entry); // Add to beginning for newest first
  
  // Keep logs limited to prevent memory issues
  if (logs.length > 1000) {
    logs.pop();
  }
  
  return entry;
};

// Make logger available to handlers
global.logger = {
  info: (message, details) => logEntry(LOG_LEVELS.INFO, message, details),
  warn: (message, details) => logEntry(LOG_LEVELS.WARN, message, details),
  error: (message, details) => logEntry(LOG_LEVELS.ERROR, message, details)
};

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, { 
    params: req.params,
    query: req.query,
    body: req.method !== 'GET' ? req.body : undefined
  });
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  logger.info('Health check requested');
  res.json({ status: 'up', timestamp: new Date() });
});

// Logs endpoint
app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const limitedLogs = logs.slice(0, limit);
  res.json(limitedLogs);
});

// SNMP endpoints
app.post('/api/snmp/connect', snmpHandler.connect);
app.post('/api/snmp/get', snmpHandler.get);
app.post('/api/snmp/walk', snmpHandler.walk);
app.post('/api/snmp/discover-vlans', snmpHandler.discoverVlans);

// SSH endpoints
app.post('/api/ssh/connect', sshHandler.connect);
app.post('/api/ssh/execute', sshHandler.execute);
app.post('/api/ssh/disconnect', sshHandler.disconnect);

// Telnet endpoints
app.post('/api/telnet/connect', telnetHandler.connect);
app.post('/api/telnet/execute', telnetHandler.execute);
app.post('/api/telnet/disconnect', telnetHandler.disconnect);

// Device data management
app.delete('/api/devices/by-subnet/:subnetId', async (req, res) => {
  try {
    // This endpoint would be used if we wanted to implement the delete via the backend
    // For now, we're handling it directly in the frontend using Supabase client
    logger.info(`Delete devices requested for subnet ${req.params.subnetId}`);
    res.json({ success: true, message: "Devices removed successfully" });
  } catch (error) {
    logger.error(`Error deleting devices for subnet ${req.params.subnetId}`, { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Start the server
app.listen(PORT, () => {
  logger.info(`Network discovery agent running on port ${PORT}`);
  logger.info(`Access the API at http://localhost:${PORT}/api/health`);
});
