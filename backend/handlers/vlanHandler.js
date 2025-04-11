
const snmp = require('net-snmp');
const { isValidVlanId } = require('../utils/validation');

// Constants for Cisco VLAN OIDs - using specific OIDs as specified
const VLAN_OIDS = {
  // vtpVlanState - standard Cisco VLAN table
  vlanList: "1.3.6.1.4.1.9.9.46.1.3.1.1.2", 
  // vtpVlanName - standard Cisco VLAN name table
  vlanName: "1.3.6.1.4.1.9.9.46.1.3.1.1.4"
};

// IP and Interface OIDs for subnet discovery
const SUBNET_OIDS = {
  // ipAdEntIfIndex - maps IP addresses to interface indices
  ipAddrIfIndex: "1.3.6.1.2.1.4.20.1.2",
  // ipAdEntNetMask - provides subnet masks for IP addresses
  ipAddrNetMask: "1.3.6.1.2.1.4.20.1.3",
  // ifDescr - provides interface descriptions (including VLAN references)
  ifDescr: "1.3.6.1.2.1.2.2.1.2"
};

/**
 * Discover VLANs using SNMP
 * @param {string} ip - The IP address of the device
 * @param {string} community - The SNMP community string
 * @param {string} version - The SNMP version
 * @param {string} make - The device manufacturer
 * @returns {Object} - Object containing discovered VLANs info
 */
