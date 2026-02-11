import { createClient } from 'redis';

let redisClient = null;

// Initialize Redis client
async function getRedisClient() {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  redisClient = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          return new Error('Max reconnection attempts reached');
        }
        return Math.min(retries * 100, 3000);
      }
    }
  });

  redisClient.on('error', (err) => {
    console.error('Redis error:', err);
  });

  await redisClient.connect();
  return redisClient;
}

/**
 * Queue a video for HLS transcoding
 */
export async function queueTranscode(req, res) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const { getAuth } = await import('firebase-admin/auth');
    const decodedToken = await getAuth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const { videoId, gcsPath } = req.body;

    if (!videoId || !gcsPath) {
      return res.status(400).json({ error: 'Video ID and GCS path required' });
    }

    console.log(`Queueing transcode job for video: ${videoId}`);

    // Get Redis client
    const redis = await getRedisClient();

    // Create job
    const job = {
      videoId,
      gcsPath,
      userId,
      queuedAt: new Date().toISOString()
    };

    // Add to queue
    await redis.lPush('transcode:queue', JSON.stringify(job));

    // Set initial status
    const jobKey = `transcode:${videoId}`;
    await redis.set(jobKey, JSON.stringify({
      videoId,
      status: 'queued',
      queuedAt: job.queuedAt
    }), {
      EX: 86400 // Expire after 24 hours
    });

    console.log(`✅ Job queued successfully: ${videoId}`);

    res.json({
      success: true,
      videoId,
      status: 'queued',
      message: 'Video queued for transcoding. Check status endpoint for progress.'
    });

  } catch (error) {
    console.error('Queue transcode error:', error);
    res.status(500).json({ 
      error: 'Failed to queue transcode job',
      details: error.message 
    });
  }
}

/**
 * Get transcode job status
 */
export async function getTranscodeStatus(req, res) {
  try {
    const { videoId } = req.params;

    if (!videoId) {
      return res.status(400).json({ error: 'Video ID required' });
    }

    // Get Redis client
    const redis = await getRedisClient();

    // Get job status
    const jobKey = `transcode:${videoId}`;
    const jobData = await redis.get(jobKey);

    if (!jobData) {
      return res.status(404).json({ 
        error: 'Job not found',
        videoId 
      });
    }

    const job = JSON.parse(jobData);

    res.json({
      success: true,
      ...job
    });

  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ 
      error: 'Failed to get job status',
      details: error.message 
    });
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(req, res) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get Redis client
    const redis = await getRedisClient();

    // Get queue length
    const queueLength = await redis.lLen('transcode:queue');

    // Get all job keys
    const keys = await redis.keys('transcode:*');
    const jobKeys = keys.filter(key => !key.includes(':queue'));

    // Get job statuses
    const jobs = await Promise.all(
      jobKeys.map(async (key) => {
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
      })
    );

    const validJobs = jobs.filter(job => job !== null);

    // Count by status
    const statusCounts = validJobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      queueLength,
      totalJobs: validJobs.length,
      statusCounts,
      recentJobs: validJobs.slice(0, 10) // Last 10 jobs
    });

  } catch (error) {
    console.error('Get queue stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get queue stats',
      details: error.message 
    });
  }
}

export default {
  queueTranscode,
  getTranscodeStatus,
  getQueueStats
};
