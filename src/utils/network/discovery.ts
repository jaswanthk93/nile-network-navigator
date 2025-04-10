
/**
 * Network discovery core functionality - refactored to use smaller modules
 */

import { parseCIDR, getIPRange } from './ipUtils';
import { scanSingleHost, scanNetworkRange } from './scanStrategies';
import { getDeviceInfoViaSNMP } from './snmpDiscovery';

/**
 * Function to discover devices in a subnet and gather information about them
 */
export async function discoverDevicesInSubnet(
  cidr: string,
  updateProgress: (message: string, progress: number) => void,
  backendConnected: boolean = false
): Promise<any[]> {
  if (!backendConnected) {
    throw new Error("Backend connection is required for device discovery");
  }
  
  const { baseIP, maskBits } = parseCIDR(cidr);
  
  // Get IP range based on subnet mask
  const { startIP, endIP, totalIPs } = getIPRange(cidr);
  
  // Get our local IP address for subnet calculation
  // In browser, we can't directly get the client's IP, so we'll use the base IP as a proxy
  const localIP = baseIP;
  
  // Create a helper function to pass to scan functions
  const getDeviceInfo = async (ip: string) => {
    return await getDeviceInfoViaSNMP(ip, updateProgress, backendConnected);
  };
  
  // For /32 subnets, we only need to scan the exact IP
  if (maskBits === 32) {
    return scanSingleHost(baseIP, localIP, maskBits, updateProgress, getDeviceInfo);
  }
  
  // For normal subnets, scan the range
  // Parse the IP octets
  const startOctets = startIP.split('.').map(Number);
  const endOctets = endIP.split('.').map(Number);
  
  return scanNetworkRange(
    startOctets,
    endOctets,
    startIP,
    endIP,
    totalIPs,
    localIP,
    maskBits,
    cidr,
    updateProgress,
    getDeviceInfo
  );
}
