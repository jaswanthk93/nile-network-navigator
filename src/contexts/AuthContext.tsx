
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/components/ui/use-toast";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  register: (userData: RegisterData) => Promise<void>;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  companyName: string;
  password: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Check for stored user data on component mount
    const storedUser = localStorage.getItem('nile_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const register = async (userData: RegisterData) => {
    setIsLoading(true);
    try {
      // In a real app, this would be an API call
      // For now, we'll simulate registration
      const newUser: User = {
        id: crypto.randomUUID(),
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        companyName: userData.companyName,
      };
      
      // Store user in localStorage (simulating persistence)
      localStorage.setItem('nile_user', JSON.stringify(newUser));
      setUser(newUser);
      
      toast({
        title: "Registration successful",
        description: "Your account has been created.",
      });
      
      navigate('/');
    } catch (error) {
      toast({
        title: "Registration failed",
        description: "There was an error creating your account.",
        variant: "destructive",
      });
      console.error("Registration error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      // In a real app, this would be an API call
      // For now, we'll simulate login with mock data
      
      // Simplified validation - in a real app, this would check against a backend
      if (credentials.email === "demo@example.com" && credentials.password === "password") {
        const mockUser: User = {
          id: "mock-user-1",
          firstName: "Demo",
          lastName: "User",
          email: credentials.email,
          companyName: "Demo Company",
        };
        
        localStorage.setItem('nile_user', JSON.stringify(mockUser));
        setUser(mockUser);
        
        toast({
          title: "Login successful",
          description: "Welcome back!",
        });
        
        navigate('/');
      } else {
        // Check if there's a registered user
        const storedUser = localStorage.getItem('nile_credentials');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          if (userData.email === credentials.email && userData.password === credentials.password) {
            setUser({
              id: userData.id,
              firstName: userData.firstName,
              lastName: userData.lastName,
              email: userData.email,
              companyName: userData.companyName,
            });
            
            toast({
              title: "Login successful",
              description: "Welcome back!",
            });
            
            navigate('/');
            return;
          }
        }
        
        throw new Error("Invalid credentials");
      }
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Invalid email or password",
        variant: "destructive",
      });
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('nile_user');
    setUser(null);
    toast({
      title: "Logged out",
      description: "You have been logged out successfully.",
    });
    navigate('/login');
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    register,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
