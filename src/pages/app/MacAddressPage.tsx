
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { TabletSmartphoneIcon, SearchIcon, WifiIcon, AlertTriangleIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { discoverMacAddresses } from "@/utils/network/snmpDiscovery";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

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
  const [error, setError] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // First, establish the selected site ID from URL or session storage
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const siteIdFromUrl = params.get('site');
    const storedSiteId = sessionStorage.getItem('selectedSiteId');
    
    // Priority: URL param > session storage
    const siteId = siteIdFromUrl || storedSiteId;
    
    console.log(`MacAddressPage: Initial site ID check - URL: ${siteIdFromUrl}, Session: ${storedSiteId}, Using: ${siteId}`);
    
    if (siteId) {
      setSelectedSiteId(siteId);
      // Ensure session storage is consistent with our selection
      if (siteId !== storedSiteId) {
        console.log(`MacAddressPage: Updating session storage with site ID: ${siteId}`);
        sessionStorage.setItem('selectedSiteId', siteId);
      }
    } else {
      console.warn("MacAddressPage: No site ID found in URL or session storage");
      setError("No site selected. Please select a site from the sidebar first.");
      toast({
        title: "No Site Selected",
        description: "Please select a site from the sidebar first.",
        variant: "destructive",
      });
    }
  }, [location.search, toast]);

  const fetchMacAddresses = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!selectedSiteId) {
      console.error("No site ID available for fetching MAC addresses");
      setError("No site selected. Please select a site from the sidebar first.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log(`MacAddressPage: Fetching MAC addresses for site ${selectedSiteId}`);
      
      // First check if VLANs exist for this site
      const { data: vlans, error: vlansError, count: vlanCount } = await supabase
        .from('vlans')
        .select('*', { count: 'exact' })
        .eq('site_id', selectedSiteId);
        
      if (vlansError) {
        console.error("Error fetching VLANs:", vlansError);
        setError("Error fetching VLAN information. Please try again.");
        setLoading(false);
        toast({
          title: "Error",
          description: "Failed to load VLAN information.",
          variant: "destructive",
        });
        return;
      }
      
      console.log(`MacAddressPage: Found ${vlans?.length || 0} VLANs for site ${selectedSiteId}`);
      
      if (!vlans || vlans.length === 0) {
        console.error("No VLANs found for site:", selectedSiteId);
        setError("No VLANs found. Please discover VLANs first.");
        setLoading(false);
        toast({
          title: "No VLANs Found",
          description: "You need to discover VLANs first before discovering MAC addresses.",
          variant: "destructive",
        });
        navigate(`/vlans?site=${selectedSiteId}`);
        return;
      }
      
      // Check if subnets exist for this site
      const { data: subnets, error: subnetsError } = await supabase
        .from('subnets')
        .select('*')
        .eq('site_id', selectedSiteId)
        .order('created_at', { ascending: false });
        
      if (subnetsError) {
        console.error("Error fetching subnets:", subnetsError);
        setError("Error fetching subnet information. Please try again.");
        setLoading(false);
        toast({
          title: "Error",
          description: "Failed to load subnet information.",
          variant: "destructive",
        });
        return;
      }
      
      if (!subnets || subnets.length === 0) {
        console.error("No subnets found for site:", selectedSiteId);
        setError("No subnet information found. Please complete network discovery first.");
        setLoading(false);
        toast({
          title: "No Subnet Information",
          description: "Network information is missing. Please complete network discovery first.",
          variant: "destructive",
        });
        navigate(`/site-subnet?site=${selectedSiteId}`);
        return;
      }
      
      // Find switch devices for this specific site
      const { data: devices, error: devicesError } = await supabase
        .from('devices')
        .select('*')
        .eq('site_id', selectedSiteId)
        .eq('category', 'Switch')
        .limit(1);
        
      if (devicesError) {
        console.error("Error fetching switch devices:", devicesError);
        setError("Error fetching switch devices. Please try again.");
        setLoading(false);
        toast({
          title: "Error",
          description: "Failed to find network switches.",
          variant: "destructive",
        });
        return;
      }
      
      if (!devices || devices.length === 0) {
        console.error("No switch devices found for site:", selectedSiteId);
        setError("No switch devices found. Please complete device discovery first.");
        setLoading(false);
        toast({
          title: "No Switch Found",
          description: "No switch device found in the network. Please complete device discovery first.",
          variant: "destructive",
        });
        navigate(`/devices?site=${selectedSiteId}`);
        return;
      }
      
      const switchIp = devices[0].ip_address;
      const subnet = subnets[0];
      const community = subnet.snmp_community || 'public';
      const version = subnet.snmp_version || '2c';
      
      console.log(`Using switch ${switchIp} with community ${community} and version ${version} for site ${selectedSiteId}`);
      
      toast({
        title: "Discovering MAC Addresses",
        description: `Using SNMP to discover MAC addresses on ${switchIp}...`,
      });
      
      const macAddressResults = await discoverMacAddresses(
        switchIp,
        community,
        version,
        (message: string, progress: number) => {
          console.log(`MAC discovery progress: ${message} (${progress}%)`);
        }
      );
      
      console.log(`Discovered ${macAddressResults.macAddresses.length} MAC addresses across ${macAddressResults.vlanIds.length} VLANs for site ${selectedSiteId}`);
      
      const vlanMap = new Map();
      vlans.forEach(vlan => {
        vlanMap.set(vlan.vlan_id, vlan.name || `VLAN ${vlan.vlan_id}`);
      });
      
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
        setError("No MAC addresses found. The switch did not return any MAC address information.");
        toast({
          title: "No MAC Addresses Found",
          description: "No MAC addresses were discovered on the network.",
          variant: "destructive",
        });
      } else {
        setError(null);
        toast({
          title: "MAC Addresses Discovered",
          description: `Successfully discovered ${transformedMacs.length} MAC addresses.`,
        });
      }
    } catch (error) {
      console.error("Error loading MAC addresses:", error);
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
      toast({
        title: "Error Loading MAC Addresses",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Wait until we have a site ID before attempting to fetch MAC addresses
  useEffect(() => {
    if (selectedSiteId && user) {
      console.log(`MacAddressPage: Triggering MAC address fetch for site ${selectedSiteId}`);
      fetchMacAddresses();
    }
  }, [selectedSiteId, user]);

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
    navigate(`/export?site=${selectedSiteId}`);
  };

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    fetchMacAddresses();
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
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
              <div className="mt-4">
                <Button 
                  onClick={handleRetry} 
                  variant="outline" 
                  size="sm"
                  disabled={loading}
                >
                  Retry
                </Button>
              </div>
            </Alert>
          )}

          {!error && (
            <>
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

              {macAddresses.length > 0 && (
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
              )}
            </>
          )}
        </CardContent>
        <CardFooter className="flex justify-between border-t px-6 py-4">
          <Button 
            variant="outline"
            onClick={() => navigate(`/vlans?site=${selectedSiteId}`)}
          >
            Back
          </Button>
          <Button 
            onClick={handleNext} 
            disabled={loading || error !== null || macAddresses.filter(mac => mac.selected).length === 0}
          >
            Continue to Export
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default MacAddressPage;
