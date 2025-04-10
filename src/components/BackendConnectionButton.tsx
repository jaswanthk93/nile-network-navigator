
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PlugIcon, LoaderCircleIcon, FileTextIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { checkBackendConnection, getConnectionErrorExplanation } from "@/utils/backendConnection";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BackendLogViewer } from "@/components/BackendLogViewer";

export function BackendConnectionButton() {
  const [isChecking, setIsChecking] = useState(false);
  const [status, setStatus] = useState<{ 
    connected: boolean; 
    message: string;
    errorType?: string;
    lastChecked?: Date;
  } | null>(null);
  const [openLogs, setOpenLogs] = useState(false);
  const { toast } = useToast();

  const checkConnection = async () => {
    setIsChecking(true);
    try {
      const result = await checkBackendConnection();
      setStatus({
        ...result,
        lastChecked: new Date()
      });
      
      toast({
        title: result.connected ? "Backend Connected" : "Backend Disconnected",
        description: result.connected ? result.message : getConnectionErrorExplanation(result.errorType),
        variant: result.connected ? "default" : "destructive",
      });
    } catch (error) {
      console.error("Error checking connection:", error);
      setStatus({ 
        connected: false, 
        message: "Connection check failed",
        errorType: "unknown",
        lastChecked: new Date()
      });
      
      toast({
        title: "Connection Error",
        description: "Failed to check backend connection",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };

  // Handler to prevent dialog from closing when clicking inside the log viewer
  const handleDialogContentClick = (e: React.MouseEvent) => {
    // Stop propagation for all clicks inside the content
    e.stopPropagation();
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={checkConnection} 
            disabled={isChecking}
            className={status?.connected ? "text-green-500" : status ? "text-red-500" : ""}
          >
            {isChecking ? (
              <LoaderCircleIcon className="h-4 w-4 animate-spin" />
            ) : (
              <PlugIcon className="h-4 w-4" />
            )}
            <span className="sr-only">Check backend connection</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p>
              {isChecking 
                ? "Checking backend connection..." 
                : status 
                  ? status.connected 
                    ? status.message 
                    : "Backend not connected"
                  : "Check backend connection"}
            </p>
            {status && !status.connected && status.errorType && (
              <p className="text-xs text-muted-foreground">
                {getConnectionErrorExplanation(status.errorType)}
              </p>
            )}
            {status?.lastChecked && (
              <p className="text-xs text-muted-foreground">
                Last checked: {status.lastChecked.toLocaleTimeString()}
              </p>
            )}
            <div className="pt-2">
              <Dialog open={openLogs} onOpenChange={setOpenLogs}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full flex gap-2 items-center"
                  >
                    <FileTextIcon className="h-3 w-3" />
                    View Logs
                  </Button>
                </DialogTrigger>
                <DialogContent 
                  className="sm:max-w-[700px] max-h-[80vh]"
                  onClick={handleDialogContentClick}
                  onPointerDownOutside={(e) => {
                    // Prevent closing when clicking inside the content
                    if (e.target instanceof Element && 
                        e.target.closest('.scroll-area-logs')) {
                      e.preventDefault();
                    }
                  }}
                  onInteractOutside={(e) => {
                    // Prevent closing dialog when interacting with content
                    if (e.target instanceof Element && 
                        e.target.closest('.scroll-area-logs')) {
                      e.preventDefault();
                    }
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>Backend Connection Logs</DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="h-[500px] rounded-md border p-4 scroll-area-logs">
                    <BackendLogViewer />
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
