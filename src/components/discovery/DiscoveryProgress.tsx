
import React from "react";
import { Progress } from "@/components/ui/progress";
import { AlertTriangleIcon, WifiIcon, ServerIcon, AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DiscoveryProgressProps {
  discovery: {
    status: "idle" | "scanning" | "connecting" | "gathering" | "complete" | "error";
    progress: number;
    message: string;
    devices: number;
    devicesNeedingVerification: number;
    devicesByCategory?: Record<string, number>;
    error?: string;
    errorType?: string;
  };
  checkBackendStatus?: () => Promise<void>;
  resetDiscovery: () => void;
  isCheckingBackend: boolean;
}

const DiscoveryProgress: React.FC<DiscoveryProgressProps> = ({
  discovery,
  checkBackendStatus,
  resetDiscovery,
  isCheckingBackend,
}) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Progress</span>
          <span>{discovery.progress}%</span>
        </div>
        <Progress value={discovery.progress} className="h-2" />
      </div>

      {discovery.status === "error" && (
        <div className="mt-4 rounded-md bg-destructive/15 p-4">
          <div className="flex items-start">
            <AlertTriangleIcon className="h-5 w-5 text-destructive mr-2 mt-0.5" />
            <div>
              <h4 className="font-medium text-destructive">Error during discovery</h4>
              <p className="text-sm text-muted-foreground">
                {discovery.error}
              </p>
              <div className="flex gap-2 mt-2">
                {discovery.errorType === 'backend' && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={checkBackendStatus}
                    disabled={isCheckingBackend}
                  >
                    {isCheckingBackend ? "Checking..." : "Check Backend"}
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={resetDiscovery}
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {discovery.status !== "idle" && discovery.status !== "error" && (
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2">
              <WifiIcon className="h-5 w-5 text-primary" />
              <h3 className="font-medium">Devices Found</h3>
            </div>
            <p className="mt-2 text-2xl font-bold">{discovery.devices}</p>
            {discovery.devicesByCategory && discovery.status === "complete" && (
              <div className="mt-2 text-xs text-muted-foreground">
                {Object.entries(discovery.devicesByCategory).map(([category, count]) => (
                  <div key={category} className="flex justify-between">
                    <span>{category}:</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2">
              <ServerIcon className="h-5 w-5 text-primary" />
              <h3 className="font-medium">Subnets Scanned</h3>
            </div>
            <p className="mt-2 text-2xl font-bold">
              {discovery.status === "idle" ? "0/0" : "1/1"}
            </p>
          </div>
        </div>
      )}
      
      {discovery.status === "complete" && discovery.devicesNeedingVerification > 0 && (
        <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-start">
            <AlertCircleIcon className="h-5 w-5 text-amber-500 mr-2 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-700">Additional Information Needed</h4>
              <p className="text-sm text-amber-600">
                {discovery.devicesNeedingVerification} device(s) were discovered but have limited information. 
                This occurs when SNMP requests failed or devices are in different subnets from your host.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiscoveryProgress;