exports.discoverVlans = async (ip, community = 'public', version = '2c', make) => {
  logger.info(`[SNMP] Discovering VLANs from ${ip} using community ${community} (v${version})`);
  
  // Create temporary session
  const snmpVersion = version === '1' ? snmp.Version1 : snmp.Version2c;
  const session = snmp.createSession(ip, community, {
    version: snmpVersion,
    retries: 1,
    timeout: 5000
  });
  
  const vlans = [];
  const invalidVlans = [];
  const processedVlanIds = new Set(); // Track already processed VLAN IDs to prevent duplicates
  
  // Store raw SNMP responses for logging
  const rawResponses = {
    vlanState: [],
    vlanName: [],
    ipAddrIfIndex: [],
    ipAddrNetMask: [],
    ifDescr: []
  };
  
  try {
    // Log the exact OIDs we're querying - be very explicit
    logger.info(`[SNMP] STRICT TARGET: Using ONLY the following OIDs:`);
    logger.info(`[SNMP] STRICT TARGET: 1. VLAN state OID: ${VLAN_OIDS.vlanList} (for VLAN IDs)`);
    logger.info(`[SNMP] STRICT TARGET: 2. VLAN name OID: ${VLAN_OIDS.vlanName} (for VLAN names)`);
    
    // STEP 1: Execute a targeted subtree method call for VLAN IDs 
    logger.info(`[SNMP] Executing targeted subtree call for VLAN IDs with base OID ${VLAN_OIDS.vlanList}`);
    
    const vlanIdResults = await performTargetedOperation(session, VLAN_OIDS.vlanList);
    logger.info(`[SNMP] VLAN ID discovery complete - received ${vlanIdResults.length} OID responses`);
    
    // Process VLAN ID results
    for (const result of vlanIdResults) {
      if (result && result.oid && result.value !== undefined) {
        // Log in the raw SNMP format
        const oidStr = Array.isArray(result.oid) ? result.oid.join('.') : result.oid.toString();
        const valueStr = result.value.toString();
        
        // Add to raw responses for logging
        rawResponses.vlanState.push({
          oid: oidStr,
          value: valueStr
        });
        
        logger.info(`[RAW SNMP VLAN ID] SNMPv2-SMI::enterprises.${oidStr.replace(/^1\.3\.6\.1\.4\.1\./g, '')} = INTEGER: ${valueStr}`);
        
        // Parse the VLAN ID from the OID
        const oidParts = oidStr.split('.');
        const vlanId = parseInt(oidParts[oidParts.length - 1], 10);
        
        // Skip if we've already processed this VLAN ID or it's not a number
        if (processedVlanIds.has(vlanId) || isNaN(vlanId)) {
          continue;
        }
        
        // Extra validation for VLAN ID range - must be 1-4094
        if (vlanId < 1 || vlanId > 4094) {
          invalidVlans.push({
            vlanId,
            reason: 'Invalid VLAN ID range'
          });
          processedVlanIds.add(vlanId); // Mark as processed anyway to avoid duplicates
          continue;
        }
        
        // Parse the state value (1 = operational, 2 = suspended, etc.)
        let stateValue = 0;
        if (Buffer.isBuffer(result.value)) {
          stateValue = parseInt(result.value.toString(), 10);
        } else if (typeof result.value === 'number') {
          stateValue = result.value;
        }
        
        // Mark this VLAN ID as processed
        processedVlanIds.add(vlanId);
        
        // Only include VLANs with state value of 1 (active)
        if (stateValue === 1) {
          logger.info(`[SNMP] Found active VLAN ${vlanId} with state ${stateValue} on ${ip}`);
          vlans.push({
            vlanId,
            name: `VLAN${vlanId}`, // Default name, will be updated
            state: 'active',
            usedBy: [ip]
          });
        } else {
          invalidVlans.push({
            vlanId,
            reason: 'Inactive VLAN (status not 1)'
          });
        }
      }
    }
    
    // Log the actual VLANs found for debugging
    logger.info(`[SNMP] VLAN ID discovery found ${vlans.length} active VLANs: ${vlans.map(v => v.vlanId).join(', ')}`);
    
    // Reset the processed set for name lookups
    processedVlanIds.clear();
    
    // STEP 2: Get names for the VLANs we already found (if any)
    if (vlans.length > 0) {
      logger.info(`[SNMP] Executing targeted subtree call for VLAN names with base OID ${VLAN_OIDS.vlanName}`);
      
      const vlanNameResults = await performTargetedOperation(session, VLAN_OIDS.vlanName);
      logger.info(`[SNMP] VLAN name discovery complete - received ${vlanNameResults.length} OID responses`);
      
      // Process VLAN name results
      for (const result of vlanNameResults) {
        if (result && result.oid && result.value !== undefined) {
          // Log in the raw SNMP format
          const oidStr = Array.isArray(result.oid) ? result.oid.join('.') : result.oid.toString();
          let valueStr = "";
          
          if (Buffer.isBuffer(result.value)) {
            valueStr = result.value.toString().trim();
          } else {
            valueStr = result.value.toString().trim();
          }
          
          // Add to raw responses for logging
          rawResponses.vlanName.push({
            oid: oidStr,
            value: valueStr
          });
          
          logger.info(`[RAW SNMP VLAN NAME] SNMPv2-SMI::enterprises.${oidStr.replace(/^1\.3\.6\.1\.4\.1\./g, '')} = STRING: ${valueStr}`);
          
          // Parse the VLAN ID from the OID
          const oidParts = oidStr.split('.');
          const vlanId = parseInt(oidParts[oidParts.length - 1], 10);
          
          // Skip if we've already processed this VLAN ID for names or it's invalid
          if (processedVlanIds.has(vlanId) || isNaN(vlanId) || vlanId < 1 || vlanId > 4094) {
            continue;
          }
          
          processedVlanIds.add(vlanId);
          
          // Only update names for VLANs we've already identified
          const vlan = vlans.find(v => v.vlanId === vlanId);
          if (vlan) {
            // Always use the returned name value directly without filtering
            vlan.name = valueStr || `VLAN${vlanId}`;
            logger.info(`[SNMP] VLAN ${vlanId} name: "${vlan.name}"`);
          }
        }
      }
    }
    
    // STEP 3: Discover subnet information for the VLANs
    logger.info(`[SNMP] Starting subnet discovery for VLANs...`);
    
    // Map to store subnet information by interface index
    const subnets = {};
    const ifIndexToIp = {};
    const ifIndexToVlan = {};
    
    // Step 3a: Get IP address to interface index mappings
    logger.info(`[SNMP] STRICT TARGET: 3. IP address interface index OID: ${SUBNET_OIDS.ipAddrIfIndex}`);
    logger.info(`[SNMP] Executing targeted subtree call for IP address interface indices with base OID ${SUBNET_OIDS.ipAddrIfIndex}`);
    
    const ipAddrIfIndexResults = await performTargetedOperation(session, SUBNET_OIDS.ipAddrIfIndex);
    logger.info(`[SNMP] IP address interface index discovery complete - received ${ipAddrIfIndexResults.length} OID responses`);
    
    // Process IP address to interface index mappings
    for (const result of ipAddrIfIndexResults) {
      if (result && result.oid && result.value !== undefined) {
        const oidStr = Array.isArray(result.oid) ? result.oid.join('.') : result.oid.toString();
        const valueStr = result.value.toString();
        
        // Extract IP address from OID (format: 1.3.6.1.2.1.4.20.1.2.10.1.251.126)
        const oidParts = oidStr.split('.');
        const ipParts = oidParts.slice(-4); // Last 4 octets form the IP address
        const ipAddress = ipParts.join('.');
        
        // Extract interface index from value
        let ifIndex = parseInt(valueStr, 10);
        if (isNaN(ifIndex)) {
          if (Buffer.isBuffer(result.value)) {
            ifIndex = parseInt(result.value.toString(), 10);
          }
        }
        
        if (!isNaN(ifIndex)) {
          // Store mapping of interface index to IP address
          ifIndexToIp[ifIndex] = ipAddress;
          
          // Log the raw data
          rawResponses.ipAddrIfIndex.push({
            oid: oidStr,
            value: valueStr,
            ipAddress,
            ifIndex
          });
          
          logger.info(`[RAW SNMP IP-IF] IP-MIB::ipAdEntIfIndex.${ipAddress} = INTEGER: ${ifIndex}`);
        }
      }
    }
    
    // Step 3b: Get subnet masks for IP addresses
    logger.info(`[SNMP] STRICT TARGET: 4. IP address subnet mask OID: ${SUBNET_OIDS.ipAddrNetMask}`);
    logger.info(`[SNMP] Executing targeted subtree call for IP address subnet masks with base OID ${SUBNET_OIDS.ipAddrNetMask}`);
    
    const ipAddrNetMaskResults = await performTargetedOperation(session, SUBNET_OIDS.ipAddrNetMask);
    logger.info(`[SNMP] IP address subnet mask discovery complete - received ${ipAddrNetMaskResults.length} OID responses`);
    
    // Process subnet mask results
    for (const result of ipAddrNetMaskResults) {
      if (result && result.oid && result.value !== undefined) {
        const oidStr = Array.isArray(result.oid) ? result.oid.join('.') : result.oid.toString();
        let subnetMask = "";
        
        if (Buffer.isBuffer(result.value)) {
          subnetMask = result.value.toString().trim();
        } else {
          subnetMask = result.value.toString().trim();
        }
        
        // Extract IP address from OID (format: 1.3.6.1.2.1.4.20.1.3.10.1.251.126)
        const oidParts = oidStr.split('.');
        const ipParts = oidParts.slice(-4); // Last 4 octets form the IP address
        const ipAddress = ipParts.join('.');
        
        // Find the interface index for this IP
        const ifIndex = Object.keys(ifIndexToIp).find(idx => ifIndexToIp[idx] === ipAddress);
        
        if (ifIndex) {
          // Convert subnet mask to CIDR notation
          const cidrLength = netmaskToCidr(subnetMask);
          const subnet = `${ipAddress}/${cidrLength}`;
          
          // Store subnet information by interface index
          subnets[ifIndex] = subnet;
          
          // Log the raw data
          rawResponses.ipAddrNetMask.push({
            oid: oidStr,
            value: subnetMask,
            ipAddress,
            subnet
          });
          
          logger.info(`[RAW SNMP SUBNET] IP-MIB::ipAdEntNetMask.${ipAddress} = IpAddress: ${subnetMask} (${subnet})`);
        }
      }
    }
    
    // Step 3c: Get interface descriptions to map to VLAN IDs
    logger.info(`[SNMP] STRICT TARGET: 5. Interface description OID: ${SUBNET_OIDS.ifDescr}`);
    logger.info(`[SNMP] Executing targeted subtree call for interface descriptions with base OID ${SUBNET_OIDS.ifDescr}`);
    
    const ifDescrResults = await performTargetedOperation(session, SUBNET_OIDS.ifDescr);
    logger.info(`[SNMP] Interface description discovery complete - received ${ifDescrResults.length} OID responses`);
    
    // Process interface description results
    for (const result of ifDescrResults) {
      if (result && result.oid && result.value !== undefined) {
        const oidStr = Array.isArray(result.oid) ? result.oid.join('.') : result.oid.toString();
        let ifDescr = "";
        
        if (Buffer.isBuffer(result.value)) {
          ifDescr = result.value.toString().trim();
        } else {
          ifDescr = result.value.toString().trim();
        }
        
        // Extract interface index from OID (format: 1.3.6.1.2.1.2.2.1.2.77)
        const oidParts = oidStr.split('.');
        const ifIndex = parseInt(oidParts[oidParts.length - 1], 10);
        
        if (!isNaN(ifIndex)) {
          // Look for "VlanXXX" pattern in interface description
          const vlanMatch = ifDescr.match(/[Vv]lan(\d+)/);
          if (vlanMatch) {
            const vlanId = parseInt(vlanMatch[1], 10);
            
            // Store mapping of interface index to VLAN ID
            ifIndexToVlan[ifIndex] = vlanId;
            
            // Log the raw data
            rawResponses.ifDescr.push({
              oid: oidStr,
              value: ifDescr,
              ifIndex,
              vlanId
            });
            
            logger.info(`[RAW SNMP IF-DESCR] IF-MIB::ifDescr.${ifIndex} = STRING: ${ifDescr} (VLAN ${vlanId})`);
          }
        }
      }
    }
    
    // Step 3d: Map subnet information to VLANs
    logger.info(`[SNMP] Mapping subnet information to VLANs...`);
    
    // Create lookup map from VLAN IDs to subnet info
    const vlanToSubnet = {};
    
    // Map interfaces to VLANs and then to subnets
    Object.keys(ifIndexToVlan).forEach(ifIndex => {
      const vlanId = ifIndexToVlan[ifIndex];
      const subnet = subnets[ifIndex];
      
      if (vlanId && subnet) {
        vlanToSubnet[vlanId] = subnet;
        logger.info(`[SNMP] Mapped VLAN ${vlanId} to subnet ${subnet} via interface ${ifIndex}`);
      }
    });
    
    // Update VLAN objects with subnet information
    for (const vlan of vlans) {
      if (vlanToSubnet[vlan.vlanId]) {
        vlan.subnet = vlanToSubnet[vlan.vlanId];
        logger.info(`[SNMP] Associated VLAN ${vlan.vlanId} with subnet ${vlan.subnet}`);
      }
    }
    
    // Log subnet discovery summary
    const vlansWithSubnets = vlans.filter(v => v.subnet).length;
    logger.info(`[SNMP] Subnet discovery found subnets for ${vlansWithSubnets} out of ${vlans.length} VLANs`);
    
    // Handle the case of too many VLANs - limit to valid range if needed
    if (vlans.length > 4094) {
      logger.warn(`[SNMP] Found ${vlans.length} VLANs which exceeds the maximum of 4094. Limiting to the valid range.`);
      // Sort and keep only the first 4094 valid VLANs
      vlans.sort((a, b) => a.vlanId - b.vlanId);
      const excessVlans = vlans.splice(4094); 
      
      // Move excess VLANs to invalid list
      excessVlans.forEach(vlan => {
        invalidVlans.push({
          vlanId: vlan.vlanId,
          reason: 'Exceeded maximum valid VLAN count (4094)'
        });
      });
    }
    
    // Add counts for active VLANs specifically
    const activeCount = vlans.length;
    const inactiveCount = invalidVlans.filter(v => v.reason === 'Inactive VLAN (status not 1)').length;
    
    logger.info(`[SNMP] Found ${activeCount} active VLANs on ${ip} (ignored ${inactiveCount} inactive and ${invalidVlans.length - inactiveCount} invalid VLANs)`);
    logger.info(`[SNMP] Final active VLAN IDs: ${vlans.map(v => v.vlanId).join(', ')}`);
    logger.info(`[SNMP] VLAN processing summary: Found ${vlans.length} active VLANs out of ${vlans.length + invalidVlans.length} total VLANs`);
    logger.info(`[SNMP] VLAN names found: ${vlans.map(v => `"${v.name}"`).join(', ')}`);
    
    if (vlansWithSubnets > 0) {
      logger.info(`[SNMP] VLAN subnets found: ${vlans.filter(v => v.subnet).map(v => `VLAN ${v.vlanId}: ${v.subnet}`).join(', ')}`);
    }
    
    return { 
      vlans,
      invalidVlans,
      totalDiscovered: vlans.length + invalidVlans.length,
      validCount: vlans.length,
      invalidCount: invalidVlans.length,
      activeCount: vlans.length,
      inactiveCount: invalidVlans.filter(v => v.reason === 'Inactive VLAN (status not 1)').length,
      // Include raw response data
      rawData: {
        vlanState: rawResponses.vlanState,
        vlanName: rawResponses.vlanName,
        ipAddrIfIndex: rawResponses.ipAddrIfIndex,
        ipAddrNetMask: rawResponses.ipAddrNetMask,
        ifDescr: rawResponses.ifDescr
      }
    };
  } finally {
    // Close session
    session.close();
  }
};

