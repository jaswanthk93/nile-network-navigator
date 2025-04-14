
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { MapPinIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const siteFormSchema = z.object({
  siteName: z.string().min(2, { message: "Site name must be at least 2 characters." }),
  address: z.string().min(5, { message: "Please enter a valid address." }),
});

type SiteFormValues = z.infer<typeof siteFormSchema>;

const NewSitePage = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  const siteForm = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: {
      siteName: "",
      address: "",
    },
  });

  const onSiteSubmit = async (values: SiteFormValues) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to add site information.",
        variant: "destructive",
      });
      navigate('/login');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const { data, error } = await supabase
        .from('sites')
        .insert({
          name: values.siteName,
          location: values.address,
          user_id: user.id
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Store the newly created site ID in session storage
      sessionStorage.setItem('selectedSiteId', data.id);
      
      // Clear the creating new site flag
      localStorage.removeItem('creatingNewSite');
      
      toast({
        title: "Site created successfully",
        description: "You can now configure subnets for this site.",
      });
      
      // Navigate to subnet configuration with the new site ID
      navigate(`/site-subnet?site=${data.id}`);
    } catch (error) {
      console.error("Error saving site:", error);
      toast({
        title: "Error creating site",
        description: "There was a problem saving your site information.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Create New Site</h1>
        <p className="text-muted-foreground">
          Begin by creating a new network site for migration
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPinIcon className="h-5 w-5" />
            Site Information
          </CardTitle>
          <CardDescription>
            Enter details about the site where network devices are located
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...siteForm}>
            <form onSubmit={siteForm.handleSubmit(onSiteSubmit)} className="space-y-4">
              <FormField
                control={siteForm.control}
                name="siteName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Main Office" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={siteForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="123 Network Street, Server City, SC 12345"
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Site...
                  </>
                ) : (
                  "Create Site"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-between border-t px-6 py-4">
          <Button variant="outline" onClick={() => navigate("/")}>
            Cancel
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default NewSitePage;
