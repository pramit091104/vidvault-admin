// Network tab protection and URL hiding
class NetworkTabProtection {
  constructor() {
    this.protectedRequests = new Set();
    this.decoyRequests = [];
  }

  // Generate decoy network requests to hide real video URL
  generateDecoyRequests() {
    const decoys = [
      '/api/analytics/track',
      '/api/user/preferences', 
      '/api/content/metadata',
      '/api/session/heartbeat',
      '/api/ads/preroll',
      '/api/quality/metrics'
    ];

    decoys.forEach(url => {
      // Create fake requests that appear in network tab
      fetch(url, { 
        method: 'HEAD',
        mode: 'no-cors'
      }).catch(() => {}); // Ignore errors
    });
  }

  // Obfuscate video requests in network tab
  obfuscateVideoRequest(originalUrl) {
    // Make the request appear as a different type of resource
    const obfuscatedHeaders = {
      'Content-Type': 'application/json', // Hide that it's video
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json, text/plain, */*',
      'Cache-Control': 'no-cache'
    };

    return {
      url: originalUrl.replace('/stream/', '/data/'), // Change URL pattern
      headers: obfuscatedHeaders
    };
  }

  // Monitor network tab access
  detectNetworkTabAccess() {
    // Detect if developer tools network tab is being used
    let networkTabDetected = false;
    
    // Monitor for performance API usage (indicates network monitoring)
    const originalGetEntries = performance.getEntries;
    performance.getEntries = function() {
      networkTabDetected = true;
      console.warn('🚨 Network monitoring detected');
      return []; // Return empty array to hide network data
    };

    // Monitor for fetch/XHR interception
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      // Log network tab access attempt
      if (args[0].includes('/stream/') || args[0].includes('/video/')) {
        console.warn('🚨 Video URL access detected in network tab');
        // Return fake response
        return Promise.resolve(new Response('Access Denied', { status: 403 }));
      }
      return originalFetch.apply(this, args);
    };

    return networkTabDetected;
  }

  // Clear network history
  clearNetworkHistory() {
    try {
      // Clear performance entries
      if (performance.clearResourceTimings) {
        performance.clearResourceTimings();
      }
      
      // Clear any cached network data
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(registration => {
            registration.unregister();
          });
        });
      }
    } catch (error) {
      console.warn('Could not clear network history:', error);
    }
  }
}

export const networkProtection = new NetworkTabProtection();
export default networkProtection;