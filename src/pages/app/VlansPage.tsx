
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { FolderKanbanIcon, LayersIcon, TagIcon, Loader2Icon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Vlan {
  id: string;
  vlanId: number;
  name: string;
  segmentName: string;
  subnet?: string;
  usedBy: string[];
}

const VlansPage = () => {
  const [vlans, setVlans] = useState<Vlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{id: string, field: keyof Vlan} | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to view VLAN information.",
        variant: "destructive",
      });
      navigate('/login');
      return;
    }

    const fetchVlans = async () => {
      try {
        setLoading(true);
        
        // Fetch devices from the database
        const { data: devices, error: devicesError } = await supabase
          .from('devices')
          .select('*')
          .eq('user_id', user.id);
          
        if (devicesError) {
          throw new Error(`Error fetching devices: ${devicesError.message}`);
        }

        // Check if we have any devices
        if (!devices || devices.length === 0) {
          toast({
            title: "No Devices Found",
            description: "Please complete device discovery before proceeding to VLAN mapping.",
            variant: "destructive",
          });
          setLoading(false);
          navigate('/discovery');
          return;
        }

        // Fetch VLANs from the database
        const { data: vlanData, error: vlansError } = await supabase
          .from('vlans')
          .select('*')
          .eq('user_id', user.id);
          
        if (vlansError) {
          throw new Error(`Error fetching VLANs: ${vlansError.message}`);
        }

        // If we don't have VLAN data already, we need to fetch from the network
        if (!vlanData || vlanData.length === 0) {
          // In a real implementation, this is where we would query the network devices
          // For now, we'll populate with discovered information from the devices
          
          console.log("No VLANs found in database, attempting to discover...");
          
          // Group devices by category to identify switches
          const switches = devices.filter(device => 
            device.category === 'Switch' || device.make === 'Cisco' || device.make === 'Juniper'
          );
          
          if (switches.length === 0) {
            toast({
              title: "No Network Switches Found",
              description: "Unable to discover VLANs without switch information.",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
          
          // In a real implementation, we would connect to each switch and retrieve VLAN information
          // For now, we'll create a message to inform the user
          toast({
            title: "VLAN Discovery",
            description: `Found ${switches.length} switches. Unable to connect directly to fetch VLAN information. Please define VLANs manually.`,
          });
          
          // Create placeholder VLANs based on common configurations
          const discoveredVlans: Vlan[] = [
            {
              id: "1",
              vlanId: 1,
              name: "Default",
              segmentName: "Management",
              subnet: "", // Will be populated from device data if available
              usedBy: switches.map(s => s.hostname || s.ip_address).filter(Boolean) as string[]
            }
          ];
          
          // Look for subnet information in the discovered devices
          const subnets = new Set<string>();
          devices.forEach(device => {
            if (device.ip_address) {
              // Extract subnet from IP (simplified approach)
              const ipParts = device.ip_address.split('.');
              if (ipParts.length === 4) {
                const subnet = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.0/24`;
                subnets.add(subnet);
              }
            }
          });
          
          // Add subnets as potential VLANs
          let vlanCounter = 10; // Start VLANs at 10 (common practice)
          subnets.forEach(subnet => {
            if (subnet && !discoveredVlans.some(v => v.subnet === subnet)) {
              discoveredVlans.push({
                id: `generated-${vlanCounter}`,
                vlanId: vlanCounter,
                name: `VLAN_${vlanCounter}`,
                segmentName: "", // User will need to assign this
                subnet: subnet,
                usedBy: switches.slice(0, Math.min(2, switches.length))
                  .map(s => s.hostname || s.ip_address)
                  .filter(Boolean) as string[]
              });
              vlanCounter += 10;
            }
          });
          
          // If we still don't have VLANs, add some common ones
          if (discoveredVlans.length === 1) {
            const commonVlans = [
              { id: "10", vlanId: 10, name: "User_VLAN", segmentName: "", subnet: "" },
              { id: "20", vlanId: 20, name: "Voice_VLAN", segmentName: "", subnet: "" },
              { id: "30", vlanId: 30, name: "Guest_VLAN", segmentName: "", subnet: "" }
            ];
            
            commonVlans.forEach(vlan => {
              discoveredVlans.push({
                ...vlan,
                usedBy: switches.slice(0, Math.min(2, switches.length))
                  .map(s => s.hostname || s.ip_address)
                  .filter(Boolean) as string[]
              });
            });
          }
          
          setVlans(discoveredVlans);
          
          toast({
            title: "Initial VLAN Configuration Created",
            description: `Created ${discoveredVlans.length} initial VLAN entries based on network analysis. Please review and assign segment names.`,
          });
        } else {
          // Format the database VLANs to match our interface
          const formattedVlans: Vlan[] = vlanData.map(dbVlan => {
            // Find devices that might be using this VLAN
            const vlanDevices = devices
              .filter(d => d.category === 'Switch' || d.make === 'Cisco' || d.make === 'Juniper')
              .slice(0, 3)
              .map(d => d.hostname || d.ip_address)
              .filter(Boolean) as string[];
              
            return {
              id: dbVlan.id,
              vlanId: dbVlan.vlan_id,
              name: dbVlan.name,
              segmentName: dbVlan.description || "",
              subnet: "", // Would be populated from real data
              usedBy: vlanDevices
            };
          });
          
          setVlans(formattedVlans);
        }
      } catch (error) {
        console.error("Error loading VLAN data:", error);
        toast({
          title: "Error Loading VLANs",
          description: error instanceof Error ? error.message : "An unexpected error occurred",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchVlans();
  }, [user, toast, navigate]);

  const handleSaveEdit = (id: string, field: keyof Vlan, value: string) => {
    setVlans(vlans.map(vlan => 
      vlan.id === id ? { ...vlan, [field]: value } : vlan
    ));
    setEditingCell(null);
  };

  const handleConfirmVlans = async () => {
    // Validate that all VLANs have segment names
    const missingSegments = vlans.filter(vlan => !vlan.segmentName);
    if (missingSegments.length > 0) {
      toast({
        title: "Missing segment names",
        description: `Please assign segment names to all VLANs before proceeding.`,
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Save VLANs to database
      const vlansToSave = vlans.map(vlan => ({
        id: vlan.id.startsWith('generated-') ? undefined : vlan.id,
        user_id: user!.id,
        site_id: localStorage.getItem('currentSiteId') || null, // Get from storage or context
        vlan_id: vlan.vlanId,
        name: vlan.name,
        description: vlan.segmentName
      }));

      // Upsert VLANs to database
      const { error } = await supabase
        .from('vlans')
        .upsert(vlansToSave);

      if (error) {
        throw new Error(`Error saving VLANs: ${error.message}`);
      }

      toast({
        title: "VLAN configuration saved",
        description: "VLAN to segment mapping has been saved.",
      });
      
      navigate("/mac-addresses");
    } catch (error) {
      console.error("Error saving VLAN data:", error);
      toast({
        title: "Error Saving VLANs",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-6xl flex flex-col items-center justify-center h-[70vh]">
        <Loader2Icon className="h-12 w-12 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-semibold">Loading VLAN Information...</h2>
        <p className="text-muted-foreground">
          Retrieving VLAN data from network devices and database
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">VLAN Configuration</h1>
        <p className="text-muted-foreground">
          Map VLANs to network segments for migration to Nile.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderKanbanIcon className="h-5 w-5" />
            VLAN to Segment Mapping
          </CardTitle>
          <CardDescription>
            Assign segment names to each VLAN for migration
          </CardDescription>
        </CardHeader>
        <CardContent>
          {vlans.length === 0 ? (
            <div className="text-center py-8">
              <LayersIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No VLANs Found</h3>
              <p className="text-muted-foreground mt-2">
                Unable to discover VLANs from your network devices.
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => navigate('/discovery')}
              >
                Go to Discovery
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">VLAN ID</TableHead>
                    <TableHead>VLAN Name</TableHead>
                    <TableHead className="w-[200px]">Segment Name</TableHead>
                    <TableHead>Subnet</TableHead>
                    <TableHead>Used By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vlans.map((vlan) => (
                    <TableRow key={vlan.id}>
                      <TableCell className="font-medium">{vlan.vlanId}</TableCell>
                      <TableCell>{vlan.name}</TableCell>
                      <TableCell>
                        {editingCell?.id === vlan.id && editingCell?.field === "segmentName" ? (
                          <Input
                            defaultValue={vlan.segmentName}
                            className="h-8"
                            onBlur={(e) => handleSaveEdit(vlan.id, "segmentName", e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSaveEdit(vlan.id, "segmentName", (e.target as HTMLInputElement).value);
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <div
                            className="flex cursor-pointer items-center gap-1 hover:text-primary"
                            onClick={() => setEditingCell({id: vlan.id, field: "segmentName"})}
                          >
                            <TagIcon className="h-4 w-4" />
                            {vlan.segmentName || <span className="text-muted-foreground italic">Click to assign</span>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{vlan.subnet || "N/A"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {vlan.usedBy.map((device, idx) => (
                            <span 
                              key={idx}
                              className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium"
                            >
                              {device}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-4 text-sm text-muted-foreground">
            <p>Click on the segment name to edit. Segment names will be used for organizing devices in Nile.</p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t px-6 py-4">
          <Button 
            variant="outline"
            onClick={() => navigate("/devices")}
            disabled={loading}
          >
            Back
          </Button>
          <Button 
            onClick={handleConfirmVlans}
            disabled={loading || vlans.length === 0}
          >
            Save and Continue
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default VlansPage;
