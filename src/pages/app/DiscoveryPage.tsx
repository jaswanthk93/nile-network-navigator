
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { ScanSearchIcon, AlertTriangleIcon, WifiIcon, ServerIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface DiscoveryStatus {
  status: "idle" | "scanning" | "connecting" | "gathering" | "complete" | "error";
  progress: number;
  message: string;
  devices: number;
  error?: string;
}

const DiscoveryPage = () => {
  const [discovery, setDiscovery] = useState<DiscoveryStatus>({
    status: "idle",
    progress: 0,
    message: "Ready to begin network discovery",
    devices: 0,
  });
  const [subnetsToScan, setSubnetsToScan] = useState<any[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch subnets data to check if there are any subnets to scan
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
        // Try to get subnet IDs from session storage (set by SiteSubnetPage)
        const storedSubnetIds = sessionStorage.getItem('subnetIds');
        let query = supabase.from('subnets').select('*');
        
        // If we have specific subnet IDs, filter by them
        if (storedSubnetIds) {
          const subnetIds = JSON.parse(storedSubnetIds);
          query = query.in('id', subnetIds);
        } else {
          // Otherwise just get the user's subnets
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

        // Log the subnets for debugging
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

    setDiscovery({
      status: "scanning",
      progress: 5,
      message: "Scanning subnets for devices...",
      devices: 0,
    });

    // Generate realistic device count based on subnet size
    // For /32 (single IP), we'll find 1 device
    // For other netmasks, we'll generate a more realistic number based on subnet size
    const deviceCount = generateDeviceCountFromSubnet(subnetsToScan[0].cidr);
    
    // Simulate discovery process with more realistic timing
    setTimeout(() => {
      setDiscovery({
        status: "scanning",
        progress: 25,
        message: `Found ${deviceCount} device(s) on ${subnetsToScan[0].cidr}, continuing scan...`,
        devices: deviceCount,
      });
      
      setTimeout(() => {
        setDiscovery({
          status: "connecting",
          progress: 40,
          message: "Connecting to discovered devices...",
          devices: deviceCount,
        });
        
        setTimeout(() => {
          setDiscovery({
            status: "gathering",
            progress: 70,
            message: "Gathering device information...",
            devices: deviceCount,
          });
          
          setTimeout(async () => {
            try {
              // Delete any existing devices for this subnet to avoid duplicates
              const { error: deleteError } = await supabase
                .from('devices')
                .delete()
                .eq('subnet_id', subnetsToScan[0].id)
                .eq('user_id', user.id);
                
              if (deleteError) {
                console.error('Error deleting existing devices:', deleteError);
              }
              
              // Generate more realistic mock devices based on the subnet
              const mockDevices = generateMockDevicesFromSubnet(
                subnetsToScan[0].cidr,
                subnetsToScan[0].site_id,
                subnetsToScan[0].id,
                user.id,
                deviceCount
              );
                
              // Insert discovered devices into the database
              const { error: insertError } = await supabase
                .from('devices')
                .insert(mockDevices);
              
              if (insertError) {
                console.error('Error inserting devices:', insertError);
                setDiscovery({
                  status: "error",
                  progress: 70,
                  message: "Error saving device information",
                  devices: deviceCount,
                  error: "Database error occurred while saving devices"
                });
                
                toast({
                  title: "Database Error",
                  description: "Failed to save discovered devices.",
                  variant: "destructive",
                });
                return;
              }
              
              setDiscovery({
                status: "complete",
                progress: 100,
                message: `Discovery complete! Found ${deviceCount} device(s).`,
                devices: deviceCount,
              });
              
              toast({
                title: "Discovery complete",
                description: `Successfully discovered ${deviceCount} network device(s).`,
              });
            } catch (error) {
              console.error('Error during device saving:', error);
              setDiscovery({
                status: "error",
                progress: 70,
                message: "Error during device discovery",
                devices: 0,
                error: "An unexpected error occurred"
              });
            }
          }, 3000);
        }, 2500);
      }, 2000);
    }, 1500);
  };

  // Helper function to generate device count based on subnet CIDR
  const generateDeviceCountFromSubnet = (cidr: string): number => {
    if (cidr.includes('/32')) {
      // For a single IP address (/32), return 1 device
      return 1;
    }
    
    // Extract the subnet mask
    const maskBits = parseInt(cidr.split('/')[1]);
    
    if (maskBits >= 30) {
      // Small subnet, few devices
      return Math.floor(Math.random() * 3) + 1;
    } else if (maskBits >= 24) {
      // Medium subnet, moderate devices
      return Math.floor(Math.random() * 8) + 3;
    } else {
      // Large subnet, many devices
      return Math.floor(Math.random() * 15) + 5;
    }
  };
  
  // Helper function to generate mock devices from a subnet
  const generateMockDevicesFromSubnet = (
    cidr: string, 
    siteId: string, 
    subnetId: string, 
    userId: string,
    count: number
  ) => {
    const baseIp = cidr.split('/')[0];
    const ipParts = baseIp.split('.');
    
    return Array.from({ length: count }, (_, i) => {
      let deviceIp = baseIp;
      
      // If not a /32, generate sequential IPs within the subnet
      if (!cidr.includes('/32') && i > 0) {
        const lastOctet = parseInt(ipParts[3]) + i;
        deviceIp = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.${lastOctet}`;
      }
      
      const deviceTypes = ['Switch', 'Router', 'AP'];
      const makeOptions = ['Cisco', 'Juniper', 'Aruba', 'HPE'];
      
      const randomType = deviceTypes[Math.floor(Math.random() * deviceTypes.length)];
      const randomMake = makeOptions[Math.floor(Math.random() * makeOptions.length)];
      
      return {
        site_id: siteId,
        subnet_id: subnetId,
        ip_address: deviceIp,
        hostname: `DEVICE-${deviceIp.split('.').join('-')}`,
        make: randomMake,
        model: `Model-${Math.floor(Math.random() * 1000) + 1}`,
        category: randomType,
        status: 'online',
        user_id: userId
      };
    });
  };

  const simulateError = () => {
    setDiscovery({
      status: "scanning",
      progress: 5,
      message: "Scanning subnets for devices...",
      devices: 0,
    });

    setTimeout(() => {
      setDiscovery({
        status: "error",
        progress: 15,
        message: "Error during discovery",
        devices: 3,
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
              </div>
              <div className="rounded-md border p-4">
                <div className="flex items-center gap-2">
                  <ServerIcon className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">Subnets Scanned</h3>
                </div>
                <p className="mt-2 text-2xl font-bold">
                  {subnetsToScan?.length ? `1/${subnetsToScan.length}` : "0/0"}
                </p>
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
