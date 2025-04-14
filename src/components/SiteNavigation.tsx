
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { 
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal
} from "@/components/ui/dropdown-menu";
import { Home, Network, Radio, Server, Layers, FileDown, Plus, ChevronRight } from "lucide-react";
import { MacAddressIcon } from "@/components/MacAddressIcon";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";

interface Site {
  id: string;
  name: string;
}

export function SiteNavigation() {
  const { user } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

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

  const handleCreateNewSite = () => {
    // Clear any cached site data
    sessionStorage.removeItem('selectedSiteId');
    // Navigate to site creation page
    navigate('/site-subnet');
    toast({
      title: "Create new site",
      description: "Starting fresh with a new site migration"
    });
  };

  const handleSiteSelect = (siteId: string) => {
    sessionStorage.setItem('selectedSiteId', siteId);
  };

  return (
    <div className="w-full space-y-2">
      <NavLink to="/" className="flex items-center gap-2 px-3 py-2 w-full rounded-md">
        <Home className="h-5 w-5" />
        <span>Welcome</span>
      </NavLink>
      
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 w-full justify-start text-left rounded-md hover:bg-accent">
          <Network className="h-5 w-5" />
          <span>Sites</span>
          <ChevronRight className="ml-auto h-4 w-4 transform transition-transform duration-200 group-data-[state=open]:rotate-90" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="start" sideOffset={8}>
          <DropdownMenuItem onClick={handleCreateNewSite} className="cursor-pointer">
            <Plus className="mr-2 h-4 w-4 text-primary" />
            <span>Create New Site Migration</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {isLoading ? (
            <DropdownMenuItem disabled>
              Loading sites...
            </DropdownMenuItem>
          ) : sites.length === 0 ? (
            <DropdownMenuItem disabled>
              No sites found. Create your first site.
            </DropdownMenuItem>
          ) : (
            sites.map((site) => (
              <DropdownMenuSub key={site.id}>
                <DropdownMenuSubTrigger>
                  <span className="truncate">{site.name}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-56">
                    <Link 
                      to={`/site-subnet?site=${site.id}`} 
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent w-full"
                      onClick={() => handleSiteSelect(site.id)}
                    >
                      <Network className="h-4 w-4" />
                      <span>Site & Subnet</span>
                    </Link>
                    <Link 
                      to={`/discovery?site=${site.id}`} 
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent w-full"
                      onClick={() => handleSiteSelect(site.id)}
                    >
                      <Radio className="h-4 w-4" />
                      <span>Discovery</span>
                    </Link>
                    <Link 
                      to={`/devices?site=${site.id}`} 
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent w-full"
                      onClick={() => handleSiteSelect(site.id)}
                    >
                      <Server className="h-4 w-4" />
                      <span>Network Elements</span>
                    </Link>
                    <Link 
                      to={`/vlans?site=${site.id}`} 
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent w-full"
                      onClick={() => handleSiteSelect(site.id)}
                    >
                      <Layers className="h-4 w-4" />
                      <span>VLANs</span>
                    </Link>
                    <Link 
                      to={`/mac-addresses?site=${site.id}`} 
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent w-full"
                      onClick={() => handleSiteSelect(site.id)}
                    >
                      <MacAddressIcon className="h-4 w-4" />
                      <span>MAC Addresses</span>
                    </Link>
                    <Link 
                      to={`/export?site=${site.id}`} 
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent w-full"
                      onClick={() => handleSiteSelect(site.id)}
                    >
                      <FileDown className="h-4 w-4" />
                      <span>Export</span>
                    </Link>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
