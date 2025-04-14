
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { 
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Home, Network, Radio, Server, Layers, FileDown, Plus, ChevronRight } from "lucide-react";
import { MacAddressIcon } from "@/components/MacAddressIcon";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";

interface Site {
  id: string;
  name: string;
}

export function SiteNavigation() {
  const { user } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSites() {
      if (!user) return;
      
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('sites')
          .select('id, name')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        setSites(data || []);
      } catch (error) {
        console.error('Error fetching sites:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchSites();
  }, [user]);

  return (
    <NavigationMenu orientation="vertical" className="max-w-full w-full">
      <NavigationMenuList className="flex flex-col items-start space-y-1 w-full">
        <NavigationMenuItem className="w-full">
          <NavLink to="/" className="flex items-center gap-2 px-3 py-2 w-full rounded-md">
            <Home className="h-5 w-5" />
            <span>Welcome</span>
          </NavLink>
        </NavigationMenuItem>
        
        <NavigationMenuItem className="w-full">
          <NavigationMenuTrigger className="w-full text-left justify-start gap-2 px-3 data-[state=open]:bg-accent">
            <Network className="h-5 w-5" />
            <span>Sites</span>
          </NavigationMenuTrigger>
          <NavigationMenuContent className="w-64 lg:w-[350px]">
            <div className="p-2 space-y-2">
              <Link to="/site-subnet" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent w-full">
                <Plus className="h-4 w-4 text-primary" />
                <span>Create New Site Migration</span>
              </Link>
              
              <div className="border-t my-2"></div>
              
              {isLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Loading sites...
                </div>
              ) : sites.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No sites found. Create your first site.
                </div>
              ) : (
                <div className="space-y-1">
                  {sites.map((site) => (
                    <div key={site.id} className="group relative">
                      <div className="flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-accent w-full cursor-pointer">
                        <span className="truncate">{site.name}</span>
                        <ChevronRight className="h-4 w-4 opacity-50" />
                      </div>
                      
                      <div className="absolute left-full top-0 hidden group-hover:block bg-popover border rounded-md shadow-md ml-1 w-64">
                        <div className="p-2 space-y-1">
                          <div className="font-medium px-3 py-1.5 text-sm">{site.name} Phases</div>
                          <Link 
                            to={`/site-subnet?site=${site.id}`} 
                            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent w-full"
                          >
                            <Network className="h-4 w-4" />
                            <span>Site & Subnet</span>
                          </Link>
                          <Link 
                            to={`/discovery?site=${site.id}`} 
                            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent w-full"
                          >
                            <Radio className="h-4 w-4" />
                            <span>Discovery</span>
                          </Link>
                          <Link 
                            to={`/devices?site=${site.id}`} 
                            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent w-full"
                          >
                            <Server className="h-4 w-4" />
                            <span>Network Elements</span>
                          </Link>
                          <Link 
                            to={`/vlans?site=${site.id}`} 
                            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent w-full"
                          >
                            <Layers className="h-4 w-4" />
                            <span>VLANs</span>
                          </Link>
                          <Link 
                            to={`/mac-addresses?site=${site.id}`} 
                            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent w-full"
                          >
                            <MacAddressIcon className="h-4 w-4" />
                            <span>MAC Addresses</span>
                          </Link>
                          <Link 
                            to={`/export?site=${site.id}`} 
                            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent w-full"
                          >
                            <FileDown className="h-4 w-4" />
                            <span>Export</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
