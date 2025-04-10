import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { TabletSmartphoneIcon, SearchIcon, WifiIcon, XCircleIcon, CheckCircleIcon, AlertCircleIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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

const MacAddressPage = () => {
  const [macAddresses, setMacAddresses] = useState<MacAddress[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const fetchMacAddresses = async () => {
      if (!user) {
        navigate('/login');
        return;
      }

      try {
        setLoading(true);
        
        const { data: vlans, error: vlansError } = await supabase
          .from('vlans')
          .select('*')
          .eq('user_id', user.id);
          
        if (vlansError) {
          throw new Error(`Error fetching VLANs: ${vlansError.message}`);
        }
        
        const mockedMacs: MacAddress[] = [];
        
        if (vlans && vlans.length > 0) {
          vlans.forEach((vlan, index) => {
            for (let i = 0; i < 2; i++) {
              const macId = `${vlan.id}-mac-${i}`;
              const macAddress = generateRandomMac();
              
              mockedMacs.push({
                id: macId,
                macAddress,
                vlanId: vlan.vlan_id,
                segmentName: vlan.description || `Segment ${vlan.vlan_id}`,
                deviceType: i % 2 === 0 ? "Desktop" : "Mobile",
                port: i % 2 === 0 ? `GigabitEthernet1/0/${index + i}` : undefined,
                status: i % 3 === 0 ? "authenticated" : i % 3 === 1 ? "unauthenticated" : "unknown",
                selected: true
              });
            }
          });
        }
        
        setMacAddresses(mockedMacs);
      } catch (error) {
        console.error("Error loading MAC addresses:", error);
        toast({
          title: "Error Loading MAC Addresses",
          description: error instanceof Error ? error.message : "An unexpected error occurred",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMacAddresses();
  }, [user, navigate, toast]);

  const generateRandomMac = () => {
    return Array(6).fill(0)
      .map(() => Math.floor(Math.random() * 256).toString(16).padStart(2, '0'))
      .join(':')
      .toUpperCase();
  };

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
