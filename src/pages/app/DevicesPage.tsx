
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDeviceData } from "@/hooks/useDeviceData";
import { DeviceTable } from "@/components/devices/DeviceTable";
import VerificationBanner from "@/components/devices/VerificationBanner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Server, ArrowLeft, ArrowRight } from "lucide-react";

const DevicesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    devices, 
    isLoading, 
    handleSaveEdit, 
    handleDeleteDevice,
    confirmAllDevices 
  } = useDeviceData(user?.id);
  const [confirmingDevices, setConfirmingDevices] = useState(false);
  
  const needsVerificationCount = devices.filter(d => d.needsVerification).length;
  
  const handleConfirmAll = async () => {
    setConfirmingDevices(true);
    const success = await confirmAllDevices();
    setConfirmingDevices(false);
    
    if (success) {
      navigate("/vlans");
    }
  };
  
  return (
    <div className="container mx-auto max-w-7xl space-y-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Network Devices</h1>
        <p className="text-muted-foreground">
          Review and verify discovered network devices before continuing.
        </p>
      </div>
      
      {needsVerificationCount > 0 && (
        <VerificationBanner 
          count={needsVerificationCount} 
          total={devices.length} 
        />
      )}
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Device Inventory
          </CardTitle>
          <CardDescription>
            These devices were discovered on your network. Make any necessary corrections before proceeding.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeviceTable 
            devices={devices} 
            isLoading={isLoading} 
            onSaveEdit={handleSaveEdit}
            onDeleteDevice={handleDeleteDevice}
          />
        </CardContent>
        <CardFooter className="flex justify-between border-t px-6 py-4">
          <Button 
            variant="outline"
            onClick={() => navigate("/discovery")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Discovery
          </Button>
          <Button 
            onClick={handleConfirmAll}
            disabled={isLoading || confirmingDevices}
          >
            {confirmingDevices ? "Saving..." : "Confirm & Continue"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default DevicesPage;
