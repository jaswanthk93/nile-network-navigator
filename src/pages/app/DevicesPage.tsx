
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { MonitorIcon, SearchIcon, ServerIcon, WifiIcon, RouterIcon, PrinterIcon } from "lucide-react";

interface Device {
  id: string;
  ipAddress: string;
  hostname: string;
  make: string;
  model: string;
  category: "AP" | "Switch" | "Controller" | "Router" | "Other";
  status: "online" | "offline" | "unknown";
}

const mockDevices: Device[] = [
  {
    id: "1",
    ipAddress: "192.168.10.1",
    hostname: "CORE-SW-01",
    make: "Cisco",
    model: "Catalyst 3850",
    category: "Switch",
    status: "online"
  },
  {
    id: "2",
    ipAddress: "192.168.10.2",
    hostname: "DIST-SW-01",
    make: "Cisco",
    model: "Catalyst 3650",
    category: "Switch",
    status: "online"
  },
  {
    id: "3",
    ipAddress: "192.168.10.10",
    hostname: "ACC-SW-01",
    make: "Juniper",
    model: "EX3400",
    category: "Switch",
    status: "online"
  },
  {
    id: "4",
    ipAddress: "192.168.10.20",
    hostname: "WIFI-CTRL-01",
    make: "Aruba",
    model: "AP-505",
    category: "Controller",
    status: "online"
  },
  {
    id: "5",
    ipAddress: "192.168.10.30",
    hostname: "AP-LOBBY-01",
    make: "Aruba",
    model: "AP-303",
    category: "AP",
    status: "online"
  },
  {
    id: "6",
    ipAddress: "192.168.10.31",
    hostname: "AP-OFFICE-01",
    make: "Aruba",
    model: "AP-303",
    category: "AP",
    status: "online"
  },
  {
    id: "7",
    ipAddress: "192.168.10.32",
    hostname: "AP-CONF-01",
    make: "Aruba",
    model: "AP-303",
    category: "AP",
    status: "offline"
  },
  {
    id: "8",
    ipAddress: "192.168.10.100",
    hostname: "RTR-EDGE-01",
    make: "Cisco",
    model: "ISR 4451",
    category: "Router",
    status: "online"
  }
];

const DevicesPage = () => {
  const [devices, setDevices] = useState<Device[]>(mockDevices);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const { toast } = useToast();
  const navigate = useNavigate();

  const filteredDevices = devices.filter(device => {
    const matchesSearch = device.hostname.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          device.ipAddress.includes(searchTerm);
    const matchesCategory = categoryFilter === "all" || device.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleSaveEdit = (id: string, field: keyof Device, value: string) => {
    setDevices(devices.map(device => 
      device.id === id ? { ...device, [field]: value } : device
    ));
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

  const handleConfirmDevices = () => {
    toast({
      title: "Devices confirmed",
      description: "Device information has been saved.",
    });
    navigate("/vlans");
  };

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
                  <TableHead className="w-[100px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                      No devices found matching filter criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDevices.map((device) => (
                    <TableRow key={device.id}>
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
                            {device.hostname}
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
                            {device.make}
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
                            {device.model}
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
          <Button onClick={handleConfirmDevices}>
            Confirm Devices
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default DevicesPage;
