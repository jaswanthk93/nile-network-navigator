
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
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch subnets data to check if there are any subnets to scan
  useEffect(() => {
    const fetchSubnets = async () => {
      if (!user) return;
      
      const { data: subnets, error } = await supabase
        .from('subnets')
        .select('*');
      
      if (error) {
        console.error('Error fetching subnets:', error);
        toast({
          title: "Error",
          description: "Failed to load subnet information.",
          variant: "destructive",
        });
      }

      // Log the subnets for debugging
      console.log('Subnets available for scanning:', subnets);
    };

    fetchSubnets();
  }, [user, toast]);

  const startDiscovery = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to start discovery.",
        variant: "destructive",
      });
      return;
    }

    // Check if we have any subnets to scan
    const { data: subnets, error: subnetsError } = await supabase
      .from('subnets')
      .select('*');
    
    if (subnetsError) {
      toast({
        title: "Error",
        description: "Failed to load subnet information.",
        variant: "destructive",
      });
      return;
    }

    if (!subnets || subnets.length === 0) {
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

    // Simulate discovery process - in a real implementation, this would make API calls 
    // to a backend service that performs the actual network scanning
    setTimeout(() => {
      setDiscovery({
        status: "scanning",
        progress: 25,
        message: `Found devices on ${subnets[0].cidr}, continuing scan...`,
        devices: 8,
      });
      
      setTimeout(() => {
        setDiscovery({
          status: "connecting",
          progress: 40,
          message: "Connecting to discovered devices...",
          devices: 12,
        });
        
        setTimeout(() => {
          setDiscovery({
            status: "gathering",
            progress: 70,
            message: "Gathering device information...",
            devices: 12,
          });
          
          setTimeout(async () => {
            // At this point, in a real implementation, we would insert the discovered
            // devices into the database
            const mockDevices = Array.from({ length: 12 }, (_, i) => ({
              site_id: subnets[0].site_id,
              subnet_id: subnets[0].id,
              ip_address: `192.168.1.${10 + i}`,
              hostname: `DEVICE-${i + 1}`,
              make: i % 2 === 0 ? 'Cisco' : 'Juniper',
              model: `Model-${i + 1}`,
              category: i % 3 === 0 ? 'Switch' : i % 3 === 1 ? 'Router' : 'AP',
              status: 'online',
              user_id: user.id
            }));
            
            // Insert discovered devices into the database
            const { error: insertError } = await supabase
              .from('devices')
              .upsert(mockDevices);
            
            if (insertError) {
              console.error('Error inserting devices:', insertError);
              setDiscovery({
                status: "error",
                progress: 70,
                message: "Error saving device information",
                devices: 12,
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
              message: `Discovery complete! Found ${mockDevices.length} devices.`,
              devices: mockDevices.length,
            });
            
            toast({
              title: "Discovery complete",
              description: `Successfully discovered ${mockDevices.length} network devices.`,
            });
          }, 3000);
        }, 2500);
      }, 2000);
    }, 1500);
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
                  {discovery.progress < 30 ? "1/1" : "1/1"}
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
