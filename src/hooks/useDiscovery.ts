
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { discoverDevicesInSubnet, saveDiscoveredDevices } from "@/utils/networkDiscovery";
import { checkBackendConnection } from "@/utils/backendConnection";

interface DiscoveryStatus {
  status: "idle" | "scanning" | "connecting" | "gathering" | "complete" | "error";
  progress: number;
  message: string;
  devices: number;
  devicesNeedingVerification: number;
  devicesByCategory?: Record<string, number>;
  error?: string;
  errorType?: string;
}

interface BackendStatus {
  connected: boolean;
  message: string;
  errorType?: 'timeout' | 'network' | 'server' | 'unknown';
  lastChecked: Date;
}

export const useDiscovery = (userId: string | undefined) => {
  const [discovery, setDiscovery] = useState<DiscoveryStatus>({
    status: "idle",
    progress: 0,
    message: "Ready to begin network discovery",
    devices: 0,
    devicesNeedingVerification: 0
  });
  const [subnetsToScan, setSubnetsToScan] = useState<any[]>([]);
  const [currentSubnetIndex, setCurrentSubnetIndex] = useState(0);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [isCheckingBackend, setIsCheckingBackend] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const checkBackendStatus = async () => {
    setIsCheckingBackend(true);
    try {
      const result = await checkBackendConnection();
      setBackendStatus({
        ...result,
        lastChecked: new Date()
      });
      
      if (!result.connected) {
        toast({
          title: "Backend Not Connected",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to check backend connection:", error);
      setBackendStatus({
        connected: false,
        message: error instanceof Error ? error.message : "Unknown error checking connection",
        errorType: "unknown",
        lastChecked: new Date()
      });
    } finally {
      setIsCheckingBackend(false);
    }
  };
  
  useEffect(() => {
    checkBackendStatus();
  }, [toast]);

  useEffect(() => {
    const fetchSubnets = async () => {
      if (!userId) {
        toast({
          title: "Authentication Required",
          description: "You must be logged in to start discovery.",
          variant: "destructive",
        });
        navigate('/login');
        return;
      }
      
      try {
        const storedSubnetIds = sessionStorage.getItem('subnetIds');
        let query = supabase.from('subnets').select('*');
        
        if (storedSubnetIds) {
          const subnetIds = JSON.parse(storedSubnetIds);
          query = query.in('id', subnetIds);
        } else {
          query = query.eq('user_id', userId);
        }
        
        const { data: subnets, error } = await query;
        
        if (error) {
          console.error('Error fetching subnets:', error);
          toast({
            title: "Error",
            description: "Failed to load subnet information.",
            variant: "destructive",
          });
          return;
        }

        if (!subnets || subnets.length === 0) {
          toast({
            title: "No Subnets Found",
            description: "Please add at least one subnet before starting discovery.",
            variant: "destructive",
          });
          navigate('/site-subnet');
          return;
        }

        console.log('Subnets available for scanning:', subnets);
        setSubnetsToScan(subnets);
      } catch (error) {
        console.error('Error in subnet fetching:', error);
        toast({
          title: "Error",
          description: "An unexpected error occurred while loading subnets.",
          variant: "destructive",
        });
      }
    };

    fetchSubnets();
  }, [userId, toast, navigate]);
  
  const updateDiscoveryProgress = (message: string, progress: number) => {
    setDiscovery(prev => ({
      ...prev,
      message,
      progress: Math.min(prev.progress + (progress * 0.7 / 100), 70),
    }));
  };

  const resetDiscovery = () => {
    setDiscovery({
      status: "idle",
      progress: 0,
      message: "Ready to begin network discovery",
      devices: 0,
      devicesNeedingVerification: 0
    });
  };

  const startDiscovery = async () => {
    if (!userId) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to start discovery.",
        variant: "destructive",
      });
      navigate('/login');
      return;
    }

    if (!subnetsToScan || subnetsToScan.length === 0) {
      toast({
        title: "No Subnets",
        description: "Please add at least one subnet before starting discovery.",
        variant: "destructive",
      });
      navigate('/site-subnet');
      return;
    }

    // Check backend connection before starting
    await checkBackendStatus();
    
    if (!backendStatus?.connected) {
      toast({
        title: "Backend Not Connected",
        description: "Cannot proceed with discovery. Backend agent is not connected.",
        variant: "destructive",
      });
      
      setDiscovery({
        status: "error",
        progress: 0,
        message: "Backend connection required for discovery",
        devices: 0,
        devicesNeedingVerification: 0,
        error: "Backend agent not connected. Please check connection and try again.",
        errorType: backendStatus?.errorType
      });
      
      return;
    }

    try {
      setDiscovery({
        status: "scanning",
        progress: 5,
        message: "Starting network scan...",
        devices: 0,
        devicesNeedingVerification: 0
      });
      
      const subnetToScan = subnetsToScan[currentSubnetIndex];
      
      const { error: deleteError } = await supabase
        .from('devices')
        .delete()
        .eq('subnet_id', subnetToScan.id)
        .eq('user_id', userId);
        
      if (deleteError) {
        console.error('Error deleting existing devices:', deleteError);
        toast({
          title: "Database Error",
          description: "Failed to clean up existing device records.",
          variant: "destructive",
        });
      }
      
      setDiscovery(prev => ({
        ...prev,
        status: "scanning",
        message: `Scanning subnet ${subnetsToScan[currentSubnetIndex].cidr}...`,
      }));
      
      // Use the backend connection for discovery
      console.log("Starting discovery with backend connected:", backendStatus.connected);
      const discoveredDevices = await discoverDevicesInSubnet(
        subnetsToScan[currentSubnetIndex].cidr,
        updateDiscoveryProgress,
        true // Always attempt to use real backend connection
      );
      
      const devicesNeedingVerification = discoveredDevices.filter(device => 
        device.needs_verification === true
      ).length;
      
      const devicesByCategory: Record<string, number> = {};
      discoveredDevices.forEach(device => {
        const category = device.category || 'Unknown';
        devicesByCategory[category] = (devicesByCategory[category] || 0) + 1;
      });
      
      setDiscovery(prev => ({
        ...prev,
        status: "gathering",
        message: `Found ${discoveredDevices.length} devices on ${subnetsToScan[currentSubnetIndex].cidr}. Gathering information...`,
        devices: discoveredDevices.length,
        devicesNeedingVerification,
        devicesByCategory,
        progress: 70
      }));
      
      setDiscovery(prev => ({
        ...prev,
        status: "connecting",
        message: "Saving device information to database...",
        progress: 80
      }));
      
      const devicesToSave = discoveredDevices.map(device => {
        const { needs_verification, ...deviceData } = device;
        return deviceData;
      });
      
      const { error: saveError } = await saveDiscoveredDevices(
        devicesToSave,
        subnetsToScan[currentSubnetIndex].site_id,
        subnetsToScan[currentSubnetIndex].id,
        userId
      );
      
      if (saveError) {
        throw new Error(`Error saving devices: ${saveError.message}`);
      }
      
      setDiscovery({
        status: "complete",
        progress: 100,
        message: `Discovery complete! Found ${discoveredDevices.length} device(s).`,
        devices: discoveredDevices.length,
        devicesNeedingVerification,
        devicesByCategory
      });
      
      const toastMessage = devicesNeedingVerification > 0 
        ? `Successfully discovered ${discoveredDevices.length} device(s). ${devicesNeedingVerification} need additional information.`
        : `Successfully discovered ${discoveredDevices.length} network device(s).`;
        
      toast({
        title: "Discovery complete",
        description: toastMessage,
      });
      
    } catch (error) {
      console.error('Error during discovery:', error);
      setDiscovery({
        status: "error",
        progress: discovery.progress,
        message: "Error during device discovery",
        devices: discovery.devices,
        devicesNeedingVerification: discovery.devicesNeedingVerification || 0,
        error: error instanceof Error ? error.message : "An unexpected error occurred"
      });
      
      toast({
        title: "Discovery Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred during discovery.",
        variant: "destructive",
      });
    }
  };

  return {
    discovery,
    subnetsToScan,
    backendStatus,
    isCheckingBackend,
    checkBackendStatus,
    startDiscovery,
    resetDiscovery
  };
};
