
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { History, Plus } from "lucide-react";

interface Site {
  id: string;
  name: string;
  description?: string;
  location?: string;
  created_at: string;
}

export const SessionResumptionDialog = () => {
  const [existingSites, setExistingSites] = useState<Site[]>([]);
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have existing sites in session storage
    const sitesData = sessionStorage.getItem('existingSites');
    if (sitesData) {
      try {
        const sites = JSON.parse(sitesData);
        setExistingSites(sites);
        setVisible(true);
        // Clear the session storage so this only shows after login
        sessionStorage.removeItem('existingSites');
      } catch (error) {
        console.error("Error parsing sites data:", error);
      }
    }
  }, []);

  const handleResumeMigration = (siteId: string, siteName: string) => {
    toast({
      title: "Resuming migration",
      description: `Continuing from site: ${siteName}`,
    });
    // Store the selected site ID for use in the subnet page
    sessionStorage.setItem('selectedSiteId', siteId);
    navigate('/site-subnet');
  };

  const handleStartNew = () => {
    toast({
      title: "Starting new migration",
      description: "Creating a new site",
    });
    navigate('/site-subnet');
  };

  if (!visible) return null;

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Resume Previous Migration
        </CardTitle>
        <CardDescription>
          We found existing migration data. Would you like to continue where you left off?
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm font-medium">Your existing sites:</div>
          <div className="grid gap-3">
            {existingSites.map((site) => (
              <div key={site.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">{site.name}</div>
                  {site.description && (
                    <div className="text-sm text-muted-foreground">{site.description}</div>
                  )}
                </div>
                <Button size="sm" onClick={() => handleResumeMigration(site.id, site.name)}>
                  Resume
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between border-t px-6 py-4">
        <Button variant="outline" onClick={() => setVisible(false)}>
          Dismiss
        </Button>
        <Button onClick={handleStartNew}>
          <Plus className="h-4 w-4 mr-2" />
          Start New Migration
        </Button>
      </CardFooter>
    </Card>
  );
};
