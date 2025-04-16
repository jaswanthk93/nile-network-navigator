
import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteSite } from "@/utils/siteManagement";
import { SiteSubsections } from "@/components/welcome/SiteSubsections";

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
  const [isExpanded, setIsExpanded] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const navigate = useNavigate();

  const handleContinueMigration = () => {
    sessionStorage.setItem('selectedSiteId', id);
    if (status.progress < 25) {
      navigate('/site-subnet');
    } else if (status.progress < 50) {
      navigate('/discovery');
    } else if (status.progress < 75) {
      navigate('/devices');
    } else if (status.progress < 85) {
      navigate('/vlans');
    } else if (status.progress < 95) {
      navigate('/mac-addresses');
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
    setDeleteError(null);
    
    const result = await deleteSite({
      siteId: id,
      siteName: name,
      onSuccess: onDelete,
      onError: (error) => {
        setDeleteError(error);
        setShowErrorDetails(true);
      }
    });
    
    setIsDeleting(false);
    setShowDeleteDialog(false);
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
          <CardTitle className="line-clamp-1">
            <span>{name}</span>
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
            <div className="flex items-center gap-2">
              <Progress value={status.progress} className="h-2 flex-1" />
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 shrink-0 text-muted-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                aria-label={isExpanded ? "Collapse details" : "Expand details"}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{status.label}</p>
          </div>
          
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleContent className="mt-4 space-y-4">
              <SiteSubsections 
                progress={status.progress}
                onNavigate={handleNavigateToSection}
              />
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

      <Dialog open={!!deleteError && showErrorDetails} onOpenChange={setShowErrorDetails}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error Details</DialogTitle>
            <DialogDescription>
              There was a problem deleting the site. The error message is:
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted p-4 rounded-md overflow-auto max-h-[200px] text-sm font-mono">
            {deleteError}
          </div>
          <DialogFooter>
            <Button 
              variant="secondary" 
              onClick={() => setShowErrorDetails(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
