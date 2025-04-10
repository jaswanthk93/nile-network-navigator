
import React from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { RefreshCwIcon, AlertCircleIcon, DatabaseIcon } from "lucide-react";
import { getConnectionErrorExplanation, getConnectionTroubleshootingSteps } from "@/utils/backendConnection";

interface BackendStatusIndicatorProps {
  backendStatus: {
    connected: boolean;
    message: string;
    errorType?: string;
    lastChecked?: Date;
  } | null;
  isCheckingBackend: boolean;
  checkBackendStatus: () => Promise<void>;
}

const BackendStatusIndicator: React.FC<BackendStatusIndicatorProps> = ({
  backendStatus,
  isCheckingBackend,
  checkBackendStatus,
}) => {
  return (
    <>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {backendStatus?.connected ? (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <DatabaseIcon className="h-4 w-4" />
              <span>Backend agent connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertCircleIcon className="h-4 w-4" />
              <span>Backend agent not connected</span>
            </div>
          )}
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={checkBackendStatus}
          disabled={isCheckingBackend}
          className="flex items-center gap-1"
        >
          {isCheckingBackend ? (
            <>
              <RefreshCwIcon className="h-3 w-3 animate-spin" />
              <span>Checking...</span>
            </>
          ) : (
            <>
              <RefreshCwIcon className="h-3 w-3" />
              <span>Check Connection</span>
            </>
          )}
        </Button>
      </div>
      
      {!backendStatus?.connected && backendStatus?.errorType && (
        <Alert variant="warning" className="mt-3">
          <AlertTitle>Backend Connection Failed</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{getConnectionErrorExplanation(backendStatus.errorType)}</p>
            <ul className="text-xs list-disc list-inside mt-1">
              {getConnectionTroubleshootingSteps(backendStatus.errorType).map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
};

export default BackendStatusIndicator;
