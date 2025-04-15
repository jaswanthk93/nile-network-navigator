
/**
 * Utility functions for consistent site selection across the application
 */

/**
 * Gets the currently selected site ID using consistent precedence rules
 * Priority: URL param > session storage > null (no default)
 * @returns {string | null} The selected site ID or null if none is found
 */
export function getSelectedSiteId(
  urlParams: URLSearchParams | null = null, 
  checkSessionStorage: boolean = true
): string | null {
  // 1. Try from URL parameters if provided
  if (urlParams) {
    const siteIdFromUrl = urlParams.get('site');
    if (siteIdFromUrl) {
      // Save to session storage for consistency
      sessionStorage.setItem('selectedSiteId', siteIdFromUrl);
      return siteIdFromUrl;
    }
  }
  
  // 2. Try from session storage if allowed
  if (checkSessionStorage) {
    const storedSiteId = sessionStorage.getItem('selectedSiteId');
    if (storedSiteId) {
      return storedSiteId;
    }
  }
  
  // 3. No site ID found
  return null;
}

/**
 * Sets the current site ID in session storage and returns it
 * @param {string} siteId The site ID to set
 * @returns {string} The same site ID (for chaining)
 */
export function setSelectedSiteId(siteId: string): string {
  if (siteId) {
    sessionStorage.setItem('selectedSiteId', siteId);
  }
  return siteId;
}

/**
 * Clears the currently selected site ID from session storage
 */
export function clearSelectedSiteId(): void {
  sessionStorage.removeItem('selectedSiteId');
}
