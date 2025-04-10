
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCwIcon } from "lucide-react";
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
        setError("Logs endpoint not found (404). Make sure the backend server is running and the API endpoint exists.");
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Connection and Protocol Logs</h3>
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
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  log.level === 'error' ? 'bg-red-100 text-red-800' : 
                  log.level === 'warn' ? 'bg-amber-100 text-amber-800' : 
                  'bg-blue-100 text-blue-800'
                }`}>
                  {log.level}
                </span>
              </div>
              <div className="mt-1">{log.message}</div>
              {log.details && (
                <pre className="mt-2 p-1 bg-gray-100 rounded text-xs overflow-x-auto">
                  {typeof log.details === 'object' 
                    ? JSON.stringify(log.details, null, 2) 
                    : log.details}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
