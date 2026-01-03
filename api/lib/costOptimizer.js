/**
 * Cost Optimization Utilities
 * Provides monitoring and optimization helpers for reducing database costs
 */

// Request-level cache to prevent duplicate reads within the same request
const requestCache = new Map();

/**
 * Get or set data in request cache
 */
export function getRequestCache(key) {
  return requestCache.get(key);
}

export function setRequestCache(key, data) {
  requestCache.set(key, data);
}

export function clearRequestCache() {
  requestCache.clear();
}

/**
 * Batch write operations to reduce transaction costs
 */
export class BatchWriter {
  constructor(db) {
    this.db = db;
    this.batch = db.batch();
    this.operations = 0;
    this.maxOperations = 500; // Firestore batch limit
  }

  set(docRef, data) {
    if (this.operations >= this.maxOperations) {
      throw new Error('Batch size limit exceeded. Commit current batch first.');
    }
    this.batch.set(docRef, data);
    this.operations++;
  }

  update(docRef, data) {
    if (this.operations >= this.maxOperations) {
      throw new Error('Batch size limit exceeded. Commit current batch first.');
    }
    this.batch.update(docRef, data);
    this.operations++;
  }

  delete(docRef) {
    if (this.operations >= this.maxOperations) {
      throw new Error('Batch size limit exceeded. Commit current batch first.');
    }
    this.batch.delete(docRef);
    this.operations++;
  }

  async commit() {
    if (this.operations === 0) {
      return null;
    }
    const result = await this.batch.commit();
    this.operations = 0;
    this.batch = this.db.batch();
    return result;
  }

  getOperationCount() {
    return this.operations;
  }
}

/**
 * Cost monitoring middleware
 */
export function createCostMonitor() {
  const stats = {
    firestoreReads: 0,
    firestoreWrites: 0,
    gcsApiCalls: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  return {
    incrementReads: (count = 1) => stats.firestoreReads += count,
    incrementWrites: (count = 1) => stats.firestoreWrites += count,
    incrementGcsApiCalls: (count = 1) => stats.gcsApiCalls += count,
    incrementCacheHits: (count = 1) => stats.cacheHits += count,
    incrementCacheMisses: (count = 1) => stats.cacheMisses += count,
    getStats: () => ({ ...stats }),
    reset: () => {
      stats.firestoreReads = 0;
      stats.firestoreWrites = 0;
      stats.gcsApiCalls = 0;
      stats.cacheHits = 0;
      stats.cacheMisses = 0;
    }
  };
}

/**
 * Optimized query builder that uses indexes efficiently
 */
export class OptimizedQuery {
  constructor(collection) {
    this.collection = collection;
    this.query = collection;
  }

  where(field, operator, value) {
    this.query = this.query.where(field, operator, value);
    return this;
  }

  orderBy(field, direction = 'asc') {
    this.query = this.query.orderBy(field, direction);
    return this;
  }

  limit(count) {
    this.query = this.query.limit(count);
    return this;
  }

  // Use startAfter for pagination instead of offset (more efficient)
  startAfter(doc) {
    this.query = this.query.startAfter(doc);
    return this;
  }

  async get() {
    return await this.query.get();
  }
}

/**
 * Utility to estimate query costs
 */
export function estimateQueryCost(querySnapshot) {
  const readCount = querySnapshot.size;
  const estimatedCost = readCount * 0.00036; // $0.36 per 100K reads
  
  return {
    reads: readCount,
    estimatedCostUSD: estimatedCost,
    recommendation: readCount > 100 ? 'Consider adding pagination or caching' : 'Query cost is optimal'
  };
}