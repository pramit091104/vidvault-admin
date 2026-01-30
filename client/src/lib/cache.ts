type CacheItem<T> = {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
};

export class Cache<T> {
  private cache: Map<string, CacheItem<T>> = new Map();
  private defaultTtl: number;

  constructor(defaultTtl: number = 5 * 60 * 1000) {
    this.defaultTtl = defaultTtl;
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Check if item has expired
    if (Date.now() > item.timestamp + item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  set(key: string, data: T, ttl: number = this.defaultTtl): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}
