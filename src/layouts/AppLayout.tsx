
import { 
  Sidebar, 
  SidebarProvider, 
  SidebarContent, 
  SidebarFooter, 
  SidebarGroup, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton 
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, LogOut } from "lucide-react";
import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { UserNav } from "@/components/UserNav";
import { Logo } from "@/components/Logo";
import { BackendConnectionButton } from "@/components/BackendConnectionButton";
import { SiteNavigation } from "@/components/SiteNavigation";

const AppLayout = () => {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();

  useEffect(() => {
    console.log("AppLayout rendered:", { user, loading });
    
    // Check if we're creating a new site from URL parameters
    const params = new URLSearchParams(location.search);
    if (params.has('new')) {
      // This is a new site creation
      console.log("New site creation detected in AppLayout");
    }
  }, [user, loading, location.search]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    console.log("No user in AppLayout, redirecting to login");
    return <Navigate to="/login" replace />;
  }

  const handleSignOut = () => {
    // Clean up site-related data first
    localStorage.removeItem('creatingNewSite');
    sessionStorage.removeItem('selectedSiteId');
    sessionStorage.removeItem('subnetIds');
    
    // Then sign out
    signOut();
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar className="flex flex-col h-screen">
          <SidebarHeader className="flex items-center justify-between px-4 py-2 flex-shrink-0">
            <Logo />
          </SidebarHeader>
          <SidebarContent className="flex flex-col flex-grow overflow-hidden">
            <SidebarGroup className="flex-grow overflow-y-auto overflow-x-hidden">
              <SiteNavigation />
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4 flex-shrink-0">
            <div className="flex justify-between items-center">
              <UserNav />
              <BackendConnectionButton />
              <button 
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-foreground rounded-full p-2 hover:bg-muted transition-colors"
                title="Sign Out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 p-6 md:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
