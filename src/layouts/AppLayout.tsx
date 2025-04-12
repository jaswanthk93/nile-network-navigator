
import { Outlet, Navigate } from "react-router-dom";
import { Sidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

const AppLayout = () => {
  const { user, loading } = useAuth();

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
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
