import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  ArrowRight, 
  Network, 
  Server, 
  Layers, 
  FileDown,
  Plus,
  Radio,
  Check,
  FileSpreadsheet,
  MacIcon,
  MacAddressIcon
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteCard } from "@/components/welcome/SiteCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { MacAddressIcon } from "@/components/MacAddressIcon";

interface Site {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  created_at: string;
}

interface SiteWithStatus extends Site {
  status: {
    progress: number;
    label: string;
  };
}

const WelcomePage = () => {
  const { user } = useAuth();
  const [sites, setSites] = useState<SiteWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSites = async () => {
      if (!user) return;
      
      setIsLoading(true);
      
      try {
        const { data: sitesData, error: sitesError } = await supabase
          .from('sites')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
          
        if (sitesError) throw sitesError;
        
        if (!sitesData || sitesData.length === 0) {
          setIsLoading(false);
          return;
        }
        
        const sitesWithStatus = await Promise.all(sitesData.map(async (site) => {
          let progress = 0;
          let label = "Site created";
          
          const { count: subnetCount, error: subnetError } = await supabase
            .from('subnets')
            .select('*', { count: 'exact', head: true })
            .eq('site_id', site.id);
            
          if (subnetError) throw subnetError;
          
          if (subnetCount && subnetCount > 0) {
            progress = 25;
            label = "Subnet configuration complete";
            
            const { count: deviceCount, error: deviceError } = await supabase
              .from('devices')
              .select('*', { count: 'exact', head: true })
              .eq('site_id', site.id);
              
            if (deviceError) throw deviceError;
            
            if (deviceCount && deviceCount > 0) {
              progress = 50;
              label = "Network discovery complete";
              
              const { count: unconfirmedCount, error: unconfirmedError } = await supabase
                .from('devices')
                .select('*', { count: 'exact', head: true })
                .eq('site_id', site.id)
                .eq('confirmed', false);
                
              if (unconfirmedError) throw unconfirmedError;
              
              if (unconfirmedCount === 0) {
                progress = 75;
                label = "Device verification complete";
                
                const { count: vlanCount, error: vlanError } = await supabase
                  .from('vlans')
                  .select('*', { count: 'exact', head: true })
                  .eq('site_id', site.id);
                  
                if (vlanError) throw vlanError;
                
                if (vlanCount && vlanCount > 0) {
                  progress = 90;
                  label = "VLAN configuration complete";
                  
                  progress = 95;
                  label = "Ready for export";
                }
              }
            }
          }
          
          return {
            ...site,
            status: {
              progress,
              label
            }
          };
        }));
        
        setSites(sitesWithStatus);
      } catch (error) {
        console.error("Error fetching sites:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSites();
  }, [user]);

  const handleSiteDelete = () => {
    if (user) {
      const fetchSites = async () => {
        try {
          const { data, error } = await supabase
            .from('sites')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
            
          if (error) throw error;
          
          const sitesWithBasicStatus = data?.map(site => ({
            ...site,
            status: {
              progress: 10,
              label: "Site created"
            }
          })) || [];
          
          setSites(sitesWithBasicStatus);
        } catch (error) {
          console.error("Error refreshing sites:", error);
        }
      };
      
      fetchSites();
    }
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to Nile Network Navigator</h1>
        <p className="text-muted-foreground">
          This tool helps you discover and document your network to migrate to Nile.
        </p>
      </div>

      {(isLoading || sites.length > 0) && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Your Migration Sites</h2>
          
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2">
              {[1, 2].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-8" />
                      </div>
                      <Skeleton className="h-2 w-full" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Skeleton className="h-10 w-full" />
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {sites.map((site) => (
                <SiteCard 
                  key={site.id}
                  id={site.id}
                  name={site.name}
                  description={site.description || undefined}
                  location={site.location || undefined}
                  createdAt={site.created_at}
                  status={site.status}
                  onDelete={handleSiteDelete}
                />
              ))}
              
              <Card className="flex flex-col items-center justify-center p-6 border-dashed">
                <div className="text-center space-y-4">
                  <div className="bg-primary/10 mx-auto rounded-full p-3 w-12 h-12 flex items-center justify-center">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-medium">Start New Migration</h3>
                    <p className="text-sm text-muted-foreground">
                      Create a new site for network migration
                    </p>
                  </div>
                  <Link to="/site-subnet">
                    <Button>
                      Create New Site
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {!isLoading && sites.length === 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Site & Subnet Setup
              </CardTitle>
              <CardDescription>Configure your site details and network subnets</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Start by providing basic information about your network site and subnets.
                These details will help us navigate your network effectively.
              </p>
            </CardContent>
            <CardFooter>
              <Link to="/site-subnet" className="w-full">
                <Button className="w-full">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Network Discovery
              </CardTitle>
              <CardDescription>Scan and identify devices on your network</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Our discovery tool will scan your network and identify connected devices,
                making it easy to map your current infrastructure.
              </p>
            </CardContent>
            <CardFooter>
              <Link to="/discovery" className="w-full">
                <Button variant="outline" className="w-full">
                  Go to Discovery
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                VLAN Management
              </CardTitle>
              <CardDescription>Review and manage your VLANs</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Organize and validate your VLAN configuration before migration
                to ensure a smooth transition to Nile.
              </p>
            </CardContent>
            <CardFooter>
              <Link to="/vlans" className="w-full">
                <Button variant="outline" className="w-full">
                  Manage VLANs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileDown className="h-5 w-5" />
                Export for Migration
              </CardTitle>
              <CardDescription>Generate migration files for Nile</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                When you're ready, export your network data in a format
                compatible with Nile's migration tools.
              </p>
            </CardContent>
            <CardFooter>
              <Link to="/export" className="w-full">
                <Button variant="outline" className="w-full">
                  Export Data
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      )}

      <div className="space-y-4 pt-6">
        <Separator />
        <h2 className="text-2xl font-semibold">Migration Process Overview</h2>
        <p className="text-muted-foreground">
          Follow these steps to successfully migrate your network to Nile:
        </p>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Network className="h-5 w-5 text-blue-500" />
                Step 1: Site & Subnet Setup
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Provide essential details about your network site and define the IP
                subnets that will be scanned during discovery.
              </p>
            </CardContent>
            <CardFooter>
              <Link to="/site-subnet" className="w-full">
                <Button variant="outline" size="sm" className="w-full">
                  Go to Site Setup
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card className="border-l-4 border-l-indigo-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Radio className="h-5 w-5 text-indigo-500" />
                Step 2: Network Discovery
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Automatically scan your network to identify and catalog switches, routers,
                and other devices using SNMP, SSH, or Telnet protocols.
              </p>
            </CardContent>
            <CardFooter>
              <Link to="/discovery" className="w-full">
                <Button variant="outline" size="sm" className="w-full">
                  Go to Discovery
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Server className="h-5 w-5 text-purple-500" />
                Step 3: Device Verification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Review and verify the discovered network devices, confirm their roles,
                and ensure all essential equipment is properly cataloged.
              </p>
            </CardContent>
            <CardFooter>
              <Link to="/devices" className="w-full">
                <Button variant="outline" size="sm" className="w-full">
                  Go to Devices
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Layers className="h-5 w-5 text-green-500" />
                Step 4: VLAN Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Map and configure your VLANs, defining their purpose and ensuring
                proper documentation for the migration process.
              </p>
            </CardContent>
            <CardFooter>
              <Link to="/vlans" className="w-full">
                <Button variant="outline" size="sm" className="w-full">
                  Go to VLANs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card className="border-l-4 border-l-yellow-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <MacAddressIcon className="h-5 w-5 text-yellow-500" />
                Step 5: MAC Addresses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Collect and organize MAC addresses from your network devices to ensure
                smooth transition of network-level access controls.
              </p>
            </CardContent>
            <CardFooter>
              <Link to="/mac-addresses" className="w-full">
                <Button variant="outline" size="sm" className="w-full">
                  Go to MAC Addresses
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileDown className="h-5 w-5 text-red-500" />
                Step 6: Export Migration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Generate migration files compatible with Nile's platform, containing all the
                network information needed for a seamless transition.
              </p>
            </CardContent>
            <CardFooter>
              <Link to="/export" className="w-full">
                <Button variant="outline" size="sm" className="w-full">
                  Go to Export
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;
