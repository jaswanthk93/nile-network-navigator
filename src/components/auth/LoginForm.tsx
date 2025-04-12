
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onError: (error: string) => void;
}

export function LoginForm({ onError }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If already authenticated, redirect to home
    if (isAuthenticated) {
      console.log("LoginForm: User is authenticated, checking for existing sites");
      checkForExistingSites();
    }
  }, [isAuthenticated, navigate]);
  
  const checkForExistingSites = async () => {
    if (!user) return;
    
    try {
      // Check if user has any existing sites
      const { data: sites, error } = await supabase
        .from('sites')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) {
        console.error("Error checking for existing sites:", error);
        navigate('/', { replace: true });
        return;
      }
      
      if (sites && sites.length > 0) {
        // Store site information in session storage for the welcome page
        sessionStorage.setItem('existingSites', JSON.stringify(sites));
        navigate('/', { replace: true });
      } else {
        // No existing sites, just go to home
        navigate('/', { replace: true });
      }
    } catch (error) {
      console.error("Error in site check:", error);
      navigate('/', { replace: true });
    }
  };
  
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      setIsLoading(true);
      console.log("Attempting login with:", values.email);
      const { error } = await signIn(values.email, values.password);
      
      if (error) {
        console.error("Login error:", error.message);
        onError(error.message);
        toast({
          title: "Login failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log("Login successful, should be redirected soon");
        toast({
          title: "Login successful",
          description: "You have been logged in",
        });
        // Navigation is handled in the useEffect above when isAuthenticated changes
      }
    } catch (error) {
      console.error("Unexpected error during login:", error);
      onError("An unexpected error occurred. Please try again.");
      toast({
        title: "Login failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="example@example.com" type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input placeholder="••••••••" type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>
      <div className="mt-4 text-center text-sm">
        Don't have an account?{" "}
        <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign up
        </Link>
      </div>
    </Form>
  );
}
