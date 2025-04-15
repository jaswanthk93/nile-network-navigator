
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { TabletSmartphoneIcon, SearchIcon, WifiIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { discoverMacAddressesWithSNMP } from "@/utils/apiClient";

interface MacAddress {
  id: string;
  macAddress: string;
  vlanId: number;
  segmentName: string;
  deviceType: string;
  port?: string;
  selected: boolean;
}

const MacAddressPage = () => {
  const [macAddresses, setMacAddresses] = useState<MacAddress[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
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
        
        // First, get the VLANs from the database
        const { data: vlans, error: vlansError } = await supabase
          .from('vlans')
          .select('*')
          .eq('user_id', user.id);
          
        if (vlansError) {
          throw new Error(`Error fetching VLANs: ${vlansError.message}`);
        }
        
        if (!vlans || vlans.length === 0) {
          toast({
            title: "No VLANs Found",
            description: "You need to discover VLANs first before discovering MAC addresses.",
            variant: "destructive",
          });
          navigate('/vlans');
          return;
        }
        
        // Get the site ID associated with the VLANs
        const siteId = vlans[0].site_id;
        
        // Get the subnet information for the site to find the switch IP address
        const { data: subnets, error: subnetsError } = await supabase
          .from('subnets')
          .select('*')
          .eq('site_id', siteId)
          .limit(1);
          
        if (subnetsError) {
          throw new Error(`Error fetching subnet information: ${subnetsError.message}`);
        }
        
        if (!subnets || subnets.length === 0) {
          toast({
            title: "No Subnet Information",
            description: "Network information is missing. Please complete network discovery first.",
            variant: "destructive",
          });
          navigate('/discovery');
          return;
        }
        
        // Get switch devices from the database
        const { data: devices, error: devicesError } = await supabase
          .from('devices')
          .select('*')
          .eq('subnet_id', subnets[0].id)
          .eq('category', 'Switch')
          .limit(1);
          
        if (devicesError) {
          throw new Error(`Error fetching switch devices: ${devicesError.message}`);
        }
        
        if (!devices || devices.length === 0) {
          toast({
            title: "No Switch Found",
            description: "No switch device found in the network. Please complete device discovery first.",
            variant: "destructive",
          });
          navigate('/devices');
          return;
        }
        
        const switchIp = devices[0].ip_address;
        const community = subnets[0].snmp_community || 'public';
        const version = subnets[0].snmp_version || '2c';
        
        // Now, use SNMP to discover MAC addresses
        toast({
          title: "Discovering MAC Addresses",
          description: `Using SNMP to discover MAC addresses on ${switchIp}...`,
        });
        
        console.log(`Starting MAC address discovery on ${switchIp} with community ${community} and version ${version}`);
        
        // Get MAC addresses from the switch using our new function
        const macAddressResults = await discoverMacAddressesWithSNMP(
          switchIp,
          community,
          version
        );
        
        console.log(`Discovered ${macAddressResults.macAddresses.length} MAC addresses`);
        
        // Create a map of VLAN IDs to names from the database
        const vlanMap = new Map();
        vlans.forEach(vlan => {
          vlanMap.set(vlan.vlan_id, vlan.name || `VLAN ${vlan.vlan_id}`);
        });
        
        // Transform the MAC addresses into our format with unique IDs
        const transformedMacs = macAddressResults.macAddresses.map((mac, index) => ({
          id: `mac-${index}`,
          macAddress: mac.macAddress,
          vlanId: mac.vlanId,
          segmentName: vlanMap.get(mac.vlanId) || `VLAN ${mac.vlanId}`,
          deviceType: mac.deviceType || 'Unknown',
          port: mac.port,
          selected: true
        }));
        
        setMacAddresses(transformedMacs);
        
        if (transformedMacs.length === 0) {
          toast({
            title: "No MAC Addresses Found",
            description: "No MAC addresses were discovered on the network.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "MAC Addresses Discovered",
            description: `Successfully discovered ${transformedMacs.length} MAC addresses.`,
          });
        }
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

  const filteredMacAddresses = macAddresses.filter(mac => {
    const matchesSearch = mac.macAddress.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          mac.deviceType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSegment = segmentFilter === "all" || mac.segmentName === segmentFilter;
    return matchesSearch && matchesSegment;
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 h-40">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        <p className="text-muted-foreground">Discovering MAC addresses via SNMP...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredMacAddresses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
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
