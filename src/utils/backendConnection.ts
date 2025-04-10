
/**
 * Utility functions for checking backend proxy agent connectivity
 */

/**
 * Check if the backend proxy agent is connected and responding
 * @returns Promise resolving to connection status
 */
export const checkBackendConnection = async (): Promise<{ connected: boolean; message: string }> => {
  try {
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      return { 
        connected: true, 
        message: `Backend connected (${new Date(data.timestamp).toLocaleTimeString()})` 
      };
    }
    
    return { connected: false, message: 'Backend not responding' };
  } catch (error) {
    console.error('Error checking backend connection:', error);
    return { 
      connected: false, 
      message: error instanceof Error ? error.message : 'Connection failed' 
    };
  }
};
