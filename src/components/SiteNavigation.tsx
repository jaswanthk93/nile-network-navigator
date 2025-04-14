
import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  const [openSiteId, setOpenSiteId] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

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
    // Clear ALL cached site data
    sessionStorage.removeItem('selectedSiteId');
    localStorage.removeItem('currentSite');
    localStorage.removeItem('subnetIds');
    localStorage.removeItem('managementSubnets');
    localStorage.removeItem('userSubnets');
    
    // Set flag to indicate a fresh site creation and force a reload of the page
    localStorage.setItem('creatingNewSite', 'true');
    
    // Navigate to site creation page with a timestamp to force a reload
    navigate(`/site-subnet?new=${Date.now()}`);
    toast({
      title: "Create new site",
      description: "Starting fresh with a new site migration"
    });
  };

  const handleSiteSelect = (siteId: string) => {
    console.log(`Site selected: ${siteId}`);
    // Toggle site expansion
    setOpenSiteId(openSiteId === siteId ? null : siteId);
    // Remove new site creation flag if it exists
    localStorage.removeItem('creatingNewSite');
    // Store the selected site ID
    sessionStorage.setItem('selectedSiteId', siteId);
  };

  const SiteLink = ({ siteId, to, icon: Icon, children }: { siteId: string, to: string, icon: React.ElementType, children: React.ReactNode }) => {
    const isActive = location.pathname === to.split('?')[0] && location.search.includes(`site=${siteId}`);
    
    return (
      <Link
        to={`${to}?site=${siteId}`}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-md text-sm w-full",
          isActive ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
        )}
        onClick={() => sessionStorage.setItem('selectedSiteId', siteId)}
      >
        <Icon className="h-4 w-4" />
        <span>{children}</span>
      </Link>
    );
  };

  return (
    <div className="w-full space-y-2">
      <NavLink to="/" className="flex items-center gap-2 px-3 py-2 w-full rounded-md">
        <Home className="h-5 w-5" />
        <span>Welcome</span>
      </NavLink>
      
      <div className="px-3 text-sm font-medium text-muted-foreground">
        Sites
      </div>

      <div className="space-y-1">
        <button
          onClick={handleCreateNewSite}
          className="flex items-center gap-2 px-3 py-2 w-full text-left rounded-md hover:bg-accent text-sm"
        >
          <Plus className="h-4 w-4 text-primary" />
          <span>Create New Site Migration</span>
        </button>
        
        {isLoading ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">
            Loading sites...
          </div>
        ) : sites.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">
            No sites found. Create your first site.
          </div>
        ) : (
          <ScrollArea className="h-auto max-h-[50vh]">
            <div className="space-y-1 pr-2">
              {sites.map((site) => (
                <Collapsible 
                  key={site.id}
                  open={openSiteId === site.id}
                  onOpenChange={() => handleSiteSelect(site.id)}
                >
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-sm rounded-md hover:bg-accent text-left">
                    <div className="flex items-center">
                      <Network className="h-4 w-4 mr-2" />
                      <span className="truncate">{site.name}</span>
                    </div>
                    <ChevronRight className={cn(
                      "h-4 w-4 transition-transform",
                      openSiteId === site.id && "transform rotate-90"
                    )} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-8 pr-2 space-y-1 pt-1">
                    <SiteLink siteId={site.id} to="/site-subnet" icon={Network}>
                      Site & Subnet
                    </SiteLink>
                    <SiteLink siteId={site.id} to="/discovery" icon={Radio}>
                      Discovery
                    </SiteLink>
                    <SiteLink siteId={site.id} to="/devices" icon={Server}>
                      Network Elements
                    </SiteLink>
                    <SiteLink siteId={site.id} to="/vlans" icon={Layers}>
                      VLANs
                    </SiteLink>
                    <SiteLink siteId={site.id} to="/mac-addresses" icon={MacAddressIcon}>
                      MAC Addresses
                    </SiteLink>
                    <SiteLink siteId={site.id} to="/export" icon={FileDown}>
                      Export
                    </SiteLink>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
