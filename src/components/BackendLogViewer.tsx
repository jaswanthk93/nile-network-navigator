
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCwIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { fetchBackendLogs } from "@/utils/backendConnection";

export function BackendLogViewer() {
  const [logs, setLogs] = useState<{
    timestamp: string;
    level: 'info' | 'error' | 'warn';
    message: string;
    details?: any;
  }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<number>>(new Set());
  const [showRawData, setShowRawData] = useState(false);

  const getLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log("Fetching backend logs...");
      const logData = await fetchBackendLogs();
      setLogs(logData);
    } catch (err) {
      console.error("Error fetching logs:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch logs";
      setError(errorMessage);
      
      // Provide more helpful error message for common issues
      if (errorMessage.includes("404")) {
        setError("Logs endpoint not found (404). Make sure the backend server is running and the API endpoint exists at '/api/logs'.");
      } else if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
        setError("Network error connecting to backend. Check that the server is running and accessible.");
      } else if (errorMessage.includes("timeout")) {
        setError("Request timed out. The backend server may be overloaded or unreachable.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    getLogs();
    
    // Set up a polling interval to refresh logs periodically
    // This is commented out to prevent continuous refresh issues
    // const interval = setInterval(getLogs, 10000); // Refresh every 10 seconds
    // return () => clearInterval(interval);
  }, [getLogs]);

  const getLogStyle = (level: string) => {
    switch (level) {
      case 'error':
        return "text-red-500 bg-red-50 border-red-100";
      case 'warn':
        return "text-amber-600 bg-amber-50 border-amber-100";
      default:
        return "text-foreground bg-background border-border";
    }
  };

  const toggleLogExpansion = (index: number) => {
    setExpandedLogIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const toggleRawDataView = () => {
    setShowRawData(!showRawData);
  };

  const renderRawSnmpData = (details: any) => {
    if (!details || !details.rawData) return null;
    
    const { vlanState, vlanName } = details.rawData;
    
    return (
      <div className="mt-3 space-y-2">
        <h4 className="font-semibold text-xs">Raw SNMP Data</h4>
        
        {vlanState && vlanState.length > 0 && (
          <div className="space-y-1">
            <h5 className="text-xs font-medium">VLAN State Responses:</h5>
            <div className="max-h-40 overflow-y-auto bg-gray-50 p-2 rounded text-xs font-mono">
              {vlanState.map((item, i) => (
                <div key={i} className="py-0.5">
                  {item.oid} = {item.value}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {vlanName && vlanName.length > 0 && (
          <div className="space-y-1">
            <h5 className="text-xs font-medium">VLAN Name Responses:</h5>
            <div className="max-h-40 overflow-y-auto bg-gray-50 p-2 rounded text-xs font-mono">
              {vlanName.map((item, i) => (
                <div key={i} className="py-0.5">
                  {item.oid} = {item.value}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Connection and Protocol Logs</h3>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleRawDataView}
            className="flex items-center gap-1"
          >
            {showRawData ? "Hide Raw Data" : "Show Raw Data"}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={getLogs} 
            disabled={isLoading}
            className="flex items-center gap-1"
          >
            {isLoading ? (
              <>
                <RefreshCwIcon className="h-3 w-3 animate-spin" />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <RefreshCwIcon className="h-3 w-3" />
                <span>Refresh</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {logs.length === 0 && !isLoading && !error ? (
        <div className="text-center py-8 text-muted-foreground">
          No logs available. Check that the backend server is running.
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log, index) => (
            <div 
              key={index} 
              className={`p-2 text-sm rounded border ${getLogStyle(log.level)}`}
            >
              <div className="flex justify-between items-start">
                <span className="font-mono">{log.timestamp}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    log.level === 'error' ? 'bg-red-100 text-red-800' : 
                    log.level === 'warn' ? 'bg-amber-100 text-amber-800' : 
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {log.level}
                  </span>
                  {log.details && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => toggleLogExpansion(index)}
                      className="h-5 w-5 p-0"
                    >
                      {expandedLogIds.has(index) ? 
                        <ChevronUpIcon className="h-4 w-4" /> : 
                        <ChevronDownIcon className="h-4 w-4" />
                      }
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-1">{log.message}</div>
              {log.details && expandedLogIds.has(index) && (
                <div className="mt-2">
                  <pre className="p-1 bg-gray-100 rounded text-xs overflow-x-auto">
                    {typeof log.details === 'object' 
                      ? JSON.stringify(log.details, null, 2) 
                      : log.details}
                  </pre>
                  
                  {/* Render raw SNMP data if available and raw data view is enabled */}
                  {showRawData && renderRawSnmpData(log.details)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
