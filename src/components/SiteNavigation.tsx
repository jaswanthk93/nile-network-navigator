
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
  const [isCreatingNewSite, setIsCreatingNewSite] = useState(false);

  // Fetch sites from database
  useEffect(() => {
    async function fetchSites() {
      if (!user) return;
      
      try {
        setIsLoading(true);
        
        console.log("SiteNavigation: Fetching sites for user:", user.id);
        
        const { data, error } = await supabase
          .from('sites')
          .select('id, name')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error("Error fetching sites:", error);
          throw error;
        }
        
        console.log(`SiteNavigation: Fetched ${data?.length || 0} sites for user ${user.id}`);
        setSites(data || []);
        
        // Only auto-select a site if we're not in new site creation mode
        // and no site is currently selected
        const params = new URLSearchParams(location.search);
        const siteIdFromUrl = params.get('site');
        const currentSiteId = siteIdFromUrl || sessionStorage.getItem('selectedSiteId');
        
        if (location.pathname === '/new-site') {
          console.log("SiteNavigation: On new-site page, setting creation mode");
          setIsCreatingNewSite(true);
          setOpenSiteId(null);
          sessionStorage.removeItem('selectedSiteId');
        } else if (data?.length > 0 && !isCreatingNewSite) {
          if (!currentSiteId) {
            console.log(`SiteNavigation: Auto-selecting the first site: ${data[0].id} (${data[0].name})`);
            sessionStorage.setItem('selectedSiteId', data[0].id);
            setOpenSiteId(data[0].id);
          } else {
            // If a site is already selected, validate that it exists in the user's sites
            const siteExists = data.some(site => site.id === currentSiteId);
            
            if (!siteExists && data.length > 0) {
              console.log(`SiteNavigation: Selected site ${currentSiteId} not found in user's sites, auto-selecting first site: ${data[0].id}`);
              sessionStorage.setItem('selectedSiteId', data[0].id);
              setOpenSiteId(data[0].id);
            } else if (siteExists) {
              console.log(`SiteNavigation: Using existing site selection: ${currentSiteId}`);
              setOpenSiteId(currentSiteId);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching sites:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    // Always fetch sites to show in sidebar, regardless of creation state
    fetchSites();
  }, [user, isCreatingNewSite, location]);

  // Handle site selection based on URL or stored ID
  useEffect(() => {
    // Don't select a site if we're creating a new one
    if (isCreatingNewSite) {
      setOpenSiteId(null);
      return;
    }
    
    // Check if we're on the new-site route
    if (location.pathname === '/new-site') {
      setIsCreatingNewSite(true);
      setOpenSiteId(null);
      sessionStorage.removeItem('selectedSiteId');
      return;
    }
    
    // Get current site ID from session storage or URL
    const params = new URLSearchParams(location.search);
    const siteIdFromUrl = params.get('site');
    const storedSiteId = sessionStorage.getItem('selectedSiteId');
    
    // Priority: URL param > session storage
    if (siteIdFromUrl) {
      console.log(`SiteNavigation: Setting open site ID from URL: ${siteIdFromUrl}`);
      setOpenSiteId(siteIdFromUrl);
      setIsCreatingNewSite(false);
      
      // Update session storage to ensure consistency
      if (siteIdFromUrl !== storedSiteId) {
        console.log(`SiteNavigation: Updating session storage with site ID from URL: ${siteIdFromUrl}`);
        sessionStorage.setItem('selectedSiteId', siteIdFromUrl);
      }
    } else if (storedSiteId) {
      console.log(`SiteNavigation: Setting open site ID from session storage: ${storedSiteId}`);
      setOpenSiteId(storedSiteId);
      setIsCreatingNewSite(false);
    }
  }, [location.pathname, location.search, isCreatingNewSite]);

  const handleCreateNewSite = () => {
    console.log("Creating new site - navigating to new site page");
    
    // Clear site selection and related data
    sessionStorage.removeItem('selectedSiteId');
    sessionStorage.removeItem('subnetIds');
    
    // Reset UI state
    setOpenSiteId(null);
    setIsCreatingNewSite(true);
    
    // Navigate to the dedicated new site page
    navigate('/new-site');
    
    toast({
      title: "Create new site",
      description: "Starting fresh with a new site migration"
    });
  };

  const handleSiteSelect = (siteId: string) => {
    // Don't allow site selection when creating a new site
    if (isCreatingNewSite) {
      return;
    }
    
    console.log(`Site selected: ${siteId}`);
    
    // Toggle site expansion in UI
    setOpenSiteId(openSiteId === siteId ? null : siteId);
    
    // Store the selected site ID
    sessionStorage.setItem('selectedSiteId', siteId);
    
    // Navigate to site page if needed
    if (!location.pathname.includes('site-') && !location.pathname.includes('discovery') && 
        !location.pathname.includes('devices') && !location.pathname.includes('vlans') &&
        !location.pathname.includes('mac-addresses') && !location.pathname.includes('export')) {
      navigate(`/site-subnet?site=${siteId}`);
    }
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

  // Always show existing sites alongside the creation button
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
          className={cn(
            "flex items-center gap-2 px-3 py-2 w-full text-left rounded-md text-sm",
            location.pathname === '/new-site' ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent"
          )}
        >
          <Plus className={cn("h-4 w-4", location.pathname === '/new-site' ? "text-primary" : "")} />
          <span>{location.pathname === '/new-site' ? "Creating New Site Migration..." : "Create New Site Migration"}</span>
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
