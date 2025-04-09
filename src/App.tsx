
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import AuthLayout from "./layouts/AuthLayout";
import AppLayout from "./layouts/AppLayout";
import RegisterPage from "./pages/auth/RegisterPage";
import LoginPage from "./pages/auth/LoginPage";
import WelcomePage from "./pages/app/WelcomePage";
import SiteSubnetPage from "./pages/app/SiteSubnetPage";
import DiscoveryPage from "./pages/app/DiscoveryPage";
import DevicesPage from "./pages/app/DevicesPage";
import VlansPage from "./pages/app/VlansPage";
import MacAddressPage from "./pages/app/MacAddressPage";
import ExportPage from "./pages/app/ExportPage";
import NotFound from "./pages/NotFound";
import Index from "./pages/Index";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            {/* Auth Routes */}
            <Route element={<AuthLayout />}>
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/login" element={<LoginPage />} />
            </Route>
            
            {/* App Routes */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<WelcomePage />} />
              <Route path="/site-subnet" element={<SiteSubnetPage />} />
              <Route path="/discovery" element={<DiscoveryPage />} />
              <Route path="/devices" element={<DevicesPage />} />
              <Route path="/vlans" element={<VlansPage />} />
              <Route path="/mac-addresses" element={<MacAddressPage />} />
              <Route path="/export" element={<ExportPage />} />
            </Route>
            
            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
