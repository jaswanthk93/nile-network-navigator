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
import { 
  Loader2, 
  Home, 
  Network, 
  Server, 
  Layers, 
  Radio, 
  FileDown, 
  LogOut 
} from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { UserNav } from "@/components/UserNav";
import { Logo } from "@/components/Logo";
import { BackendConnectionButton } from "@/components/BackendConnectionButton";
import { MacAddressIcon } from "@/components/MacAddressIcon";

const AppLayout = () => {
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    console.log("AppLayout rendered:", { user, loading });
  }, [user, loading]);

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

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar>
          <SidebarHeader className="flex items-center justify-between px-4 py-2">
            <Logo />
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Welcome">
                    <Link to="/">
                      <Home className="h-5 w-5" />
                      <span>Welcome</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Site & Subnet">
                    <Link to="/site-subnet">
                      <Network className="h-5 w-5" />
                      <span>Site & Subnet</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Discovery">
                    <Link to="/discovery">
                      <Radio className="h-5 w-5" />
                      <span>Discovery</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Network Elements">
                    <Link to="/devices">
                      <Server className="h-5 w-5" />
                      <span>Network Elements</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="VLANs" isActive={window.location.pathname === "/vlans"}>
                    <Link to="/vlans">
                      <Layers className="h-5 w-5" />
                      <span>VLANs</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="MAC Addresses">
                    <Link to="/mac-addresses">
                      <MacAddressIcon className="h-5 w-5" />
                      <span>MAC Addresses</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Export">
                    <Link to="/export">
                      <FileDown className="h-5 w-5" />
                      <span>Export</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4">
            <div className="flex justify-between items-center">
              <UserNav />
              <BackendConnectionButton />
              <button 
                onClick={() => signOut()}
                className="text-muted-foreground hover:text-foreground rounded-full p-2 hover:bg-muted transition-colors"
                title="Sign Out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
