// Frontend subscription caching to reduce API calls
interface CachedSubscription {
  data: any;
  timestamp: number;
  userId: string;
}

const CACHE_KEY = 'subscription_cache';
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes for frontend cache

/**
 * Get cached subscription data from localStorage
 */
export function getCachedSubscription(userId: string): any | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsedCache: CachedSubscription = JSON.parse(cached);
    
    // Check if cache is for the same user and still valid
    if (parsedCache.userId === userId && 
        Date.now() - parsedCache.timestamp < CACHE_TTL) {
      return parsedCache.data;
    }
    
    // Cache expired or for different user
    localStorage.removeItem(CACHE_KEY);
    return null;
  } catch (error) {
    console.error('Error reading subscription cache:', error);
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

/**
 * Cache subscription data in localStorage
 */
export function setCachedSubscription(userId: string, data: any): void {
  try {
    const cacheData: CachedSubscription = {
      data,
      timestamp: Date.now(),
      userId
    };
    
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error caching subscription data:', error);
    // If localStorage is full or unavailable, continue without caching
  }
}

/**
 * Clear cached subscription data
 */
export function clearCachedSubscription(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.error('Error clearing subscription cache:', error);
  }
}

/**
 * Check if we have valid cached data for a user
 */
export function hasCachedSubscription(userId: string): boolean {
  return getCachedSubscription(userId) !== null;
}