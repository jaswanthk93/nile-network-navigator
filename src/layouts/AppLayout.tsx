import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';
import { UserNav } from '@/components/UserNav';
import { NavLink } from '@/components/NavLink';
import { BackendConnectionButton } from '@/components/BackendConnectionButton';
import { NetworkIcon, MapPinIcon, ScanSearchIcon, MonitorIcon, ShareIcon, FolderKanbanIcon, TabletSmartphoneIcon } from 'lucide-react';

const AppLayout = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const navItems = [
    { path: '/', label: 'Welcome', icon: <NetworkIcon className="h-5 w-5" /> },
    { path: '/site-subnet', label: 'Site & Subnet', icon: <MapPinIcon className="h-5 w-5" /> },
    { path: '/discovery', label: 'Discovery', icon: <ScanSearchIcon className="h-5 w-5" /> },
    { path: '/devices', label: 'Devices', icon: <MonitorIcon className="h-5 w-5" /> },
    { path: '/vlans', label: 'VLANs', icon: <FolderKanbanIcon className="h-5 w-5" /> },
    { path: '/mac-addresses', label: 'MAC Addresses', icon: <TabletSmartphoneIcon className="h-5 w-5" /> },
    { path: '/export', label: 'Export', icon: <ShareIcon className="h-5 w-5" /> },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
        <div className="flex flex-1 items-center gap-2 md:gap-4">
          <Logo />
          <nav className="hidden md:flex md:gap-2">
            {navItems.map((item) => (
              <NavLink key={item.path} to={item.path}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <BackendConnectionButton />
          <UserNav />
        </div>
      </header>
      <div className="grid flex-1 md:grid-cols-[220px_1fr]">
        <nav className="flex flex-col border-r p-4 md:block">
          <div className="grid gap-2">
            {navItems.map((item) => (
              <NavLink 
                key={item.path} 
                to={item.path} 
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium"
                activeClassName="bg-muted text-primary"
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
      <footer className="border-t py-2 px-4 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Nile Network Navigator. All rights reserved.
      </footer>
    </div>
  );
};

export default AppLayout;
