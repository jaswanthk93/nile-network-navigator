import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { KeyIcon, PlusIcon, TrashIcon, EditIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const subnetFormSchema = z.object({
  name: z.string().min(2, { message: "Subnet name is required." }),
  subnet: z.string().regex(/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, 
    { message: "Please enter a valid IP address (e.g., 192.168.10.0)." }),
  prefix: z.string().refine((value) => {
    const num = parseInt(value);
    return !isNaN(num) && num >= 0 && num <= 32;
  }, { message: "Prefix must be between 0 and 32." }),
  username: z.string().optional(),
  password: z.string().optional(),
  community: z.string().optional(),
  snmpVersion: z.enum(["1", "2c", "3"]).optional(),
  accessMethod: z.enum(["telnet", "ssh", "snmp"]),
});

type SubnetFormValues = z.infer<typeof subnetFormSchema>;

interface Subnet {
  id: string;
  name: string;
  subnet: string;
  prefix: string;
  username?: string;
  password?: string;
  community?: string;
  snmpVersion?: "1" | "2c" | "3";
  accessMethod: "telnet" | "ssh" | "snmp";
}

const isSubnetWithin = (subnet1: string, prefix1: string, subnet2: string, prefix2: string): boolean => {
  const ip1Parts = subnet1.split('.').map(Number);
  const ip2Parts = subnet2.split('.').map(Number);
  
  const ip1Numeric = (ip1Parts[0] << 24) | (ip1Parts[1] << 16) | (ip1Parts[2] << 8) | ip1Parts[3];
  const ip2Numeric = (ip2Parts[0] << 24) | (ip2Parts[1] << 16) | (ip2Parts[2] << 8) | ip2Parts[3];
  
  const mask1 = ~((1 << (32 - parseInt(prefix1))) - 1);
  const mask2 = ~((1 << (32 - parseInt(prefix2))) - 1);
  
  if (parseInt(prefix1) <= parseInt(prefix2)) {
    return (ip1Numeric & mask1) === (ip2Numeric & mask1);
  }
  
  return (ip1Numeric & mask2) === (ip2Numeric & mask2);
};

const SiteSubnetPage = () => {
  const [subnets, setSubnets] = useState<Subnet[]>([]);
  const [addingSubnet, setAddingSubnet] = useState(false);
  const [editingSubnet, setEditingSubnet] = useState<string | null>(null);
  const [currentSiteId, setCurrentSiteId] = useState<string | null>(null);
  const [currentSiteName, setCurrentSiteName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const subnetForm = useForm<SubnetFormValues>({
    resolver: zodResolver(subnetFormSchema),
    defaultValues: {
      name: "",
      subnet: "",
      prefix: "24",
      username: "",
      password: "",
      community: "public",
      snmpVersion: "2c",
      accessMethod: "snmp",
    },
  });

  const accessMethod = subnetForm.watch("accessMethod");

  useEffect(() => {
    const loadSiteData = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      try {
        const params = new URLSearchParams(location.search);
        const siteIdFromUrl = params.get('site');
        
        const siteId = siteIdFromUrl || sessionStorage.getItem('selectedSiteId');
        
        if (!siteId) {
          navigate('/new-site');
          return;
        }
        
        const { data: site, error: siteError } = await supabase
          .from('sites')
          .select('*')
          .eq('id', siteId)
          .eq('user_id', user.id)
          .single();
          
        if (siteError) {
          console.error("Error loading site:", siteError);
          toast({
            title: "Error loading site data",
            description: siteError.message,
            variant: "destructive",
          });
          navigate('/new-site');
          return;
        }
        
        if (site) {
          setCurrentSiteId(site.id);
          setCurrentSiteName(site.name);
          sessionStorage.setItem('selectedSiteId', site.id);
          
          await loadSubnetsForSite(site.id);
        } else {
          navigate('/new-site');
        }
      } catch (error) {
        console.error("Error in loadSiteData:", error);
        toast({
          title: "Error",
          description: "Failed to load site data. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSiteData();
  }, [user, location.search, navigate, toast]);

  const loadSubnetsForSite = async (siteId: string) => {
    if (!user) return;
    
    const { data: subnetData, error: subnetsError } = await supabase
      .from('subnets')
      .select('*')
      .eq('site_id', siteId)
      .eq('user_id', user.id);
      
    if (subnetsError) {
      console.error("Error loading subnets:", subnetsError);
      toast({
        title: "Error loading subnet data",
        description: subnetsError.message,
        variant: "destructive",
      });
      return;
    }
    
    console.log("Subnets data loaded:", subnetData);
    
    if (subnetData && subnetData.length > 0) {
      const loadedSubnets = subnetData.map(subnet => ({
        id: subnet.id,
        name: subnet.description || 'Subnet',
        subnet: subnet.cidr.split('/')[0],
        prefix: subnet.cidr.split('/')[1] || '24',
        username: subnet.username || '',
        password: subnet.password || '',
        community: subnet.snmp_community || 'public',
        snmpVersion: subnet.snmp_version as "1" | "2c" | "3" || '2c',
        accessMethod: subnet.access_method as "ssh" | "telnet" | "snmp" || 'snmp'
      }));
      
      setSubnets(loadedSubnets);
    } else {
      setSubnets([]);
    }
  };

  const startEditSubnet = (subnet: Subnet) => {
    setEditingSubnet(subnet.id);
    setAddingSubnet(false);
    
    subnetForm.reset({
      name: subnet.name,
      subnet: subnet.subnet,
      prefix: subnet.prefix,
      username: subnet.username || "",
      password: subnet.password || "",
      community: subnet.community || "public",
      snmpVersion: subnet.snmpVersion || "2c",
      accessMethod: subnet.accessMethod,
    });
  };

  const cancelEdit = () => {
    setEditingSubnet(null);
    subnetForm.reset({
      name: "",
      subnet: "",
      prefix: "24",
      username: "",
      password: "",
      community: "public",
      snmpVersion: "2c",
      accessMethod: "snmp",
    });
  };

  const onSubnetSubmit = async (values: SubnetFormValues) => {
    if (!user || !currentSiteId) {
      toast({
        title: "Error",
        description: "No active site found. Please select or create a site.",
        variant: "destructive",
      });
      navigate('/new-site');
      return;
    }
    
    const newSubnetCidr = `${values.subnet}/${values.prefix}`;
    
    if (!editingSubnet) {
      const exactDuplicate = subnets.some(
        subnet => subnet.subnet === values.subnet && subnet.prefix === values.prefix
      );
      
      if (exactDuplicate) {
        toast({
          title: "Duplicate Subnet",
          description: `Subnet ${newSubnetCidr} already exists.`,
          variant: "destructive",
        });
        return;
      }
      
      const overlappingSubnet = subnets.find(subnet => 
        isSubnetWithin(subnet.subnet, subnet.prefix, values.subnet, values.prefix)
      );
      
      if (overlappingSubnet) {
        toast({
          title: "Overlapping Subnet",
          description: `Subnet ${newSubnetCidr} overlaps with existing subnet ${overlappingSubnet.subnet}/${overlappingSubnet.prefix}.`,
          variant: "destructive",
        });
        return;
      }
    }
    
    try {
      const cidr = `${values.subnet}/${values.prefix}`;
      
      const additionalData: Record<string, any> = {};
      
      if (values.accessMethod === "snmp") {
        additionalData.snmp_community = values.community;
        additionalData.snmp_version = values.snmpVersion;
        additionalData.username = null;
        additionalData.password = null;
      } else {
        additionalData.username = values.username;
        additionalData.password = values.password;
        additionalData.snmp_community = null;
        additionalData.snmp_version = null;
      }

      if (editingSubnet) {
        const { data, error } = await supabase
          .from('subnets')
          .update({
            cidr: cidr,
            description: values.name,
            access_method: values.accessMethod,
            ...additionalData
          })
          .eq('id', editingSubnet)
          .eq('user_id', user.id)
          .select()
          .single();
        
        if (error) throw error;
        
        setSubnets(prev => prev.map(subnet => 
          subnet.id === editingSubnet 
            ? {
                id: data.id,
                name: values.name,
                subnet: values.subnet,
                prefix: values.prefix,
                accessMethod: values.accessMethod,
                ...(values.accessMethod === "snmp" 
                  ? { community: values.community, snmpVersion: values.snmpVersion }
                  : { username: values.username, password: values.password }),
              }
            : subnet
        ));
        
        setEditingSubnet(null);
        
        toast({
          title: "Subnet updated",
          description: `Subnet ${values.name} has been updated.`,
        });
      } else {
        const { data, error } = await supabase
          .from('subnets')
          .insert({
            site_id: currentSiteId,
            cidr: cidr,
            description: values.name,
            user_id: user.id,
            access_method: values.accessMethod,
            ...additionalData
          })
          .select()
          .single();
        
        if (error) throw error;
        
        const newSubnet: Subnet = {
          id: data.id,
          name: values.name,
          subnet: values.subnet,
          prefix: values.prefix,
          accessMethod: values.accessMethod,
        };
        
        if (values.accessMethod === "snmp") {
          newSubnet.community = values.community;
          newSubnet.snmpVersion = values.snmpVersion;
        } else {
          newSubnet.username = values.username;
          newSubnet.password = values.password;
        }
        
        setSubnets((prev) => [...prev, newSubnet]);
        toast({
          title: "Subnet added",
          description: `Subnet ${values.name} has been added to your site.`,
        });
      }
      
      setAddingSubnet(false);
      subnetForm.reset();
      
    } catch (error) {
      console.error("Error saving subnet:", error);
      toast({
        title: editingSubnet ? "Error updating subnet" : "Error adding subnet",
        description: "There was a problem saving your subnet information.",
        variant: "destructive",
      });
    }
  };

  const removeSubnet = async (id: string) => {
    if (!user) return;
    
    try {
      console.log("Attempting to delete subnet with ID:", id);
      
      const { error: deleteDevicesError } = await supabase
        .from('devices')
        .delete()
        .eq('subnet_id', id)
        .eq('user_id', user.id);
      
      if (deleteDevicesError) {
        console.error("Error deleting associated devices:", deleteDevicesError);
        throw deleteDevicesError;
      }
      
      const { error } = await supabase
        .from('subnets')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) {
        console.error("Delete error:", error);
        throw error;
      }
      
      setSubnets((prev) => prev.filter((subnet) => subnet.id !== id));
      
      toast({
        title: "Subnet removed",
        description: "The subnet and any associated devices have been removed from your site.",
      });
    } catch (error) {
      console.error("Error removing subnet:", error);
      toast({
        title: "Error removing subnet",
        description: "There was a problem removing the subnet. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleNext = () => {
    if (subnets.length === 0) {
      toast({
        title: "No subnets added",
        description: "Please add at least one subnet before proceeding.",
        variant: "destructive",
      });
      return;
    }
    
    sessionStorage.setItem('subnetIds', JSON.stringify(subnets.map(subnet => subnet.id)));
    navigate("/discovery");
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Loading site data...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Site: {currentSiteName}
        </h1>
        <p className="text-muted-foreground">
          Configure management subnets for this site
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyIcon className="h-5 w-5" />
            Management Subnets
          </CardTitle>
          <CardDescription>
            Add management subnets where network devices can be discovered
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subnets.length > 0 ? (
            <div className="space-y-4">
              {subnets.map((subnet) => (
                <div key={subnet.id} className="rounded-lg border p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{subnet.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {subnet.subnet}/{subnet.prefix} ({subnet.accessMethod.toUpperCase()})
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEditSubnet(subnet)}
                        aria-label={`Edit ${subnet.name}`}
                      >
                        <EditIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSubnet(subnet.id)}
                        aria-label={`Remove ${subnet.name}`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Alert className="bg-muted">
              <AlertTitle>No subnets added yet</AlertTitle>
              <AlertDescription>
                Add management subnets to discover network devices.
              </AlertDescription>
            </Alert>
          )}

          {(addingSubnet || editingSubnet) ? (
            <div className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">
                  {editingSubnet ? "Edit Subnet" : "Add New Subnet"}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAddingSubnet(false);
                    setEditingSubnet(null);
                    subnetForm.reset();
                  }}
                >
                  Cancel
                </Button>
              </div>
              <Form {...subnetForm}>
                <form onSubmit={subnetForm.handleSubmit(onSubnetSubmit)} className="space-y-4">
                  <FormField
                    control={subnetForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subnet Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Management VLAN" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={subnetForm.control}
                      name="subnet"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subnet</FormLabel>
                          <FormControl>
                            <Input placeholder="192.168.10.0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={subnetForm.control}
                      name="prefix"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prefix</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select prefix" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Array.from({ length: 33 }, (_, i) => i).map((prefix) => (
                                <SelectItem key={prefix} value={prefix.toString()}>
                                  /{prefix}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={subnetForm.control}
                    name="accessMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Access Method</FormLabel>
                        <Select
                          onValueChange={field.onChange as (value: string) => void}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select access method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="snmp">SNMP</SelectItem>
                            <SelectItem value="ssh">SSH</SelectItem>
                            <SelectItem value="telnet">Telnet</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {accessMethod === 'snmp' ? (
                    <div className="space-y-4">
                      <FormField
                        control={subnetForm.control}
                        name="community"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SNMP Community String</FormLabel>
                            <FormControl>
                              <Input placeholder="public" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={subnetForm.control}
                        name="snmpVersion"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SNMP Version</FormLabel>
                            <Select
                              onValueChange={field.onChange as (value: string) => void}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select SNMP version" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="1">SNMP v1</SelectItem>
                                <SelectItem value="2c">SNMP v2c</SelectItem>
                                <SelectItem value="3">SNMP v3</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={subnetForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="admin" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={subnetForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <Button type="submit">{editingSubnet ? "Update Subnet" : "Add Subnet"}</Button>
                </form>
              </Form>
            </div>
          ) : (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setAddingSubnet(true);
                subnetForm.reset({
                  name: "",
                  subnet: "",
                  prefix: "24",
                  username: "",
                  password: "",
                  community: "public",
                  snmpVersion: "2c",
                  accessMethod: "snmp",
                });
              }}
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Subnet
            </Button>
          )}
        </CardContent>
        <CardFooter className="flex justify-between border-t px-6 py-4">
          <Button variant="outline" onClick={() => navigate("/")}>
            Back
          </Button>
          <Button onClick={handleNext} disabled={subnets.length === 0}>
            Continue to Discovery
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default SiteSubnetPage;
