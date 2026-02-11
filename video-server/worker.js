/**
 * HLS Transcoding Worker Service
 * This runs as a separate service to handle video transcoding
 * 
 * Deploy this to Railway or similar platform with:
 * - No timeout limits
 * - 5+ GB disk space
 * - 2+ GB RAM
 */

import dotenv from 'dotenv';
import { Storage } from '@google-cloud/storage';
import HLSTranscoder from './services/hlsTranscoder.js';
import { createClient } from 'redis';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

// Colors for logging
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  const timestamp = new Date().toISOString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Initialize GCS
let bucket = null;
let transcoder = null;

async function initializeGCS() {
  try {
    if (!process.env.GCS_BUCKET_NAME || !process.env.GCS_PROJECT_ID || !process.env.GCS_CREDENTIALS) {
      throw new Error('Missing GCS configuration');
    }

    let credentials = JSON.parse(process.env.GCS_CREDENTIALS);
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    const storage = new Storage({
      projectId: process.env.GCS_PROJECT_ID,
      credentials: credentials
    });
    
    bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
    transcoder = new HLSTranscoder(bucket);
    
    success('GCS initialized successfully');
    return true;
  } catch (err) {
    error(`Failed to initialize GCS: ${err.message}`);
    return false;
  }
}

// Initialize Redis
let redisClient = null;

async function initializeRedis() {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            error('Redis reconnection failed after 10 attempts');
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    redisClient.on('error', (err) => {
      error(`Redis error: ${err.message}`);
    });

    redisClient.on('connect', () => {
      info('Redis connected');
    });

    redisClient.on('reconnecting', () => {
      warning('Redis reconnecting...');
    });

    await redisClient.connect();
    success('Redis initialized successfully');
    return true;
  } catch (err) {
    error(`Failed to initialize Redis: ${err.message}`);
    return false;
  }
}

// Process transcoding job
async function processTranscodeJob(job) {
  const { videoId, gcsPath, userId } = job;
  const sessionId = crypto.randomUUID();
  
  info(`Starting transcode job for video: ${videoId}`);
  info(`GCS Path: ${gcsPath}`);
  info(`Session ID: ${sessionId}`);

  let tempInputPath = null;

  try {
    // Update job status to processing
    await updateJobStatus(videoId, 'processing', { sessionId });

    // Download video from GCS
    info(`Downloading video from GCS...`);
    const file = bucket.file(gcsPath);
    const [exists] = await file.exists();

    if (!exists) {
      throw new Error(`Video file not found in GCS: ${gcsPath}`);
    }

    // Create temp directory
    const tempDir = '/app/temp/transcode';
    await import('fs').then(fs => fs.promises.mkdir(tempDir, { recursive: true }));

    // Download file
    const path = await import('path');
    tempInputPath = path.join(tempDir, `${videoId}_input${path.extname(gcsPath)}`);
    await file.download({ destination: tempInputPath });
    success(`Video downloaded to: ${tempInputPath}`);

    // Update progress
    await updateJobStatus(videoId, 'processing', { 
      sessionId, 
      progress: 10,
      message: 'Video downloaded, starting transcoding...'
    });

    // Transcode to HLS
    info(`Starting HLS transcoding...`);
    const transcodeResult = await transcoder.transcodeToHLS(tempInputPath, sessionId, {
      resolutions: [
        { name: '360p', width: 640, height: 360, bitrate: '800k' },
        { name: '720p', width: 1280, height: 720, bitrate: '2500k' }
      ],
      segmentDuration: 6,
      encrypt: true
    });

    success(`Transcoding completed!`);

    // Update progress
    await updateJobStatus(videoId, 'processing', { 
      sessionId, 
      progress: 70,
      message: 'Transcoding complete, uploading to GCS...'
    });

    // Upload HLS files to GCS
    info(`Uploading HLS files to GCS...`);
    const uploadResult = await transcoder.uploadToGCS(
      sessionId,
      transcodeResult.outputDir,
      videoId
    );

    success(`Upload completed! HLS Path: ${uploadResult.masterPlaylistUrl}`);

    // Update progress
    await updateJobStatus(videoId, 'processing', { 
      sessionId, 
      progress: 90,
      message: 'Upload complete, cleaning up...'
    });

    // Cleanup temp files
    await transcoder.cleanup(sessionId);
    if (tempInputPath) {
      await import('fs').then(fs => fs.promises.unlink(tempInputPath).catch(() => {}));
    }

    success(`Cleanup completed`);

    // Mark job as completed
    await updateJobStatus(videoId, 'completed', {
      hlsPath: uploadResult.masterPlaylistUrl,
      segmentCount: uploadResult.segmentCount,
      resolutions: transcodeResult.resolutions,
      encrypted: true,
      completedAt: new Date().toISOString()
    });

    success(`✅ Job completed successfully for video: ${videoId}`);
    return true;

  } catch (err) {
    error(`Job failed for video ${videoId}: ${err.message}`);
    console.error(err);

    // Cleanup on error
    if (sessionId) {
      await transcoder.cleanup(sessionId).catch(() => {});
    }
    if (tempInputPath) {
      await import('fs').then(fs => fs.promises.unlink(tempInputPath).catch(() => {}));
    }

    // Mark job as failed
    await updateJobStatus(videoId, 'failed', {
      error: err.message,
      failedAt: new Date().toISOString()
    });

    return false;
  }
}

// Update job status in Redis
async function updateJobStatus(videoId, status, data = {}) {
  try {
    const jobKey = `transcode:${videoId}`;
    const jobData = {
      videoId,
      status,
      updatedAt: new Date().toISOString(),
      ...data
    };

    await redisClient.set(jobKey, JSON.stringify(jobData), {
      EX: 86400 // Expire after 24 hours
    });

    info(`Job status updated: ${videoId} -> ${status}`);
  } catch (err) {
    error(`Failed to update job status: ${err.message}`);
  }
}

// Worker main loop
async function startWorker() {
  log('\n╔════════════════════════════════════════╗', 'cyan');
  log('║   HLS Transcoding Worker Service      ║', 'cyan');
  log('╚════════════════════════════════════════╝\n', 'cyan');

  // Initialize services
  const gcsReady = await initializeGCS();
  const redisReady = await initializeRedis();

  if (!gcsReady || !redisReady) {
    error('Failed to initialize services. Exiting...');
    process.exit(1);
  }

  success('Worker initialized successfully');
  info('Waiting for transcode jobs...\n');

  // Listen for jobs
  while (true) {
    try {
      // Block and wait for job (BRPOP with 5 second timeout)
      const result = await redisClient.brPop('transcode:queue', 5);

      if (result) {
        const job = JSON.parse(result.element);
        info(`\n📥 Received transcode job: ${job.videoId}`);
        
        await processTranscodeJob(job);
        
        info(`\n⏳ Waiting for next job...\n`);
      }
    } catch (err) {
      error(`Worker error: ${err.message}`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  warning('Received SIGTERM, shutting down gracefully...');
  
  if (redisClient) {
    await redisClient.quit();
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  warning('Received SIGINT, shutting down gracefully...');
  
  if (redisClient) {
    await redisClient.quit();
  }
  
  process.exit(0);
});

// Start the worker
startWorker().catch((err) => {
  error(`Worker failed to start: ${err.message}`);
  console.error(err);
  process.exit(1);
});
