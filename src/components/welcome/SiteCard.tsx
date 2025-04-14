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
import { ArrowRight, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

interface SubsectionProps {
  title: string;
  description: string;
  progress: number;
  path: string;
  available: boolean;
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
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();

  const getSubsections = (): SubsectionProps[] => {
    return [
      {
        title: "Site & Subnet Setup",
        description: "Configure site details and network subnets",
        progress: status.progress >= 25 ? 100 : Math.min(status.progress * 4, 100),
        path: "/site-subnet",
        available: true
      },
      {
        title: "Network Discovery",
        description: "Scan and identify devices on your network",
        progress: status.progress < 25 ? 0 : 
                 status.progress >= 50 ? 100 : 
                 Math.min((status.progress - 25) * 4, 100),
        path: "/discovery",
        available: status.progress >= 25
      },
      {
        title: "Device Verification",
        description: "Verify discovered network elements",
        progress: status.progress < 50 ? 0 : 
                 status.progress >= 75 ? 100 : 
                 Math.min((status.progress - 50) * 4, 100),
        path: "/devices",
        available: status.progress >= 50
      },
      {
        title: "VLAN Management",
        description: "Configure and manage VLANs",
        progress: status.progress < 75 ? 0 : 
                 status.progress >= 90 ? 100 : 
                 Math.min((status.progress - 75) * 6.7, 100),
        path: "/vlans",
        available: status.progress >= 75
      },
      {
        title: "Export for Migration",
        description: "Generate migration files for Nile",
        progress: status.progress < 90 ? 0 : 
                 status.progress >= 100 ? 100 : 
                 Math.min((status.progress - 90) * 10, 100),
        path: "/export",
        available: status.progress >= 90
      }
    ];
  };

  const handleContinueMigration = () => {
    sessionStorage.setItem('selectedSiteId', id);
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

  const handleNavigateToSection = (path: string) => {
    sessionStorage.setItem('selectedSiteId', id);
    navigate(path);
    toast({
      title: "Navigating to section",
      description: `Continuing with site: ${name}`,
    });
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await supabase
        .from('devices')
        .delete()
        .eq('site_id', id);
      
      await supabase
        .from('subnets')
        .delete()
        .eq('site_id', id);
      
      await supabase
        .from('vlans')
        .delete()
        .eq('site_id', id);
      
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

  const handleCardClick = (e: React.MouseEvent) => {
    if (
      e.target instanceof Element && 
      (e.target.closest('button[aria-label="Delete site"]') || 
       e.target.closest('button.continue-button'))
    ) {
      return;
    }
    
    setIsExpanded(!isExpanded);
  };

  return (
    <>
      <Card 
        className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'shadow-lg' : ''}`}
        onClick={handleCardClick}
      >
        <CardHeader className="pb-2 relative">
          <div className="absolute top-4 right-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
              aria-label="Delete site"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <CardTitle className="line-clamp-1 flex items-center justify-between">
            <span>{name}</span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 ml-2 text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CardTitle>
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
          
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleContent className="mt-4 space-y-4">
              {getSubsections().map((subsection, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{subsection.title}</span>
                    <span className="text-xs">{Math.round(subsection.progress)}%</span>
                  </div>
                  <Progress value={subsection.progress} className="h-1.5" />
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">{subsection.description}</p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2 text-xs"
                      disabled={!subsection.available}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNavigateToSection(subsection.path);
                      }}
                    >
                      {subsection.available ? 'Go to section' : 'Locked'}
                    </Button>
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
        <CardFooter className="pt-0">
          <Button 
            className="w-full continue-button"
            onClick={(e) => {
              e.stopPropagation();
              handleContinueMigration();
            }}
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
