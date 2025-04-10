
# Network Discovery Agent

This is a local agent that allows your browser-based application to communicate with network devices via SNMP, SSH, and Telnet.

## Features

- SNMP communication (v1 and v2c)
- SSH command execution
- Telnet terminal access
- VLAN discovery via SNMP
- Session management with automatic cleanup

## Prerequisites

- Node.js (v14+)
- npm or yarn
- Access to network devices (firewalls, etc. properly configured)

## Installation

1. Install dependencies:
   ```
   npm install
   ```

2. Start the server:
   ```
   npm start
   ```

   Or for development with auto-restart:
   ```
   npm run dev
   ```

## Usage

The agent runs on http://localhost:3001 by default. The frontend application should make API calls to this address.

### API Endpoints

#### SNMP
- `POST /api/snmp/connect` - Create an SNMP session
- `POST /api/snmp/get` - Execute SNMP GET
- `POST /api/snmp/walk` - Execute SNMP WALK
- `POST /api/snmp/discover-vlans` - Discover VLANs via SNMP

#### SSH
- `POST /api/ssh/connect` - Create an SSH session
- `POST /api/ssh/execute` - Execute SSH command
- `POST /api/ssh/disconnect` - Close SSH session

#### Telnet
- `POST /api/telnet/connect` - Create a Telnet session
- `POST /api/telnet/execute` - Execute Telnet command
- `POST /api/telnet/disconnect` - Close Telnet session

## Security Considerations

This agent should only be run on trusted networks. It does not implement authentication as it's designed to run locally on the same machine as the user.

## License

MIT
