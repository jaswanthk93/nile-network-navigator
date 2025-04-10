
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScanSearchIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDiscovery } from "@/hooks/useDiscovery";
import BackendStatusIndicator from "@/components/discovery/BackendStatusIndicator";
import DiscoveryProgress from "@/components/discovery/DiscoveryProgress";

const DiscoveryPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    discovery, 
    backendStatus, 
    isCheckingBackend, 
    checkBackendStatus, 
    startDiscovery,
    resetDiscovery
  } = useDiscovery(user?.id);

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
          
          <BackendStatusIndicator 
            backendStatus={backendStatus}
            isCheckingBackend={isCheckingBackend}
            checkBackendStatus={checkBackendStatus}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <DiscoveryProgress 
            discovery={discovery}
            checkBackendStatus={checkBackendStatus}
            resetDiscovery={resetDiscovery}
            isCheckingBackend={isCheckingBackend}
          />
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
