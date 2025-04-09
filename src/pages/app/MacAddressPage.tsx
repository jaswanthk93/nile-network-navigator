
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { TabletSmartphoneIcon, SearchIcon, WifiIcon, XCircleIcon, CheckCircleIcon, AlertCircleIcon } from "lucide-react";

interface MacAddress {
  id: string;
  macAddress: string;
  vlanId: number;
  segmentName: string;
  deviceType: string;
  port?: string;
  status: "authenticated" | "unauthenticated" | "unknown";
  selected: boolean;
}

const mockMacAddresses: MacAddress[] = [
  {
    id: "1",
    macAddress: "00:1A:2B:3C:4D:5E",
    vlanId: 10,
    segmentName: "Employee",
    deviceType: "Laptop",
    port: "GigabitEthernet1/0/1",
    status: "authenticated",
    selected: true
  },
  {
    id: "2",
    macAddress: "AA:BB:CC:DD:EE:FF",
    vlanId: 10,
    segmentName: "Employee",
    deviceType: "Desktop",
    port: "GigabitEthernet1/0/2",
    status: "authenticated",
    selected: true
  },
  {
    id: "3",
    macAddress: "11:22:33:44:55:66",
    vlanId: 20,
    segmentName: "Voice",
    deviceType: "IP Phone",
    port: "GigabitEthernet1/0/3",
    status: "authenticated",
    selected: true
  },
  {
    id: "4",
    macAddress: "AA:11:BB:22:CC:33",
    vlanId: 30,
    segmentName: "Guest",
    deviceType: "Mobile",
    status: "unauthenticated",
    selected: false
  },
  {
    id: "5",
    macAddress: "DD:EE:FF:00:11:22",
    vlanId: 40,
    segmentName: "IoT",
    deviceType: "Camera",
    port: "GigabitEthernet1/0/4",
    status: "authenticated",
    selected: true
  },
  {
    id: "6",
    macAddress: "33:44:55:66:77:88",
    vlanId: 10,
    segmentName: "Employee",
    deviceType: "Unknown",
    status: "unknown",
    selected: false
  },
  {
    id: "7",
    macAddress: "99:88:77:66:55:44",
    vlanId: 40,
    segmentName: "IoT",
    deviceType: "Thermostat",
    port: "GigabitEthernet1/0/5",
    status: "authenticated",
    selected: true
  },
  {
    id: "8",
    macAddress: "55:44:33:22:11:00",
    vlanId: 30,
    segmentName: "Guest",
    deviceType: "Mobile",
    status: "unauthenticated",
    selected: false
  }
];

const MacAddressPage = () => {
  const [macAddresses, setMacAddresses] = useState<MacAddress[]>(mockMacAddresses);
  const [searchTerm, setSearchTerm] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const navigate = useNavigate();

  const filteredMacAddresses = macAddresses.filter(mac => {
    const matchesSearch = mac.macAddress.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          mac.deviceType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSegment = segmentFilter === "all" || mac.segmentName === segmentFilter;
    const matchesStatus = statusFilter === "all" || mac.status === statusFilter;
    return matchesSearch && matchesSegment && matchesStatus;
  });

  const segments = Array.from(new Set(macAddresses.map(mac => mac.segmentName)));

  const toggleMacSelection = (id: string) => {
    setMacAddresses(macAddresses.map(mac => 
      mac.id === id ? { ...mac, selected: !mac.selected } : mac
    ));
  };

  const toggleAll = (selected: boolean) => {
    setMacAddresses(macAddresses.map(mac => ({ ...mac, selected })));
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "authenticated":
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case "unauthenticated":
        return <XCircleIcon className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircleIcon className="h-4 w-4 text-yellow-500" />;
    }
  };

  const handleNext = () => {
    const selectedCount = macAddresses.filter(mac => mac.selected).length;
    if (selectedCount === 0) {
      toast({
        title: "No MAC addresses selected",
        description: "Please select at least one MAC address to continue.",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "MAC addresses confirmed",
      description: `${selectedCount} MAC addresses selected for migration.`,
    });
    navigate("/export");
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">MAC Address Management</h1>
        <p className="text-muted-foreground">
          Select MAC addresses to include in your Nile migration.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TabletSmartphoneIcon className="h-5 w-5" />
            MAC Addresses
          </CardTitle>
          <CardDescription>
            Review MAC addresses discovered on your network and select which ones to include
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 sm:space-x-2 pb-4">
            <div className="relative w-full sm:w-auto">
              <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search MAC addresses..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-col sm:flex-row w-full sm:w-auto space-y-2 sm:space-y-0 sm:space-x-2">
              <Select
                value={segmentFilter}
                onValueChange={(value) => setSegmentFilter(value)}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by segment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Segments</SelectItem>
                  {segments.map((segment) => (
                    <SelectItem key={segment} value={segment}>
                      {segment}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value)}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="authenticated">Authenticated</SelectItem>
                  <SelectItem value="unauthenticated">Unauthenticated</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox 
                      checked={filteredMacAddresses.length > 0 && filteredMacAddresses.every(mac => mac.selected)}
                      onCheckedChange={(checked) => toggleAll(!!checked)}
                    />
                  </TableHead>
                  <TableHead>MAC Address</TableHead>
                  <TableHead>VLAN</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Port</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMacAddresses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                      No MAC addresses found matching filter criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMacAddresses.map((mac) => (
                    <TableRow key={mac.id}>
                      <TableCell>
                        <Checkbox 
                          checked={mac.selected}
                          onCheckedChange={() => toggleMacSelection(mac.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono">{mac.macAddress}</TableCell>
                      <TableCell>{mac.vlanId}</TableCell>
                      <TableCell>{mac.segmentName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <WifiIcon className="h-4 w-4 text-muted-foreground" />
                          {mac.deviceType}
                        </div>
                      </TableCell>
                      <TableCell>{mac.port || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {getStatusIcon(mac.status)}
                          <span className="capitalize">{mac.status}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              <p>Selected: {macAddresses.filter(mac => mac.selected).length} of {macAddresses.length}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>
                Deselect All
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t px-6 py-4">
          <Button 
            variant="outline"
            onClick={() => navigate("/vlans")}
          >
            Back
          </Button>
          <Button onClick={handleNext}>
            Continue to Export
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default MacAddressPage;
