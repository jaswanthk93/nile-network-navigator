import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { 
  ScanSearchIcon, 
  AlertTriangleIcon, 
  WifiIcon, 
  ServerIcon,
  AlertCircleIcon,
  DatabaseIcon
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const verifyBackendConnection = async () => {
      try {
        const result = await checkBackendConnection();
        setBackendConnected(result.connected);
        
        if (!result.connected) {
          toast({
            title: "Backend Not Connected",
            description: "The backend agent is not connected. SNMP device discovery will be limited.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Failed to check backend connection:", error);
        setBackendConnected(false);
      }
    };
    
    verifyBackendConnection();
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

    try {
      const result = await checkBackendConnection();
      setBackendConnected(result.connected);
      
      if (!result.connected) {
        toast({
          title: "Backend Not Connected",
          description: "The backend agent is not connected. SNMP discovery capabilities will be limited.",
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Failed to check backend connection:", error);
      setBackendConnected(false);
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
      
      const discoveredDevices = await discoverDevicesInSubnet(
        subnetsToScan[currentSubnetIndex].cidr,
        updateDiscoveryProgress
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

  const simulateError = () => {
    setDiscovery({
      status: "scanning",
      progress: 5,
      message: "Scanning subnets for devices...",
      devices: 0,
      devicesNeedingVerification: 0
    });

    setTimeout(() => {
      setDiscovery({
        status: "error",
        progress: 15,
        message: "Error during discovery",
        devices: 0,
        devicesNeedingVerification: 0,
        error: "Connection timeout on subnet"
      });
      
      toast({
        title: "Discovery error",
        description: "Connection timeout on subnet",
        variant: "destructive",
      });
    }, 2000);
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
          {backendConnected === false && (
            <div className="mt-2 flex items-center gap-2 text-amber-600 text-sm">
              <AlertCircleIcon className="h-4 w-4" />
              <span>Backend agent not connected. SNMP discovery capabilities limited.</span>
            </div>
          )}
          {backendConnected === true && (
            <div className="mt-2 flex items-center gap-2 text-green-600 text-sm">
              <DatabaseIcon className="h-4 w-4" />
              <span>Backend agent connected. SNMP discovery available.</span>
            </div>
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
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => setDiscovery({
                      status: "idle",
                      progress: 0,
                      message: "Ready to begin network discovery",
                      devices: 0,
                      devicesNeedingVerification: 0
                    })}
                  >
                    Retry
                  </Button>
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
              <Button onClick={startDiscovery}>
                Start Discovery
              </Button>
            )}
            {discovery.status === "idle" && (
              <Button variant="outline" onClick={simulateError}>
                Simulate Error
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
