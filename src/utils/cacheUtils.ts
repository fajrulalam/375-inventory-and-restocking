// Cache utility for storing data with automatic expiry at midnight Jakarta time

export interface CacheItem<T> {
  data: T;
  expiry: number; // Timestamp when the cache expires
}

// Cache storage key prefix for localStorage
const CACHE_PREFIX = 'app_cache_';

/**
 * Get the timestamp for the next midnight in Jakarta time (GMT+7)
 * @returns Timestamp for midnight in Jakarta time
 */
export const getNextMidnightJakarta = (): number => {
  const now = new Date();
  // Create a date object for Jakarta time (UTC+7)
  const jakartaDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  
  // Set to next midnight
  jakartaDate.setHours(24, 0, 0, 0);
  
  // Convert back to timestamp in local time
  return jakartaDate.getTime();
};

/**
 * Check if a cache key exists and is still valid
 * @param key Cache key
 * @returns Boolean indicating if cache is valid
 */
export const isCacheValid = (key: string): boolean => {
  try {
    const cacheItemStr = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!cacheItemStr) return false;
    
    const cacheItem = JSON.parse(cacheItemStr) as CacheItem<unknown>;
    const now = Date.now();
    return now < cacheItem.expiry;
  } catch (error) {
    console.error('Error checking cache validity:', error);
    return false;
  }
};

/**
 * Set data in cache with expiry at next midnight Jakarta time
 * @param key Cache key
 * @param data Data to cache
 */
export const setCache = <T>(key: string, data: T): void => {
  try {
    const expiry = getNextMidnightJakarta();
    const cacheItem: CacheItem<T> = { data, expiry };
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(cacheItem));
    console.log(`Cache set for ${key}, expires at ${new Date(expiry).toLocaleString()}`);
  } catch (error) {
    console.error('Error setting cache:', error);
  }
};

/**
 * Get data from cache if valid, otherwise return null
 * @param key Cache key
 * @returns Cached data or null if invalid/expired
 */
export const getCache = <T>(key: string): T | null => {
  try {
    if (isCacheValid(key)) {
      const cacheItemStr = localStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!cacheItemStr) return null;
      
      const cacheItem = JSON.parse(cacheItemStr) as CacheItem<T>;
      console.log(`Using cached data for ${key}`);
      return cacheItem.data;
    }
    return null;
  } catch (error) {
    console.error('Error getting cache:', error);
    return null;
  }
};

/**
 * Clear a specific cache entry
 * @param key Cache key
 */
export const clearCache = (key: string): void => {
  try {
    localStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

/**
 * Clear all cache entries with our prefix
 */
export const clearAllCache = (): void => {
  try {
    const keysToRemove: string[] = [];
    
    // Find all localStorage keys with our prefix
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    
    // Remove them
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`Cleared ${keysToRemove.length} cache entries`);
  } catch (error) {
    console.error('Error clearing all cache:', error);
  }
};
