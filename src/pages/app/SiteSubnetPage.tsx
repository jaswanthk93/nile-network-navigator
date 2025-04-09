
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { MapPinIcon, PlusIcon, TrashIcon, KeyIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const siteFormSchema = z.object({
  siteName: z.string().min(2, { message: "Site name must be at least 2 characters." }),
  address: z.string().min(5, { message: "Please enter a valid address." }),
});

type SiteFormValues = z.infer<typeof siteFormSchema>;

const subnetFormSchema = z.object({
  name: z.string().min(2, { message: "Subnet name is required." }),
  subnet: z.string().regex(/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, 
    { message: "Please enter a valid IP address (e.g., 192.168.10.0)." }),
  prefix: z.string().refine((value) => {
    const num = parseInt(value);
    return !isNaN(num) && num >= 0 && num <= 32;
  }, { message: "Prefix must be between 0 and 32." }),
  username: z.string().min(1, { message: "Username is required." }),
  password: z.string().min(1, { message: "Password is required." }),
  accessMethod: z.enum(["telnet", "ssh"]),
});

type SubnetFormValues = z.infer<typeof subnetFormSchema>;

interface Subnet {
  id: string;
  name: string;
  subnet: string;
  prefix: string;
  username: string;
  password: string;
  accessMethod: "telnet" | "ssh";
}

const SiteSubnetPage = () => {
  const [subnets, setSubnets] = useState<Subnet[]>([]);
  const [addingSubnet, setAddingSubnet] = useState(false);
  const [siteAdded, setSiteAdded] = useState(false);
  const [currentSiteId, setCurrentSiteId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  const siteForm = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: {
      siteName: "",
      address: "",
    },
  });

  const subnetForm = useForm<SubnetFormValues>({
    resolver: zodResolver(subnetFormSchema),
    defaultValues: {
      name: "",
      subnet: "",
      prefix: "24",
      username: "",
      password: "",
      accessMethod: "ssh",
    },
  });

  // Load existing subnets if available
  useEffect(() => {
    const loadExistingData = async () => {
      if (!user) return;
      
      // Check for existing sites
      const { data: sites, error: sitesError } = await supabase
        .from('sites')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (sitesError) {
        console.error("Error loading sites:", sitesError);
        return;
      }
      
      if (sites && sites.length > 0) {
        const site = sites[0];
        setCurrentSiteId(site.id);
        siteForm.setValue('siteName', site.name);
        siteForm.setValue('address', site.location || '');
        setSiteAdded(true);
        
        // Load subnets for this site
        const { data: subnetData, error: subnetsError } = await supabase
          .from('subnets')
          .select('*')
          .eq('site_id', site.id)
          .eq('user_id', user.id);
        
        if (subnetsError) {
          console.error("Error loading subnets:", subnetsError);
          return;
        }
        
        if (subnetData && subnetData.length > 0) {
          const loadedSubnets = subnetData.map(subnet => ({
            id: subnet.id,
            name: subnet.description || 'Subnet',
            subnet: subnet.cidr.split('/')[0],
            prefix: subnet.cidr.split('/')[1] || '24',
            username: 'admin', // These fields aren't in the DB schema, using defaults
            password: 'password',
            accessMethod: 'ssh' as "ssh" | "telnet"
          }));
          
          setSubnets(loadedSubnets);
        }
      }
    };
    
    loadExistingData();
  }, [user]);

  const onSiteSubmit = async (values: SiteFormValues) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to add site information.",
        variant: "destructive",
      });
      navigate('/login');
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('sites')
        .insert({
          name: values.siteName,
          location: values.address,
          user_id: user.id
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setCurrentSiteId(data.id);
      toast({
        title: "Site information saved",
        description: "Your site has been successfully added.",
      });
      setSiteAdded(true);
    } catch (error) {
      console.error("Error saving site:", error);
      toast({
        title: "Error saving site",
        description: "There was a problem saving your site information.",
        variant: "destructive",
      });
    }
  };

  const onSubnetSubmit = async (values: SubnetFormValues) => {
    if (!user || !currentSiteId) {
      toast({
        title: "Error",
        description: "Site must be created before adding subnets.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Create the CIDR representation (e.g., 192.168.1.0/24)
      const cidr = `${values.subnet}/${values.prefix}`;
      
      // First save to Supabase
      const { data, error } = await supabase
        .from('subnets')
        .insert({
          site_id: currentSiteId,
          cidr: cidr,
          description: values.name,
          user_id: user.id
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Then update the local state
      const newSubnet: Subnet = {
        id: data.id,
        name: values.name,
        subnet: values.subnet,
        prefix: values.prefix,
        username: values.username,
        password: values.password,
        accessMethod: values.accessMethod,
      };
      
      setSubnets((prev) => [...prev, newSubnet]);
      setAddingSubnet(false);
      subnetForm.reset();
      
      toast({
        title: "Subnet added",
        description: `Subnet ${values.name} has been added to your site.`,
      });
    } catch (error) {
      console.error("Error saving subnet:", error);
      toast({
        title: "Error adding subnet",
        description: "There was a problem saving your subnet information.",
        variant: "destructive",
      });
    }
  };

  const removeSubnet = async (id: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('subnets')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setSubnets((prev) => prev.filter((subnet) => subnet.id !== id));
      toast({
        title: "Subnet removed",
        description: "The subnet has been removed from your site.",
      });
    } catch (error) {
      console.error("Error removing subnet:", error);
      toast({
        title: "Error removing subnet",
        description: "There was a problem removing the subnet.",
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
    
    // Store the subnet IDs in session storage for the discovery page
    sessionStorage.setItem('subnetIds', JSON.stringify(subnets.map(subnet => subnet.id)));
    navigate("/discovery");
  };

  return (
    <div className="container mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Site & Subnet Configuration</h1>
        <p className="text-muted-foreground">
          Define your network site and management subnets for discovery.
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPinIcon className="h-5 w-5" />
              Site Information
            </CardTitle>
            <CardDescription>
              Enter details about the site where network devices are located
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...siteForm}>
              <form onSubmit={siteForm.handleSubmit(onSiteSubmit)} className="space-y-4">
                <FormField
                  control={siteForm.control}
                  name="siteName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Main Office" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={siteForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="123 Network Street, Server City, SC 12345"
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={siteAdded}>
                  {siteAdded ? "Site Saved" : "Save Site Information"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {siteAdded && (
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSubnet(subnet.id)}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
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

              {addingSubnet ? (
                <div className="mt-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Add New Subnet</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAddingSubnet(false)}
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
                                defaultValue={field.value}
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

                      <FormField
                        control={subnetForm.control}
                        name="accessMethod"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Access Method</FormLabel>
                            <Select
                              onValueChange={field.onChange as (value: string) => void}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select access method" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="ssh">SSH</SelectItem>
                                <SelectItem value="telnet">Telnet</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit">Add Subnet</Button>
                    </form>
                  </Form>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setAddingSubnet(true)}
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
              <Button onClick={handleNext}>
                Continue to Discovery
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SiteSubnetPage;
