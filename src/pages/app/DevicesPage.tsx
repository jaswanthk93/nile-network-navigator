
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { MonitorIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import DeviceTable from "@/components/devices/DeviceTable";
import DeviceFilter from "@/components/devices/DeviceFilter";
import VerificationBanner from "@/components/devices/VerificationBanner";
import { useDeviceData } from "@/hooks/useDeviceData";

const DevicesPage = () => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { devices, isLoading, handleSaveEdit, confirmAllDevices } = useDeviceData(user?.id);

  const filteredDevices = devices.filter(device => {
    const matchesSearch = device.hostname.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          device.ipAddress.includes(searchTerm);
    const matchesCategory = categoryFilter === "all" || device.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleConfirmDevices = async () => {
    const success = await confirmAllDevices();
    if (success) {
      navigate("/vlans");
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto flex items-center justify-center h-screen">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Discovered Devices</h1>
        <p className="text-muted-foreground">
          Review and confirm the devices discovered on your network.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MonitorIcon className="h-5 w-5" />
            Network Devices
          </CardTitle>
          <CardDescription>
            Verify device information and make corrections if needed
          </CardDescription>
          
          <VerificationBanner 
            hasDevicesNeedingVerification={devices.some(d => d.needsVerification)} 
          />
        </CardHeader>
        <CardContent>
          <DeviceFilter 
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
          />

          <DeviceTable 
            devices={devices}
            filteredDevices={filteredDevices}
            editingId={editingId}
            setEditingId={setEditingId}
            handleSaveEdit={handleSaveEdit}
          />

          <div className="mt-4 text-sm text-muted-foreground">
            <p>Click on any field to edit device information</p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t px-6 py-4">
          <Button 
            variant="outline"
            onClick={() => navigate("/discovery")}
          >
            Back to Discovery
          </Button>
          <Button onClick={handleConfirmDevices} disabled={devices.length === 0}>
            Confirm Devices
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default DevicesPage;
