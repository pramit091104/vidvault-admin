import crypto from 'crypto';
import NodeCache from 'node-cache';

// In-memory cache for request deduplication
const requestCache = new NodeCache({ 
  stdTTL: 300, // 5 minutes TTL
  checkperiod: 60 // Check for expired keys every minute
});

// Redis client (optional)
let redisClient = null;

// Initialize Redis if available
try {
  if (process.env.REDIS_URL) {
    const { Redis } = await import('ioredis');
    redisClient = new Redis(process.env.REDIS_URL);
    console.log('✅ Redis connected for request deduplication');
  }
} catch (error) {
  console.warn('⚠️ Redis not available for deduplication, using in-memory cache:', error.message);
}

// Generate request fingerprint
function generateRequestFingerprint(req) {
  const { method, url, body, headers } = req;
  
  // Include relevant headers and body for fingerprinting
  const fingerprintData = {
    method,
    url,
    body: method === 'POST' || method === 'PUT' ? body : undefined,
    userAgent: headers['user-agent'],
    contentType: headers['content-type'],
    authorization: headers['authorization'] ? 'present' : 'absent', // Don't include actual token
    ip: req.ip
  };
  
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(fingerprintData))
    .digest('hex');
}

// Check if request is duplicate
async function isDuplicateRequest(fingerprint) {
  try {
    // Check Redis first
    if (redisClient) {
      try {
        const exists = await redisClient.exists(`req:${fingerprint}`);
        return exists === 1;
      } catch (redisError) {
        console.warn('Redis deduplication check failed:', redisError.message);
      }
    }
    
    // Fallback to in-memory cache
    return requestCache.has(fingerprint);
  } catch (error) {
    console.error('Duplicate request check error:', error);
    return false; // If we can't check, allow the request
  }
}

// Mark request as processed
async function markRequestProcessed(fingerprint, ttl = 300) {
  try {
    // Store in Redis
    if (redisClient) {
      try {
        await redisClient.setex(`req:${fingerprint}`, ttl, '1');
        return;
      } catch (redisError) {
        console.warn('Redis request marking failed:', redisError.message);
      }
    }
    
    // Fallback to in-memory cache
    requestCache.set(fingerprint, true, ttl);
  } catch (error) {
    console.error('Request marking error:', error);
  }
}

// Request deduplication middleware
export const requestDeduplication = (options = {}) => {
  const {
    ttl = 300, // 5 minutes
    skipMethods = ['GET', 'HEAD', 'OPTIONS'],
    skipPaths = ['/health', '/api/health'],
    keyGenerator = generateRequestFingerprint
  } = options;

  return async (req, res, next) => {
    try {
      // Skip deduplication for certain methods and paths
      if (skipMethods.includes(req.method) || skipPaths.includes(req.path)) {
        return next();
      }

      // Generate request fingerprint
      const fingerprint = keyGenerator(req);
      
      // Check if this is a duplicate request
      const isDuplicate = await isDuplicateRequest(fingerprint);
      
      if (isDuplicate) {
        return res.status(429).json({
          error: 'Duplicate request detected',
          message: 'This request was already processed recently. Please wait before retrying.',
          retryAfter: ttl
        });
      }

      // Mark request as being processed
      await markRequestProcessed(fingerprint, ttl);
      
      // Add fingerprint to request for potential cleanup
      req.requestFingerprint = fingerprint;
      
      next();
    } catch (error) {
      console.error('Request deduplication middleware error:', error);
      // If deduplication fails, allow the request to proceed
      next();
    }
  };
};

// Specific deduplication for different operations
export const uploadDeduplication = requestDeduplication({
  ttl: 600, // 10 minutes for uploads
  skipMethods: ['GET', 'HEAD', 'OPTIONS']
});

export const paymentDeduplication = requestDeduplication({
  ttl: 1800, // 30 minutes for payments
  skipMethods: ['GET', 'HEAD', 'OPTIONS']
});

export const commentDeduplication = requestDeduplication({
  ttl: 60, // 1 minute for comments
  skipMethods: ['GET', 'HEAD', 'OPTIONS']
});

export default requestDeduplication;