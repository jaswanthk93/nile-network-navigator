
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';

const AuthLayout = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
        <Logo />
      </div>
      <main className="flex flex-1 flex-col items-center justify-center p-4 md:p-8 lg:p-12">
        <div className="mx-auto grid w-full max-w-md gap-6">
          <Outlet />
        </div>
      </main>
      <footer className="flex h-14 items-center border-t px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Nile Network Navigator. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            v1.0.0
          </p>
        </div>
      </footer>
    </div>
  );
};

export default AuthLayout;
