
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  ScanSearchIcon, 
  AlertTriangleIcon, 
  WifiIcon, 
  ServerIcon,
  AlertCircleIcon,
  DatabaseIcon,
  RefreshCwIcon
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { discoverDevicesInSubnet, saveDiscoveredDevices } from "@/utils/networkDiscovery";
import { 
  checkBackendConnection, 
  getConnectionErrorExplanation, 
  getConnectionTroubleshootingSteps 
} from "@/utils/backendConnection";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

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

const DiscoveryPage = () => {
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
  const { user } = useAuth();

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
      if (!user) {
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
          query = query.eq('user_id', user.id);
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
  }, [user, toast, navigate]);
  
  const updateDiscoveryProgress = (message: string, progress: number) => {
    setDiscovery(prev => ({
      ...prev,
      message,
      progress: Math.min(prev.progress + (progress * 0.7 / 100), 70),
    }));
  };

  const startDiscovery = async () => {
    if (!user) {
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
        .eq('user_id', user.id);
        
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
        user.id
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

  const handleNext = () => {
    navigate("/devices");
  };

  return (
    <div className="container mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Network Discovery</h1>
        <p className="text-muted-foreground">
          Discover devices on your network using the configured subnets.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanSearchIcon className="h-5 w-5" />
            Discovery Status
          </CardTitle>
          <CardDescription>
            {discovery.status === "idle" 
              ? "Ready to scan your network for devices" 
              : discovery.message}
          </CardDescription>
          
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {backendStatus?.connected ? (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <DatabaseIcon className="h-4 w-4" />
                  <span>Backend agent connected</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-600 text-sm">
                  <AlertCircleIcon className="h-4 w-4" />
                  <span>Backend agent not connected</span>
                </div>
              )}
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={checkBackendStatus}
              disabled={isCheckingBackend}
              className="flex items-center gap-1"
            >
              {isCheckingBackend ? (
                <>
                  <RefreshCwIcon className="h-3 w-3 animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <RefreshCwIcon className="h-3 w-3" />
                  <span>Check Connection</span>
                </>
              )}
            </Button>
          </div>
          
          {!backendStatus?.connected && backendStatus?.errorType && (
            <Alert variant="warning" className="mt-3">
              <AlertTitle>Backend Connection Failed</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{getConnectionErrorExplanation(backendStatus.errorType)}</p>
                <ul className="text-xs list-disc list-inside mt-1">
                  {getConnectionTroubleshootingSteps(backendStatus.errorType).map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{discovery.progress}%</span>
            </div>
            <Progress value={discovery.progress} className="h-2" />
          </div>

          {discovery.status === "error" && (
            <div className="mt-4 rounded-md bg-destructive/15 p-4">
              <div className="flex items-start">
                <AlertTriangleIcon className="h-5 w-5 text-destructive mr-2 mt-0.5" />
                <div>
                  <h4 className="font-medium text-destructive">Error during discovery</h4>
                  <p className="text-sm text-muted-foreground">
                    {discovery.error}
                  </p>
                  <div className="flex gap-2 mt-2">
                    {discovery.errorType === 'backend' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={checkBackendStatus}
                        disabled={isCheckingBackend}
                      >
                        {isCheckingBackend ? "Checking..." : "Check Backend"}
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setDiscovery({
                        status: "idle",
                        progress: 0,
                        message: "Ready to begin network discovery",
                        devices: 0,
                        devicesNeedingVerification: 0
                      })}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {discovery.status !== "idle" && discovery.status !== "error" && (
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-md border p-4">
                <div className="flex items-center gap-2">
                  <WifiIcon className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">Devices Found</h3>
                </div>
                <p className="mt-2 text-2xl font-bold">{discovery.devices}</p>
                {discovery.devicesByCategory && discovery.status === "complete" && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {Object.entries(discovery.devicesByCategory).map(([category, count]) => (
                      <div key={category} className="flex justify-between">
                        <span>{category}:</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-md border p-4">
                <div className="flex items-center gap-2">
                  <ServerIcon className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">Subnets Scanned</h3>
                </div>
                <p className="mt-2 text-2xl font-bold">
                  {subnetsToScan?.length ? `${currentSubnetIndex + 1}/${subnetsToScan.length}` : "0/0"}
                </p>
              </div>
            </div>
          )}
          
          {discovery.status === "complete" && discovery.devicesNeedingVerification > 0 && (
            <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-start">
                <AlertCircleIcon className="h-5 w-5 text-amber-500 mr-2 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-700">Additional Information Needed</h4>
                  <p className="text-sm text-amber-600">
                    {discovery.devicesNeedingVerification} device(s) were discovered but have limited information. 
                    This occurs when SNMP requests failed or devices are in different subnets from your host.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between border-t px-6 py-4">
          <Button 
            variant="outline"
            onClick={() => navigate("/site-subnet")}
            disabled={discovery.status !== "idle" && discovery.status !== "complete" && discovery.status !== "error"}
          >
            Back
          </Button>
          <div className="space-x-2">
            {discovery.status === "idle" && (
              <Button 
                onClick={startDiscovery}
                disabled={!backendStatus?.connected}
              >
                Start Discovery
              </Button>
            )}
            {discovery.status === "complete" && (
              <Button onClick={handleNext}>
                View Discovered Devices
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default DiscoveryPage;
