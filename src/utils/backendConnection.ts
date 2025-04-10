
/**
 * Utility functions for checking backend proxy agent connectivity
 */

/**
 * Check if the backend proxy agent is connected and responding
 * @returns Promise resolving to connection status with detailed error information
 */
export const checkBackendConnection = async (): Promise<{ 
  connected: boolean; 
  message: string;
  errorType?: 'timeout' | 'network' | 'server' | 'unknown';
}> => {
  try {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    console.log(`Checking backend connection at ${backendUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`${backendUrl}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return { 
        connected: true, 
        message: `Backend connected (${new Date(data.timestamp).toLocaleTimeString()})` 
      };
    }
    
    return { 
      connected: false, 
      message: `Backend responded with status: ${response.status}`, 
      errorType: 'server' 
    };
  } catch (error) {
    console.error('Error checking backend connection:', error);
    
    let errorType: 'timeout' | 'network' | 'unknown' = 'unknown';
    let message = error instanceof Error ? error.message : 'Connection failed';
    
    if (error instanceof DOMException && error.name === 'AbortError') {
      errorType = 'timeout';
      message = 'Connection timed out after 3 seconds';
    } else if (error instanceof TypeError && error.message.includes('fetch')) {
      errorType = 'network';
      message = 'Network error: Cannot reach backend server';
    }
    
    return { 
      connected: false, 
      message, 
      errorType 
    };
  }
};

/**
 * Fetch logs from the backend server
 * @returns Promise resolving to an array of log entries
 */
export const fetchBackendLogs = async (): Promise<{
  timestamp: string;
  level: 'info' | 'error' | 'warn';
  message: string;
  details?: any;
}[]> => {
  try {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    console.log(`Fetching logs from ${backendUrl}/api/logs`);
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${backendUrl}/api/logs`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Successfully fetched ${data.length} log entries`);
    return data;
  } catch (error) {
    console.error('Error fetching backend logs:', error);
    throw error;
  }
};

/**
 * Get a human-readable explanation of a backend connection error
 */
export const getConnectionErrorExplanation = (errorType?: string): string => {
  switch (errorType) {
    case 'timeout':
      return 'The connection to the backend timed out. The server might be overloaded or unreachable.';
    case 'network':
      return 'Could not establish a network connection to the backend server. Please check that the backend is running and accessible.';
    case 'server':
      return 'The backend server responded with an error. The service might be misconfigured or experiencing issues.';
    default:
      return 'The backend connection failed. Please ensure the backend server is running and properly configured.';
  }
};

/**
 * Get troubleshooting steps based on error type
 */
export const getConnectionTroubleshootingSteps = (errorType?: string): string[] => {
  const commonSteps = [
    'Ensure the backend server is running',
    'Check your network connection',
    'Verify the VITE_BACKEND_URL environment variable is set correctly'
  ];
  
  switch (errorType) {
    case 'timeout':
      return [
        ...commonSteps,
        'The server might be overloaded - try again later',
        'Check if your firewall is blocking the connection'
      ];
    case 'network':
      return [
        ...commonSteps,
        'Check if the backend is running on the expected port',
        'Make sure there are no firewall or network restrictions'
      ];
    case 'server':
      return [
        ...commonSteps,
        'Check the backend server logs for errors',
        'Verify the backend server configuration'
      ];
    default:
      return commonSteps;
  }
};
