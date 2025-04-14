
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowRight, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

export interface SiteProps {
  id: string;
  name: string;
  description?: string;
  location?: string;
  createdAt: string;
  status: {
    progress: number;
    label: string;
  };
  onDelete: () => void;
}

export const SiteCard = ({ 
  id, 
  name, 
  description, 
  location, 
  createdAt, 
  status,
  onDelete 
}: SiteProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const navigate = useNavigate();

  const handleContinueMigration = () => {
    // Store the selected site ID for use in the subnet page
    sessionStorage.setItem('selectedSiteId', id);
    
    // Based on the progress, navigate to the appropriate page
    if (status.progress < 25) {
      navigate('/site-subnet');
    } else if (status.progress < 50) {
      navigate('/discovery');
    } else if (status.progress < 75) {
      navigate('/devices');
    } else if (status.progress < 100) {
      navigate('/vlans');
    } else {
      navigate('/export');
    }

    toast({
      title: "Resuming migration",
      description: `Continuing from site: ${name}`,
    });
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      // Delete all devices associated with this site
      await supabase
        .from('devices')
        .delete()
        .eq('site_id', id);
      
      // Delete all subnets associated with this site
      await supabase
        .from('subnets')
        .delete()
        .eq('site_id', id);
      
      // Delete all VLANs associated with this site
      await supabase
        .from('vlans')
        .delete()
        .eq('site_id', id);
      
      // Finally delete the site itself
      await supabase
        .from('sites')
        .delete()
        .eq('id', id);
      
      toast({
        title: "Site deleted",
        description: `Site "${name}" and all associated data have been removed.`,
      });
      
      onDelete();
    } catch (error) {
      console.error("Error deleting site:", error);
      toast({
        title: "Error",
        description: "Failed to delete site. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 relative">
          <div className="absolute top-4 right-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <CardTitle className="line-clamp-1">{name}</CardTitle>
          {location && (
            <p className="text-sm text-muted-foreground line-clamp-1">
              Location: {location}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {description}
            </p>
          )}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Migration Progress</span>
              <span>{status.progress}%</span>
            </div>
            <Progress value={status.progress} className="h-2" />
            <p className="text-xs text-muted-foreground">{status.label}</p>
          </div>
        </CardContent>
        <CardFooter className="pt-0">
          <Button 
            className="w-full"
            onClick={handleContinueMigration}
          >
            Continue Migration
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete site and all associated data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the site "{name}" along with all its subnets, 
              devices, VLANs and other associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Site"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
