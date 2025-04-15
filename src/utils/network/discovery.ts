import { DiscoveredDevice } from "@/types/network";
import * as ipUtils from "./ipUtils";
import * as deviceIdentification from "./deviceIdentification";
import { scanNetworkDevice } from "./scanStrategies";
import { getDeviceInfoViaSNMP, discoverMacAddresses } from "./snmpDiscovery";
import { discoverVlans } from "./vlanDiscovery";

/**
 * Run discovery on a specific IP address
 */
export async function discoverIP(
  ipAddress: string,
  updateProgress?: (message: string, progress: number) => void,
  backendConnected: boolean = false,
  userId?: string,
  siteId?: string,
  subnetId?: string
): Promise<DiscoveredDevice | null> {
  try {
    console.log(`Discovering IP: ${ipAddress}`);
    
    // Initial device scan with connectivity test
    const initialScan = await scanNetworkDevice(ipAddress, updateProgress);
    if (!initialScan.isReachable) {
      console.log(`Device ${ipAddress} is not reachable`);
      return null;
    }
    
    // Get basic device info
    const discoveredDevice: DiscoveredDevice = {
      ip_address: ipAddress,
      status: initialScan.isReachable ? 'up' : 'down',
      category: null,
      hostname: null,
      mac_address: null,
      make: null,
      model: null,
      needs_verification: true
    };
    
    // Collect more detailed device info via SNMP
    try {
      const deviceInfo = await getDeviceInfoViaSNMP(ipAddress, updateProgress, backendConnected);
      
      if (deviceInfo && !deviceInfo.error) {
        // The hostname from SNMP (sysName) is given highest preference
        discoveredDevice.hostname = deviceInfo.hostname || null;
        discoveredDevice.make = deviceInfo.make || null;
        discoveredDevice.model = deviceInfo.model || null;
        discoveredDevice.category = deviceInfo.category || null;
        discoveredDevice.sysDescr = deviceInfo.sysDescr || null;
        
        // If this appears to be a switch, discover VLANs and MAC addresses
        if (deviceInfo.category === 'Switch' || deviceInfo.category === 'Router') {
          console.log(`Found network device at ${ipAddress} - attempting to discover VLANs`);
          
          if (updateProgress) {
            updateProgress(`Found network device at ${ipAddress}. Discovering VLANs...`, 40);
          }
          
          try {
            // Discover VLANs on the switch first
            const { vlans } = await discoverVlans(ipAddress);
            const vlanIds = vlans.map(vlan => vlan.vlanId);
            
            console.log(`Discovered ${vlanIds.length} VLANs on ${ipAddress}: ${vlanIds.join(', ')}`);
            
            if (vlanIds.length > 0) {
              if (updateProgress) {
                updateProgress(`Discovered ${vlanIds.length} VLANs on ${ipAddress}. Getting MAC addresses...`, 50);
              }
              
              // Discover MAC addresses using the VLANs
              const { macAddresses } = await discoverMacAddresses(
                ipAddress, 
                'public', 
                '2c', 
                vlanIds, 
                updateProgress,
                siteId,
                subnetId,
                userId
              );
              
              console.log(`Discovered ${macAddresses.length} MAC addresses on ${ipAddress}`);
              
              // Attach the MAC addresses to the device for saving
              if (macAddresses.length > 0) {
                discoveredDevice.macAddresses = macAddresses;
                discoveredDevice.needs_verification = false;
              }
            }
          } catch (error) {
            console.error(`Error discovering VLANs/MACs on ${ipAddress}:`, error);
          }
        } else {
          console.log(`Device at ${ipAddress} is not a network device (category: ${deviceInfo.category})`);
        }
        
        // Determine if we have enough info to not need verification
        if (deviceInfo.hostname && deviceInfo.make && deviceInfo.model && deviceInfo.category) {
          discoveredDevice.needs_verification = false;
        }
      }
    } catch (error) {
      console.error(`Error getting detailed device info for ${ipAddress}:`, error);
    }
    
    return discoveredDevice;
  } catch (error) {
    console.error(`Error discovering IP ${ipAddress}:`, error);
    return null;
  }
}

/**
 * Discover all devices in a subnet
 */
export async function discoverDevicesInSubnet(
  cidr: string,
  updateProgress?: (message: string, progress: number) => void,
  backendConnected: boolean = false,
  userId?: string,
  siteId?: string, 
  subnetId?: string
): Promise<DiscoveredDevice[]> {
  try {
    console.log(`Starting discovery for subnet ${cidr}`);
    const ipAddresses = ipUtils.getHostsInSubnet(cidr);
    const totalIPs = ipAddresses.length;
    
    console.log(`Found ${totalIPs} IPs in subnet ${cidr}`);
    
    if (updateProgress) {
      updateProgress(`Scanning ${totalIPs} IP addresses in ${cidr}...`, 10);
    }
    
    const discoveredDevices: DiscoveredDevice[] = [];
    let processed = 0;
    
    // Process IPs in batches for better UI responsiveness
    const batchSize = 10;
    for (let i = 0; i < ipAddresses.length; i += batchSize) {
      const batch = ipAddresses.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(ip => discoverIP(ip, undefined, backendConnected, userId, siteId, subnetId))
      );
      
      processed += batch.length;
      
      // Filter out null results and add discovered devices
      batchResults.forEach(result => {
        if (result) {
          discoveredDevices.push(result);
        }
      });
      
      // Update progress
      if (updateProgress) {
        const progressPercent = Math.floor((processed / totalIPs) * 100);
        updateProgress(
          `Scanned ${processed}/${totalIPs} IP addresses. Found ${discoveredDevices.length} devices...`, 
          progressPercent
        );
      }
    }
    
    console.log(`Subnet discovery complete. Found ${discoveredDevices.length} devices in ${cidr}`);
    
    if (updateProgress) {
      updateProgress(`Discovery complete. Found ${discoveredDevices.length} devices in ${cidr}.`, 100);
    }
    
    return discoveredDevices;
  } catch (error) {
    console.error(`Error discovering devices in subnet ${cidr}:`, error);
    throw error;
  }
}
