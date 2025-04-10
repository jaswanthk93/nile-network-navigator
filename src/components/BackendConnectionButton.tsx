
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { WifiIcon, WifiOffIcon, LoaderCircleIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { checkBackendConnection, getConnectionErrorExplanation } from "@/utils/backendConnection";

export function BackendConnectionButton() {
  const [isChecking, setIsChecking] = useState(false);
  const [status, setStatus] = useState<{ 
    connected: boolean; 
    message: string;
    errorType?: string;
    lastChecked?: Date;
  } | null>(null);
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
            ) : status?.connected ? (
              <WifiIcon className="h-4 w-4" />
            ) : (
              <WifiOffIcon className="h-4 w-4" />
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
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
