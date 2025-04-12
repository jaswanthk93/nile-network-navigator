import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { FolderKanbanIcon, LayersIcon, TagIcon, Loader2Icon, AlertTriangleIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { discoverVlans } from "@/utils/network/vlanDiscovery";

interface Vlan {
  id: string;
  vlanId: number;
  name: string;
  segmentName: string;
  subnet?: string;
  usedBy: string[];
}

const MIN_VLAN_ID = 1;
const MAX_VLAN_ID = 4094;

const VlansPage = () => {
  const [vlans, setVlans] = useState<Vlan[]>([]);
  const [invalidVlans, setInvalidVlans] = useState<Vlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [discoveryInProgress, setDiscoveryInProgress] = useState(false);
  const [discoveryProgress, setDiscoveryProgress] = useState({ message: "", percent: 0 });
  const [editingCell, setEditingCell] = useState<{id: string, field: keyof Vlan} | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isValidVlanId = (vlanId: number) => {
    return vlanId >= MIN_VLAN_ID && vlanId <= MAX_VLAN_ID;
  };

  const fetchVlans = useCallback(async () => {
    if (!user || dataLoaded) return;
    
    try {
      setLoading(true);
      
      const { data: devices, error: devicesError } = await supabase
        .from('devices')
        .select('*')
        .eq('user_id', user.id);
        
      if (devicesError) {
        throw new Error(`Error fetching devices: ${devicesError.message}`);
      }

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

      const { data: vlanData, error: vlansError } = await supabase
        .from('vlans')
        .select('*')
        .eq('user_id', user.id);
        
      if (vlansError) {
        throw new Error(`Error fetching VLANs: ${vlansError.message}`);
      }

      if (!vlanData || vlanData.length === 0) {
        console.log("No VLANs found in database, attempting to discover...");
        
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
          setDataLoaded(true);
          return;
        }
        
        setDiscoveryInProgress(true);
        
        const updateProgress = (message: string, progress: number) => {
          setDiscoveryProgress({
            message,
            percent: progress
          });
        };
        
        const primarySwitch = switches.find(device => device.make?.toLowerCase().includes('cisco')) || switches[0];
        
        if (!primarySwitch) {
          toast({
            title: "VLAN Discovery",
            description: "No suitable switch found for VLAN discovery.",
            variant: "destructive",
          });
          setDiscoveryInProgress(false);
          setLoading(false);
          return;
        }
        
        console.log("Selected primary switch for VLAN discovery:", primarySwitch);
        
        try {
          const { data: subnetData } = await supabase
            .from('subnets')
            .select('*')
            .eq('id', primarySwitch.subnet_id)
            .single();
            
          const result = await discoverVlans(
            primarySwitch.ip_address,
            subnetData?.snmp_community || 'public',
            subnetData?.snmp_version as "1" | "2c" | "3" || '2c',
            primarySwitch.make || 'Cisco'
          );
          
          const discoveredVlans = result.vlans;
          
          console.log("Raw discovered VLANs:", discoveredVlans);
          
          if (discoveredVlans.length === 0) {
            toast({
              title: "VLAN Discovery",
              description: `Unable to discover VLANs automatically. Please define VLANs manually or check device connectivity.`,
              variant: "destructive",
            });
            
            const defaultVlans: Vlan[] = [
              {
                id: "1",
                vlanId: 1,
                name: "Default",
                segmentName: "Management",
                subnet: "", 
                usedBy: switches.map(s => s.hostname || s.ip_address).filter(Boolean) as string[]
              }
            ];
            
            setVlans(defaultVlans);
          } else {
            const valid: Vlan[] = [];
            const invalid: Vlan[] = [];
            
            discoveredVlans.forEach((vlan) => {
              const vlanName = vlan.name?.trim();
              
              const mappedVlan: Vlan = {
                id: `discovered-${vlan.vlanId}`,
                vlanId: vlan.vlanId,
                name: vlan.name,
                segmentName: vlanName || "",
                subnet: vlan.subnet || "",
                usedBy: vlan.usedBy
              };
              
              if (isValidVlanId(vlan.vlanId)) {
                valid.push(mappedVlan);
              } else {
                invalid.push(mappedVlan);
              }
            });
            
            setVlans(valid);
            setInvalidVlans(invalid);
            
            if (invalid.length > 0) {
              toast({
                title: "Invalid VLAN IDs detected",
                description: `${invalid.length} VLANs were filtered out because they had IDs outside the valid range (${MIN_VLAN_ID}-${MAX_VLAN_ID}).`,
                variant: "destructive",
              });
            }
            
            toast({
              title: "VLAN Discovery Complete",
              description: `Successfully discovered ${valid.length} valid VLANs from your network devices.`,
            });
          }
          
          setDiscoveryInProgress(false);
        } catch (error) {
          console.error("Error during VLAN discovery:", error);
          toast({
            title: "VLAN Discovery Error",
            description: error instanceof Error ? error.message : "An unexpected error occurred",
            variant: "destructive",
          });
        }
      } else {
        const valid: Vlan[] = [];
        const invalid: Vlan[] = [];
        
        vlanData.forEach(dbVlan => {
          const vlanDevices = devices
            .filter(d => d.category === 'Switch' || d.make === 'Cisco' || d.make === 'Juniper')
            .slice(0, 3)
            .map(d => d.hostname || d.ip_address)
            .filter(Boolean) as string[];
          
          const mappedVlan: Vlan = {
            id: dbVlan.id,
            vlanId: dbVlan.vlan_id,
            name: dbVlan.name,
            segmentName: dbVlan.description || dbVlan.name,
            subnet: "",
            usedBy: vlanDevices
          };
          
          if (isValidVlanId(dbVlan.vlan_id)) {
            valid.push(mappedVlan);
          } else {
            invalid.push(mappedVlan);
          }
        });
        
        setVlans(valid);
        setInvalidVlans(invalid);
        
        if (invalid.length > 0) {
          toast({
            title: "Invalid VLAN IDs detected",
            description: `${invalid.length} VLANs were filtered out because they had IDs outside the valid range (${MIN_VLAN_ID}-${MAX_VLAN_ID}).`,
            variant: "destructive",
          });
        }
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
      setDataLoaded(true);
    }
  }, [user, toast, navigate, dataLoaded]);

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

    fetchVlans();
  }, [user, fetchVlans, toast, navigate]);

  const handleSaveEdit = (id: string, field: keyof Vlan, value: string) => {
    if (field === "vlanId") {
      const numValue = parseInt(value, 10);
      if (!isValidVlanId(numValue)) {
        toast({
          title: "Invalid VLAN ID",
          description: `VLAN IDs must be between ${MIN_VLAN_ID} and ${MAX_VLAN_ID}.`,
          variant: "destructive",
        });
        return;
      }
    }
    
    if (field === "name") {
      setVlans(vlans.map(vlan => {
        if (vlan.id === id) {
          const updatedSegmentName = !vlan.segmentName ? value : vlan.segmentName;
          return { 
            ...vlan, 
            [field]: value,
            segmentName: updatedSegmentName
          };
        }
        return vlan;
      }));
    } else {
      setVlans(vlans.map(vlan => 
        vlan.id === id ? { ...vlan, [field]: field === "vlanId" ? parseInt(value, 10) : value } : vlan
      ));
    }
    setEditingCell(null);
  };

  const handleAddVlan = () => {
    const maxVlanId = Math.max(...vlans.map(v => v.vlanId), 0);
    let newVlanId = maxVlanId + 10;
    
    if (newVlanId > MAX_VLAN_ID) {
      newVlanId = Math.min(...vlans.map(v => v.vlanId).filter(id => id > MIN_VLAN_ID), MAX_VLAN_ID);
      if (newVlanId === Infinity) {
        newVlanId = MIN_VLAN_ID;
      }
    }
    
    const vlanName = `VLAN_${newVlanId}`;
    
    const newVlan: Vlan = {
      id: `new-${Date.now()}`,
      vlanId: newVlanId,
      name: vlanName,
      segmentName: vlanName,
      subnet: "",
      usedBy: []
    };
    
    setVlans([...vlans, newVlan]);
    
    setTimeout(() => {
      setEditingCell({id: newVlan.id, field: "name"});
    }, 100);
  };

  const handleRemoveVlan = (id: string) => {
    setVlans(vlans.filter(vlan => vlan.id !== id));
  };

  const handleConfirmVlans = async () => {
    const missingSegments = vlans.filter(vlan => !vlan.segmentName);
    if (missingSegments.length > 0) {
      toast({
        title: "Missing segment names",
        description: `Please assign segment names to all VLANs before proceeding.`,
        variant: "destructive",
      });
      
      if (missingSegments.length > 0) {
        setEditingCell({id: missingSegments[0].id, field: "segmentName"});
      }
      
      return;
    }

    try {
      setLoading(true);

      let siteId = localStorage.getItem('currentSiteId');
      
      if (!siteId) {
        console.log("No site ID found in localStorage, creating a default site");
        
        const { data: newSite, error: siteError } = await supabase
          .from('sites')
          .insert({
            name: 'Default Site',
            user_id: user!.id
          })
          .select('id')
          .single();
          
        if (siteError) {
          throw new Error(`Error creating default site: ${siteError.message}`);
        }
        
        siteId = newSite.id;
        localStorage.setItem('currentSiteId', siteId);
        console.log(`Created default site with ID: ${siteId}`);
      }

      const vlansToSave = vlans.map(vlan => {
        const isNewVlan = vlan.id.startsWith('discovered-') || vlan.id.startsWith('new-');
        
        const vlanObject: {
          user_id: string;
          site_id: string;
          vlan_id: number;
          name: string;
          description: string;
          id?: string;
        } = {
          user_id: user!.id,
          site_id: siteId as string,
          vlan_id: vlan.vlanId,
          name: vlan.name,
          description: vlan.segmentName
        };

        if (!isNewVlan) {
          vlanObject.id = vlan.id;
        }
        
        return vlanObject;
      });

      console.log("Saving VLANs with data:", vlansToSave);

      const { error } = await supabase
        .from('vlans')
        .upsert(vlansToSave, { 
          onConflict: 'id',
          ignoreDuplicates: false
        });

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

  if (discoveryInProgress) {
    return (
      <div className="container mx-auto max-w-6xl flex flex-col items-center justify-center h-[70vh]">
        <Loader2Icon className="h-12 w-12 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-semibold">Discovering VLANs...</h2>
        <p className="text-muted-foreground mb-4">
          {discoveryProgress.message}
        </p>
        <div className="w-full max-w-md h-2 bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300" 
            style={{ width: `${discoveryProgress.percent}%` }}
          ></div>
        </div>
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
              <div className="flex flex-col sm:flex-row gap-2 justify-center mt-4">
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/discovery')}
                >
                  Go to Discovery
                </Button>
                <Button
                  onClick={handleAddVlan}
                >
                  Add VLAN Manually
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {invalidVlans.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-4">
                  <div className="flex items-start">
                    <AlertTriangleIcon className="h-5 w-5 text-amber-500 mt-0.5 mr-2" />
                    <div>
                      <h4 className="font-medium text-amber-800">Invalid VLAN IDs detected</h4>
                      <p className="text-amber-700 text-sm mt-1">
                        {invalidVlans.length} VLANs were filtered out because they had IDs outside the valid range ({MIN_VLAN_ID}-${MAX_VLAN_ID}).
                        Invalid IDs: {invalidVlans.map(v => v.vlanId).join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">VLAN ID</TableHead>
                      <TableHead>VLAN Name</TableHead>
                      <TableHead className="w-[250px]">Segment Name</TableHead>
                      <TableHead>Subnet</TableHead>
                      <TableHead>Used By</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vlans.map((vlan) => (
                      <TableRow key={vlan.id}>
                        <TableCell className="font-medium">
                          {editingCell?.id === vlan.id && editingCell?.field === "vlanId" ? (
                            <Input
                              type="number"
                              defaultValue={vlan.vlanId.toString()}
                              className="h-8 w-20"
                              min={MIN_VLAN_ID}
                              max={MAX_VLAN_ID}
                              onBlur={(e) => handleSaveEdit(vlan.id, "vlanId", e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleSaveEdit(vlan.id, "vlanId", (e.target as HTMLInputElement).value);
                                }
                              }}
                              autoFocus
                            />
                          ) : (
                            <div
                              className="cursor-pointer hover:text-primary"
                              onClick={() => setEditingCell({id: vlan.id, field: "vlanId"})}
                            >
                              {vlan.vlanId}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingCell?.id === vlan.id && editingCell?.field === "name" ? (
                            <Input
                              defaultValue={vlan.name}
                              className="h-8"
                              onBlur={(e) => handleSaveEdit(vlan.id, "name", e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleSaveEdit(vlan.id, "name", (e.target as HTMLInputElement).value);
                                }
                              }}
                              autoFocus
                            />
                          ) : (
                            <div
                              className="cursor-pointer hover:text-primary"
                              onClick={() => setEditingCell({id: vlan.id, field: "name"})}
                            >
                              {vlan.name}
                            </div>
                          )}
                        </TableCell>
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
                        <TableCell>
                          {editingCell?.id === vlan.id && editingCell?.field === "subnet" ? (
                            <Input
                              defaultValue={vlan.subnet}
                              className="h-8"
                              placeholder="e.g. 192.168.10.0/24"
                              onBlur={(e) => handleSaveEdit(vlan.id, "subnet", e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleSaveEdit(vlan.id, "subnet", (e.target as HTMLInputElement).value);
                                }
                              }}
                              autoFocus
                            />
                          ) : (
                            <div
                              className="cursor-pointer hover:text-primary"
                              onClick={() => setEditingCell({id: vlan.id, field: "subnet"})}
                            >
                              {vlan.subnet || "N/A"}
                            </div>
                          )}
                        </TableCell>
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
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRemoveVlan(vlan.id)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <Button 
                variant="outline" 
                onClick={handleAddVlan}
                className="mt-4"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus mr-2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                Add VLAN
              </Button>

              <div className="mt-4 text-sm text-muted-foreground">
                <p>Click on any field to edit. Segment names are required for all VLANs before proceeding.</p>
                <p className="mt-1">Valid VLAN IDs must be between {MIN_VLAN_ID} and {MAX_VLAN_ID}.</p>
              </div>
            </div>
          )}
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
