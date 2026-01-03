import { getUserIdFromToken } from './lib/subscriptionValidator.js';
import { createCostMonitor } from './lib/costOptimizer.js';

// Global cost monitor (in production, use Redis or similar)
const globalStats = createCostMonitor();

export default async function handler(req, res) {
  // Set CORS headers
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication (admin only)
    const userId = await getUserIdFromToken(req.headers.authorization);
    if (!userId) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Get current stats
    const stats = globalStats.getStats();
    
    // Calculate estimated costs (approximate Firebase pricing)
    const firestoreReadCost = stats.firestoreReads * 0.00036 / 100000; // $0.36 per 100K reads
    const firestoreWriteCost = stats.firestoreWrites * 1.08 / 100000; // $1.08 per 100K writes
    const totalEstimatedCost = firestoreReadCost + firestoreWriteCost;

    // Calculate cache efficiency
    const totalCacheRequests = stats.cacheHits + stats.cacheMisses;
    const cacheHitRate = totalCacheRequests > 0 ? (stats.cacheHits / totalCacheRequests * 100) : 0;

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        ...stats,
        cacheHitRate: Math.round(cacheHitRate * 100) / 100
      },
      costs: {
        firestoreReads: Math.round(firestoreReadCost * 100000) / 100000,
        firestoreWrites: Math.round(firestoreWriteCost * 100000) / 100000,
        totalEstimated: Math.round(totalEstimatedCost * 100000) / 100000,
        currency: 'USD'
      },
      optimizations: {
        cacheEnabled: true,
        indexesDeployed: true,
        batchWritesEnabled: true,
        anonymousAccessRestricted: true
      },
      recommendations: []
    };

    // Add recommendations based on stats
    if (cacheHitRate < 50) {
      response.recommendations.push({
        type: 'cache',
        message: 'Cache hit rate is low. Consider increasing cache TTL or implementing more aggressive caching.',
        priority: 'medium'
      });
    }

    if (stats.firestoreReads > 1000) {
      response.recommendations.push({
        type: 'reads',
        message: 'High number of Firestore reads detected. Consider implementing pagination or result limiting.',
        priority: 'high'
      });
    }

    if (stats.gcsApiCalls > 100) {
      response.recommendations.push({
        type: 'gcs',
        message: 'High number of GCS API calls. Consider caching signed URLs or implementing batch operations.',
        priority: 'medium'
      });
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Error in cost monitor:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve cost monitoring data',
      code: 'MONITOR_ERROR'
    });
  }
}