import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { MonitorIcon, SearchIcon, ServerIcon, WifiIcon, RouterIcon, PrinterIcon, AlertCircleIcon, CheckCircleIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DeviceData } from "@/types/network";

interface Device {
  id: string;
  ipAddress: string;
  hostname: string;
  make: string;
  model: string;
  category: "AP" | "Switch" | "Controller" | "Router" | "Other";
  status: "online" | "offline" | "unknown";
  needsVerification: boolean;
  confirmed: boolean;
  sysDescr?: string;
}

const DevicesPage = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const fetchDevices = async () => {
      if (!user) return;
      
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('devices')
        .select('*');
      
      if (error) {
        console.error('Error fetching devices:', error);
        toast({
          title: "Error",
          description: "Failed to load device information.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      const transformedDevices = data.map((device: DeviceData) => ({
        id: device.id,
        ipAddress: device.ip_address,
        hostname: device.hostname || '',
        make: device.make || '',
        model: device.model || '',
        category: (device.category as "AP" | "Switch" | "Controller" | "Router" | "Other") || 'Other',
        status: (device.status as "online" | "offline" | "unknown") || 'unknown',
        needsVerification: device.needs_verification || true,
        confirmed: device.confirmed || false,
        sysDescr: device.sysDescr || device.sysdescr || ''
      }));
      
      setDevices(transformedDevices);
      setIsLoading(false);
      
      console.log('Devices loaded:', transformedDevices);
    };

    fetchDevices();
  }, [user, toast]);

  const filteredDevices = devices.filter(device => {
    const matchesSearch = device.hostname.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          device.ipAddress.includes(searchTerm);
    const matchesCategory = categoryFilter === "all" || device.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleSaveEdit = async (id: string, field: keyof Device, value: string) => {
    try {
      setDevices(devices.map(device => 
        device.id === id ? { ...device, [field]: value } : device
      ));
      
      const fieldMapping: Record<string, string> = {
        'hostname': 'hostname',
        'make': 'make',
        'model': 'model',
        'category': 'category'
      };
      
      const { error } = await supabase
        .from('devices')
        .update({ 
          [fieldMapping[field]]: value,
          confirmed: true,
          needs_verification: false
        })
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      setDevices(devices.map(device => 
        device.id === id ? { 
          ...device, 
          [field]: value,
          confirmed: true,
          needsVerification: false
        } : device
      ));
      
      toast({
        title: "Device updated",
        description: `Successfully updated device ${field}.`,
      });
    } catch (error) {
      console.error('Error updating device:', error);
      toast({
        title: "Update failed",
        description: "Failed to update device information.",
        variant: "destructive",
      });
    }
    
    setEditingId(null);
  };

  const getDeviceIcon = (category: string) => {
    switch(category) {
      case "AP":
        return <WifiIcon className="h-4 w-4" />;
      case "Switch":
        return <ServerIcon className="h-4 w-4" />;
      case "Controller":
        return <MonitorIcon className="h-4 w-4" />;
      case "Router":
        return <RouterIcon className="h-4 w-4" />;
      default:
        return <PrinterIcon className="h-4 w-4" />;
    }
  };

  const handleConfirmDevices = async () => {
    try {
      const { error } = await supabase
        .from('devices')
        .update({ 
          confirmed: true,
          needs_verification: false 
        })
        .in('id', devices.map(d => d.id));
        
      if (error) {
        throw error;
      }
      
      setDevices(devices.map(device => ({
        ...device,
        confirmed: true,
        needsVerification: false
      })));
      
      toast({
        title: "Devices confirmed",
        description: "All device information has been saved.",
      });
      
      navigate("/vlans");
    } catch (error) {
      console.error('Error confirming devices:', error);
      toast({
        title: "Confirmation failed",
        description: "Failed to confirm device information.",
        variant: "destructive",
      });
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
          
          {devices.some(d => d.needsVerification) && (
            <div className="mt-2 text-amber-600 text-sm flex items-center gap-2">
              <AlertCircleIcon className="h-4 w-4" />
              <span>Some devices need verification. Please review and confirm their details.</span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between space-x-2 pb-4">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search devices..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Select
              value={categoryFilter}
              onValueChange={(value) => setCategoryFilter(value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Switch">Switches</SelectItem>
                <SelectItem value="AP">Access Points</SelectItem>
                <SelectItem value="Controller">Controllers</SelectItem>
                <SelectItem value="Router">Routers</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">IP Address</TableHead>
                  <TableHead>Hostname</TableHead>
                  <TableHead>Make</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px] text-center">Verified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                      {devices.length === 0 
                        ? "No devices discovered yet. Run a network discovery first." 
                        : "No devices found matching filter criteria"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDevices.map((device) => (
                    <TableRow key={device.id} className={device.needsVerification ? "bg-amber-50" : ""}>
                      <TableCell>{device.ipAddress}</TableCell>
                      <TableCell>
                        {editingId === `${device.id}-hostname` ? (
                          <Input
                            defaultValue={device.hostname}
                            className="h-8"
                            onBlur={(e) => handleSaveEdit(device.id, "hostname", e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSaveEdit(device.id, "hostname", (e.target as HTMLInputElement).value);
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <span
                            className="cursor-pointer hover:text-primary"
                            onClick={() => setEditingId(`${device.id}-hostname`)}
                          >
                            {device.hostname || "Click to add hostname"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === `${device.id}-make` ? (
                          <Select
                            defaultValue={device.make}
                            onValueChange={(value) => handleSaveEdit(device.id, "make", value)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Cisco">Cisco</SelectItem>
                              <SelectItem value="Juniper">Juniper</SelectItem>
                              <SelectItem value="Aruba">Aruba</SelectItem>
                              <SelectItem value="HPE">HPE</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span
                            className="cursor-pointer hover:text-primary"
                            onClick={() => setEditingId(`${device.id}-make`)}
                          >
                            {device.make || "Click to add make"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === `${device.id}-model` ? (
                          <Input
                            defaultValue={device.model}
                            className="h-8"
                            onBlur={(e) => handleSaveEdit(device.id, "model", e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSaveEdit(device.id, "model", (e.target as HTMLInputElement).value);
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <span
                            className="cursor-pointer hover:text-primary"
                            onClick={() => setEditingId(`${device.id}-model`)}
                          >
                            {device.model || "Click to add model"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === `${device.id}-category` ? (
                          <Select
                            defaultValue={device.category}
                            onValueChange={(value) => handleSaveEdit(device.id, "category", value)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Switch">Switch</SelectItem>
                              <SelectItem value="AP">Access Point</SelectItem>
                              <SelectItem value="Controller">Controller</SelectItem>
                              <SelectItem value="Router">Router</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span
                            className="cursor-pointer hover:text-primary flex items-center gap-1.5"
                            onClick={() => setEditingId(`${device.id}-category`)}
                          >
                            {getDeviceIcon(device.category)}
                            {device.category}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          device.status === 'online' 
                            ? 'bg-green-100 text-green-800' 
                            : device.status === 'offline'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {device.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {device.confirmed ? (
                          <CheckCircleIcon className="h-5 w-5 text-green-500 mx-auto" />
                        ) : (
                          <AlertCircleIcon className="h-5 w-5 text-amber-500 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

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
