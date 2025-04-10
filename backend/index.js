
const express = require('express');
const cors = require('cors');
const snmpHandler = require('./handlers/snmpHandler');
const sshHandler = require('./handlers/sshHandler');
const telnetHandler = require('./handlers/telnetHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'up', timestamp: new Date() });
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
    res.json({ success: true, message: "Devices removed successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Network discovery agent running on port ${PORT}`);
  console.log(`Access the API at http://localhost:${PORT}/api/health`);
});