/**
 * Performs a targeted SNMP operation on a specific OID
 * Using subtree as a more efficient alternative to generic walk
 * 
 * @param {Object} session - SNMP session
 * @param {string} baseOid - The base OID to query
 * @returns {Promise<Array>} - Array of results with oid and value
 */
async function performTargetedOperation(session, baseOid) {
  return new Promise((resolve, reject) => {
    const results = [];
    
    // Use subtree method which is more targeted than general walk
    session.subtree(baseOid, (varbinds) => {
      if (varbinds === null) {
        // End of MIB view or other error, but just consider it the end
        resolve(results);
        return;
      }
      
      // Process this batch of results
      for (const varbind of varbinds) {
        if (!snmp.isVarbindError(varbind)) {
          results.push({
            oid: varbind.oid,
            value: varbind.value
          });
        }
      }
    }, (error) => {
      if (error) {
        logger.error(`[SNMP] Error in subtree operation for ${baseOid}:`, error);
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

/**
 * Convert subnet mask to CIDR notation
 * @param {string} netmask - The subnet mask (e.g. 255.255.255.0)
 * @returns {number} - The CIDR notation (e.g. 24)
 */
function netmaskToCidr(netmask) {
  const parts = netmask.split('.').map(Number);
  let cidr = 0;
  
  for (let i = 0; i < parts.length; i++) {
    // Convert each octet to binary and count the 1s
    const binaryOctet = (parts[i] >>> 0).toString(2);
    cidr += binaryOctet.split('1').length - 1;
  }
  
  return cidr;
}
