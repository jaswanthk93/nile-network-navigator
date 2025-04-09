
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        // If user is already authenticated, redirect to welcome page
        navigate('/');
      } else {
        // Redirect to login if not authenticated
        navigate('/login');
      }
    }
    // For debugging
    console.log('Index page:', { isAuthenticated, isLoading });
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Nile Network Navigator</h1>
        <p className="text-xl text-muted-foreground">Loading application...</p>
      </div>
    </div>
  );
};

export default Index;
