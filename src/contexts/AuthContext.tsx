
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

type RegisterData = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  companyName: string;
  password: string;
};

type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  is_approved: boolean;
  company_name: string;
  phone_number: string;
};

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  isApproved: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Compute derived state
  const isAuthenticated = !!user;
  const isLoading = loading;
  const isApproved = !!profile?.is_approved;
  const isAdmin = !!user?.user_metadata?.is_admin;

  // Function to fetch user profile
  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      setProfile(data);
      return data;
    } catch (error) {
      console.error('Exception fetching user profile:', error);
      return null;
    }
  };

  // Function to refresh the user profile
  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.info("Auth state changed:", event, {
          _type: typeof newSession,
          value: typeof newSession === 'undefined' ? 'undefined' : newSession
        });
        
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        // Only auto-navigate on SIGNED_OUT events, not on internal session changes
        if (event === 'SIGNED_OUT') {
          setProfile(null);
          navigate('/login');
        }
        
        // When user gets authenticated, fetch their profile
        if (newSession?.user) {
          // Use setTimeout to prevent possible recursion issues
          setTimeout(() => {
            fetchUserProfile(newSession.user.id);
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      console.info("Initial session:", {
        _type: typeof initialSession,
        value: typeof initialSession === 'undefined' ? 'undefined' : initialSession
      });
      
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      
      if (initialSession?.user) {
        fetchUserProfile(initialSession.user.id).then(() => {
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (!error) {
        const userProfile = await fetchUserProfile((await supabase.auth.getUser()).data.user?.id || '');
        
        if (!userProfile?.is_approved) {
          // If not approved, show a message and sign them out
          toast({
            title: "Account Pending Approval",
            description: "Your account is awaiting administrator approval. You'll receive an email when approved.",
            variant: "default",
          });
          await supabase.auth.signOut();
          navigate('/login');
          return { error: new Error('Account pending approval') };
        }
        
        navigate('/');
      }
      
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      
      if (!error) {
        // Instead of redirecting, show a message to wait for approval
        toast({
          title: "Registration Successful",
          description: "Your account has been created and is awaiting admin approval. You'll receive an email when approved.",
          variant: "default",
        });
        
        navigate('/login');
      }
      
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  // Added for UserNav.tsx
  const logout = async () => {
    await signOut();
  };

  // Added for RegisterForm.tsx
  const register = async (data: RegisterData) => {
    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
            phone_number: data.phoneNumber,
            company_name: data.companyName,
          },
          emailRedirectTo: window.location.origin,
        },
      });
      
      if (!error) {
        // Show pending approval message
        toast({
          title: "Registration Successful",
          description: "Your account has been created and is awaiting admin approval. You'll receive an email when approved.",
          variant: "default",
        });
        
        navigate('/login');
      }
      
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        isLoading,
        isAuthenticated,
        isApproved,
        isAdmin,
        signIn,
        signUp,
        signOut,
        logout,
        register,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
