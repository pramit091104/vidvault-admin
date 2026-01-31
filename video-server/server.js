import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Storage } from '@google-cloud/storage';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'fs';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { exec } from 'child_process';

// Set FFmpeg path immediately
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
  console.log('✅ FFmpeg static path configured:', ffmpegPath);
} else {
  console.warn('⚠️ FFmpeg static path not found!');
}

// Import critical middleware
import {
  generalLimiter,
  uploadLimiter,
  apiLimiter,
  commentLimiter,
  strictLimiter
} from './middleware/rateLimiter.js';
import sessionManager from './middleware/sessionManager.js';
import {
  requestDeduplication,
  uploadDeduplication,
  paymentDeduplication,
  commentDeduplication
} from './middleware/requestDeduplication.js';
import cacheManager from './middleware/cacheManager.js';
import sseManager from './middleware/sseManager.js';
import { batchManager, OptimizedSubscriptionService } from './middleware/batchOperations.js';
import { PaginationHelper, paginationMiddleware, sendPaginatedResponse } from './middleware/paginationHelper.js';
import { messageQueue, queueEmail, queueNotification } from './middleware/messageQueue.js';
import urlObfuscation from './middleware/urlObfuscation.js';
import networkProtection from './middleware/networkTabProtection.js';
import subscriptionHandler from './api/subscription.js';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const BUCKET_NAME = process.env.GCS_BUCKET_NAME;

// Multer for multipart/form-data (file uploads)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB limit
    fieldSize: 100 * 1024 * 1024 // 100MB for metadata fields
  }
});

// --- Middleware ---
app.use(helmet());
// Allowed origins configuration
const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
  'https://previu.online'
];

// Add environment-specific origins if provided
if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS.split(',').forEach(origin => {
    if (origin.trim()) ALLOWED_ORIGINS.push(origin.trim());
  });
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`Blocked CORS request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length', 'X-Requested-With', 'Accept']
}));

// Apply rate limiting BEFORE other middleware
app.use('/api/', generalLimiter);
app.use('/api/upload', uploadLimiter);
app.use('/api/gcs/upload', uploadLimiter);
app.use('/api/gcs/init-chunked-upload', uploadLimiter);
app.use('/api/gcs/upload-chunk', uploadLimiter);
app.use('/api/payment', strictLimiter);
app.use('/api/razorpay', strictLimiter);
app.use('/api/notifications/comment', commentLimiter);

// Apply request deduplication
app.use('/api/upload', uploadDeduplication);
app.use('/api/payment', paymentDeduplication);
app.use('/api/notifications/comment', commentDeduplication);
app.use('/api/subscription', strictLimiter); // Apply strict limits to subscription/billing

// Increase body size limits for large file uploads
app.use(express.json({ limit: '2gb' }));
app.use(express.urlencoded({ limit: '2gb', extended: true }));

// --- Initialize Google Cloud Storage ---
let bucket = null;

// Helper to safely parse JSON credentials
const parseCredentials = (content, source) => {
  try {
    return JSON.parse(content);
  } catch (error) {
    console.warn(`⚠️ Failed to parse credentials from ${source}: ${error.message}`);
    return null;
  }
};

const initGCS = () => {
  if (!BUCKET_NAME) {
    console.warn('⚠️ GCS_BUCKET_NAME not set. Storage features will be disabled.');
    return;
  }

  // Try to load credentials from various sources
  let credentials = null;

  // 1. Try Base64 encoded credentials (RAILWAY often uses this)
  if (process.env.GCS_CREDENTIALS_BASE64) {
    try {
      const decoded = Buffer.from(process.env.GCS_CREDENTIALS_BASE64, 'base64').toString('utf-8');
      credentials = parseCredentials(decoded, 'GCS_CREDENTIALS_BASE64');
    } catch (e) {
      console.warn('⚠️ Failed to decode GCS_CREDENTIALS_BASE64:', e.message);
    }
  }

  // 2. Try direct JSON string
  if (!credentials && process.env.GCS_CREDENTIALS) {
    credentials = parseCredentials(process.env.GCS_CREDENTIALS, 'GCS_CREDENTIALS');
  }

  // 3. Try File Path (useful for local dev or volume mounts)
  if (!credentials && process.env.GCS_KEY_FILE) {
    if (fs.existsSync(process.env.GCS_KEY_FILE)) {
      try {
        const keyFileContent = fs.readFileSync(process.env.GCS_KEY_FILE, 'utf8');
        credentials = parseCredentials(keyFileContent, 'GCS_KEY_FILE');
      } catch (e) {
        console.warn('⚠️ Failed to read GCS_KEY_FILE:', e.message);
      }
    } else {
      console.warn(`⚠️ GCS_KEY_FILE defined but file not found at: ${process.env.GCS_KEY_FILE}`);
    }
  }

  // Fix for private_key newlines if they are escaped as literal '\n' strings
  if (credentials && credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }

  const projectId = process.env.GCS_PROJECT_ID || (credentials && credentials.project_id);

  if (credentials && projectId) {
    try {
      console.log('🔑 Credential Check:');
      console.log('   - project_id:', credentials.project_id);
      console.log('   - client_email:', credentials.client_email);

      const storage = new Storage({ projectId, credentials });
      bucket = storage.bucket(BUCKET_NAME);
      console.log('✅ Google Cloud Storage initialized');

      // Optionally auto-configure CORS on startup
      if (process.env.AUTO_CONFIGURE_GCS_CORS === 'true') {
        (async () => {
          try {
            const origins = (process.env.GCS_CORS_ORIGINS || 'https://previu.online,http://localhost:5173,http://localhost:8080')
              .split(',')
              .map(s => s.trim());
            const corsConfig = [
              {
                origin: origins,
                method: ['GET', 'HEAD', 'OPTIONS'],
                responseHeader: ['Content-Type', 'Content-Length', 'Accept-Ranges', 'Range'],
                maxAgeSeconds: 3600,
              },
            ];
            await bucket.setMetadata({ cors: corsConfig });
            console.log('✅ GCS CORS configured for origins:', origins);
          } catch (e) {
            console.warn('⚠️ Failed to auto-configure GCS CORS:', e.message);
          }
        })();
      }
    } catch (error) {
      console.warn('❌ Failed to initialize GCS client:', error.message);
    }
  } else {
    console.warn('⚠️ GCS credentials or Project ID missing. Storage features disabled.');
  }
};

// Run initialization
initGCS();

// --- Real-time Upload Progress Endpoints ---

// SSE endpoint for upload progress
app.get('/api/gcs/upload-progress/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  sseManager.addUploadConnection(sessionId, res, req);
});

// --- Helper Functions ---

// Get video file path from storage
async function getVideoPath(videoId) {
  try {
    // This is a simplified version - in your actual implementation,
    // you'll need to query your database to get the video file path
    // and then download it from GCS or serve it directly

    // For GCS, you might want to stream directly from GCS
    // or download to temp directory first for watermarking

    const tempDir = path.join(__dirname, 'temp');
    await fs.promises.mkdir(tempDir, { recursive: true });

    // Example: Download from GCS to temp file
    if (bucket) {
      const gcsFile = bucket.file(`uploads/${videoId}`);
      const [exists] = await gcsFile.exists();

      if (exists) {
        const tempPath = path.join(tempDir, `${videoId}_temp.mp4`);
        await gcsFile.download({ destination: tempPath });
        return tempPath;
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting video path:', error);
    return null;
  }
}

// --- Protected Content Endpoints ---

// Generate stream-only URL (no downloads allowed) with URL obfuscation
app.post('/api/stream-only/generate', apiLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const { getAuth } = await import('firebase-admin/auth');
    const decodedToken = await getAuth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const { videoId, quality = 'standard' } = req.body; // Same quality for all

    if (!videoId) {
      return res.status(400).json({ error: 'Video ID required' });
    }

    // Generate obfuscated URL that hides the real video URL from network tab
    const obfuscatedData = urlObfuscation.generateObfuscatedUrl(videoId, userId);

    res.json({
      success: true,
      streamUrl: `${req.protocol}://${req.get('host')}${obfuscatedData.obfuscatedUrl}`,
      expiresAt: new Date(obfuscatedData.expiresAt).toISOString(),
      downloadAllowed: false, // Always false for everyone
      quality: 'standard', // Same for all users
      sessionId: obfuscatedData.sessionId
    });

  } catch (error) {
    console.error('Stream URL generation error:', error);
    res.status(500).json({ error: 'Failed to generate stream URL' });
  }
});

// Serve obfuscated stream content (replaces the old stream-only endpoint)
app.get('/api/media/stream/:a/:b/:c/:d/:e/:t/:f/:signature', async (req, res) => {
  try {
    const path = req.path;

    // Decode obfuscated URL
    const decodedData = urlObfuscation.decodeObfuscatedUrl(path);

    if (!decodedData || !decodedData.isValid) {
      return res.status(403).json({ error: 'Invalid or expired stream URL' });
    }

    const { videoId } = decodedData;

    // Import download prevention
    const { downloadPrevention } = await import('./middleware/downloadPrevention.js');

    // Validate stream request and detect download attempts
    const validation = await downloadPrevention.validateStreamRequest(req, res, videoId);

    if (!validation.valid) {
      return res.status(403).json({ error: validation.error });
    }

    // Get video file path
    const videoPath = await getVideoPath(videoId);

    if (!videoPath) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Apply network tab protection
    networkProtection.generateDecoyRequests();

    // Serve with download prevention and network tab obfuscation
    await downloadPrevention.serveProtectedVideo(
      req,
      res,
      videoPath,
      validation.session,
      validation.forceWatermark
    );

  } catch (error) {
    console.error('Obfuscated stream serving error:', error);
    res.status(500).json({ error: 'Stream serving failed' });
  }
});

// Log download attempts
app.post('/api/log-download-attempt', apiLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { videoId, timestamp, userAgent } = req.body;

    console.warn('🚨 DOWNLOAD ATTEMPT LOGGED:', {
      videoId,
      timestamp,
      userAgent: userAgent?.substring(0, 100),
      ip: req.ip,
      referer: req.get('Referer')
    });

    // In production, store in database for analytics and security monitoring

    res.json({ success: true, logged: true });
  } catch (error) {
    console.error('Download attempt logging error:', error);
    res.status(500).json({ error: 'Logging failed' });
  }
});

// Log developer tools attempts
app.post('/api/log-devtools-attempt', apiLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { videoId, timestamp } = req.body;

    console.warn('🔧 DEVELOPER TOOLS DETECTED:', {
      videoId,
      timestamp,
      ip: req.ip,
      userAgent: req.get('User-Agent')?.substring(0, 100)
    });

    res.json({ success: true, logged: true });
  } catch (error) {
    console.error('DevTools attempt logging error:', error);
    res.status(500).json({ error: 'Logging failed' });
  }
});

// Generate protected URL for content access
app.post('/api/protected/generate-url', apiLimiter, async (req, res) => {
  try {
    // Get user ID from token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const { getAuth } = await import('firebase-admin/auth');
    const decodedToken = await getAuth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const { videoId, permissions = {} } = req.body;

    if (!videoId) {
      return res.status(400).json({ error: 'Video ID required' });
    }

    // Import content protection
    const { contentProtection } = await import('./middleware/contentProtection.js');

    // Add IP restriction for additional security
    permissions.restrictToIp = req.ip;
    permissions.allowedReferrers = ['localhost', 'previu.online'];

    const protectedUrl = contentProtection.generateProtectedUrl(videoId, userId, permissions);

    res.json({
      success: true,
      protectedUrl: `${req.protocol}://${req.get('host')}${protectedUrl}`,
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      permissions
    });

  } catch (error) {
    console.error('Protected URL generation error:', error);
    res.status(500).json({ error: 'Failed to generate protected URL' });
  }
});

// Serve protected content
app.get('/api/protected/stream/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { contentProtection } = await import('./middleware/contentProtection.js');

    await contentProtection.serveProtectedContent(req, res, videoId);
  } catch (error) {
    console.error('Protected content serving error:', error);
    res.status(500).json({ error: 'Content serving failed' });
  }
});

// Log protection violations
app.post('/api/protected/log-violation', apiLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { videoId, violationType, timestamp, userAgent } = req.body;

    // Log violation (in production, store in database)
    console.warn('🚨 Content Protection Violation:', {
      videoId,
      violationType,
      timestamp,
      userAgent: userAgent?.substring(0, 100), // Truncate for security
      ip: req.ip,
      referer: req.get('Referer')
    });

    // Could store in database for analytics
    // await logViolationToDatabase({ videoId, violationType, timestamp, ip: req.ip });

    res.json({ success: true, logged: true });
  } catch (error) {
    console.error('Violation logging error:', error);
    res.status(500).json({ error: 'Logging failed' });
  }
});

// --- Health and Monitoring Endpoints ---

// Health check endpoint (not rate limited)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version
  });
});

// System status endpoint
app.get('/api/system/status', apiLimiter, async (req, res) => {
  try {
    // Helper function to get content protection stats
    async function getContentProtectionStats() {
      try {
        const { contentProtection } = await import('./middleware/contentProtection.js');
        return contentProtection.getStats();
      } catch (error) {
        return { error: 'Content protection not available' };
      }
    }

    // Helper function to get download prevention stats
    async function getDownloadPreventionStats() {
      try {
        const { downloadPrevention } = await import('./middleware/downloadPrevention.js');
        return downloadPrevention.getStats();
      } catch (error) {
        return { error: 'Download prevention not available' };
      }
    }

    const stats = {
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version,
        platform: process.platform
      },
      cache: cacheManager.getStats(),
      sessions: {
        active: (await sessionManager.getAllSessions()).length
      },
      realtime: sseManager.getStats(),
      batching: batchManager.getStats(),
      messageQueue: messageQueue.getStats(),
      contentProtection: await getContentProtectionStats(),
      downloadPrevention: await getDownloadPreventionStats(),
      storage: {
        available: !!bucket,
        bucketName: BUCKET_NAME
      }
    };

    res.json(stats);
  } catch (error) {
    console.error('System status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cache management endpoints
app.post('/api/system/cache/clear', strictLimiter, async (req, res) => {
  try {
    await cacheManager.clearAll();
    res.json({ success: true, message: 'All caches cleared' });
  } catch (error) {
    console.error('Cache clear error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Session management endpoint
app.get('/api/system/sessions', strictLimiter, async (req, res) => {
  try {
    const sessions = await sessionManager.getAllSessions();
    res.json({
      total: sessions.length,
      sessions: sessions.map(s => ({
        sessionId: s.sessionId,
        fileName: s.fileName,
        status: s.status,
        progress: s.uploadedChunks ? Math.round((s.uploadedChunks.length / s.totalChunks) * 100) : 0,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt
      }))
    });
  } catch (error) {
    console.error('Sessions list error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch operations management
app.post('/api/system/batch/flush', strictLimiter, async (req, res) => {
  try {
    await batchManager.flushAll();
    res.json({ success: true, message: 'All pending batches flushed' });
  } catch (error) {
    console.error('Batch flush error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Message queue management
app.get('/api/system/queue/stats', strictLimiter, (req, res) => {
  try {
    const stats = messageQueue.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Queue stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Subscription Management Endpoints
app.use('/api/subscription', subscriptionHandler);

// Test email queue
app.post('/api/system/test-email', strictLimiter, async (req, res) => {
  try {
    const { to, subject = 'Test Email', message = 'This is a test email from the queue system.' } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Email address required' });
    }

    const jobId = await queueEmail(
      to,
      subject,
      `<p>${message}</p>`,
      message
    );

    res.json({
      success: true,
      message: 'Email queued successfully',
      jobId
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Endpoints ---

// Video compression endpoints
app.post('/api/video/analyze', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    // Save uploaded file temporarily
    const tempDir = path.join(__dirname, 'temp');
    await fs.promises.mkdir(tempDir, { recursive: true });

    const tempFilePath = path.join(tempDir, `temp_${Date.now()}_${req.file.originalname}`);
    await fs.promises.writeFile(tempFilePath, req.file.buffer);

    try {
      // Simple analysis without FFmpeg
      const stats = await fs.promises.stat(tempFilePath);
      const size = stats.size;
      const ext = path.extname(req.file.originalname).toLowerCase();

      // Estimate properties based on file size (rough approximations)
      const estimatedDuration = Math.max(30, size / (1024 * 1024)); // Rough estimate
      const estimatedBitrate = (size * 8) / (estimatedDuration * 1000); // kbps

      const analysis = {
        duration: estimatedDuration,
        resolution: { width: 1920, height: 1080 }, // Assume HD
        bitrate: estimatedBitrate,
        codec: ext === '.mp4' ? 'h264' : 'unknown',
        size,
        needsCompression: size > 50 * 1024 * 1024 // Compress if > 50MB
      };

      const recommendations = {
        maxResolution: { width: 1920, height: 1080 },
        maxBitrate: 8000,
        codec: 'libx264',
        quality: 23
      };

      // Cleanup temp file
      await fs.promises.unlink(tempFilePath);

      res.json({
        success: true,
        analysis,
        recommendations
      });
    } catch (analysisError) {
      // Cleanup temp file on error
      try {
        await fs.promises.unlink(tempFilePath);
      } catch { }
      throw analysisError;
    }
  } catch (error) {
    console.error('Video analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check for FFmpeg availability on startup (Updated for static binary)
const checkFFmpeg = () => {
  // Since we are using ffmpeg-static, it is almost certainly "installed".
  // verifying the binary works by running version check.
  if (ffmpegPath) {
    exec(`"${ffmpegPath}" -version`, (error) => {
      if (error) {
        console.warn('⚠️  FFmpeg binary execution failed:', error.message);
      } else {
        console.log('✅ FFmpeg binary verified and ready.');
      }
    });
  } else {
    console.warn('⚠️  ffmpeg-static returned no path. Compression will fail.');
  }
};

// Run check after a short delay to not block startup logs
setTimeout(checkFFmpeg, 2000);

app.post('/api/video/compress', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const { options } = req.body;
    const compressionOptions = options ? JSON.parse(options) : {
      codec: 'libx264',
      quality: 23, // CRF
      preset: 'fast'
    };

    // Save uploaded file temporarily
    const tempDir = path.join(__dirname, 'temp');
    await fs.promises.mkdir(tempDir, { recursive: true });

    const inputPath = path.join(tempDir, `input_${Date.now()}_${req.file.originalname}`);
    await fs.promises.writeFile(inputPath, req.file.buffer);

    const outputFileName = `compressed_${Date.now()}_${req.file.originalname.replace(/\.[^/.]+$/, "")}.mp4`;
    const outputPath = path.join(tempDir, outputFileName);

    try {
      console.log(`Starting compression for: ${req.file.originalname}`);

      // Perform actual compression using fluent-ffmpeg
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .output(outputPath)
          .videoCodec(compressionOptions.codec || 'libx264')
          .audioCodec('aac')
          .outputOptions([
            `-crf ${compressionOptions.quality || 23}`,
            `-preset ${compressionOptions.preset || 'fast'}`,
            '-movflags +faststart' // Optimize for web streaming
          ])
          .on('start', (commandLine) => {
            console.log('Spawned Ffmpeg with command: ' + commandLine);
          })
          .on('end', () => {
            console.log('Compression finished successfully');
            resolve();
          })
          .on('error', (err) => {
            console.error('An error occurred during compression: ' + err.message);
            reject(err);
          })
          .run();
      });

      // Read compressed file
      const compressedBuffer = await fs.promises.readFile(outputPath);
      const originalStats = await fs.promises.stat(inputPath);
      const compressedStats = await fs.promises.stat(outputPath);

      // Cleanup temp files
      await fs.promises.unlink(inputPath);
      await fs.promises.unlink(outputPath);

      // Return compressed file info
      res.json({
        success: true,
        result: {
          success: true,
          outputPath, // Note: file is deleted, this is just for ref
          originalSize: originalStats.size,
          compressedSize: compressedStats.size,
          compressionRatio: (originalStats.size / compressedStats.size).toFixed(2),
          compressedData: compressedBuffer.toString('base64'),
          fileName: outputFileName,
          info: 'Compressed with FFmpeg'
        }
      });
    } catch (compressionError) {
      console.error('Compression Logic Error:', compressionError);

      // Cleanup temp files on error
      try {
        if (fs.existsSync(inputPath)) await fs.promises.unlink(inputPath);
        if (fs.existsSync(outputPath)) await fs.promises.unlink(outputPath);
      } catch (cleanupError) { console.error('Cleanup error:', cleanupError); }

      // Return 500 so client knows it failed, don't fallback silently anymore for explicit compress endpoint?
      // Or fallback? The prompt asked for it to work. Failing explicitly is better for debugging.
      throw new Error('Video compression failed: ' + compressionError.message);
    }
  } catch (error) {
    console.error('Video compression endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/video/compression-status', async (req, res) => {
  try {
    // Create a simple compression service status without external dependencies
    res.json({
      available: true,
      version: 'Fallback mode (FFmpeg not installed)',
      error: 'FFmpeg not available - compression will use fallback mode (copy original file)'
    });
  } catch (error) {
    console.error('Compression status error:', error);
    res.status(500).json({
      available: false,
      error: error.message
    });
  }
});

// --- Chunked Upload Endpoints ---

// Initialize chunked upload session
app.post('/api/gcs/init-chunked-upload', express.json(), async (req, res) => {
  try {
    if (!bucket) return res.status(503).json({ error: 'Storage unavailable' });

    const { fileName, totalSize, chunkSize, metadata } = req.body;

    if (!fileName || !totalSize || !chunkSize) {
      return res.status(400).json({ error: 'Missing required fields: fileName, totalSize, chunkSize' });
    }

    const sessionId = crypto.randomUUID();
    const totalChunks = Math.ceil(totalSize / chunkSize);

    // Store session info using persistent session manager
    const sessionData = {
      sessionId,
      fileName,
      totalSize,
      chunkSize,
      totalChunks,
      uploadedChunks: [],
      metadata: metadata || {},
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    // Use persistent session manager instead of global variable
    await sessionManager.set(sessionId, sessionData);

    res.json({
      sessionId,
      uploadUrl: `/api/gcs/upload-chunk`,
      totalChunks,
      expiresAt: sessionData.expiresAt
    });
  } catch (error) {
    console.error('Error initializing chunked upload:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload individual chunk
app.post('/api/gcs/upload-chunk', upload.single('chunk'), async (req, res) => {
  try {
    if (!bucket) return res.status(503).json({ error: 'Storage unavailable' });

    const { sessionId, chunkId, chunkIndex, chunkSize, checksum } = req.body;
    const chunkData = req.file?.buffer;

    if (!sessionId || !chunkId || chunkIndex === undefined || !chunkData) {
      return res.status(400).json({ error: 'Missing required chunk data' });
    }

    // Get session data from persistent storage
    const session = await sessionManager.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    // Check if session is expired
    if (new Date() > new Date(session.expiresAt)) {
      await sessionManager.delete(sessionId);
      return res.status(410).json({ error: 'Upload session expired' });
    }

    // Validate chunk size
    if (chunkData.length !== parseInt(chunkSize)) {
      return res.status(400).json({ error: 'Chunk size mismatch' });
    }

    // Store chunk temporarily
    const tempDir = path.join(__dirname, 'temp', sessionId);
    await fs.promises.mkdir(tempDir, { recursive: true });

    const chunkFileName = `chunk_${chunkIndex.toString().padStart(6, '0')}`;
    const chunkPath = path.join(tempDir, chunkFileName);

    await fs.promises.writeFile(chunkPath, chunkData);

    // Update session with uploaded chunk
    if (!session.uploadedChunks.includes(chunkId)) {
      session.uploadedChunks.push(chunkId);
    }

    // Store chunk metadata
    session.chunks = session.chunks || {};
    session.chunks[chunkIndex] = {
      chunkId,
      fileName: chunkFileName,
      size: chunkData.length,
      checksum,
      uploadedAt: new Date()
    };

    // Update session in persistent storage
    await sessionManager.set(sessionId, session);

    const progressData = {
      success: true,
      chunkId,
      uploadedChunks: session.uploadedChunks.length,
      totalChunks: session.totalChunks,
      isComplete: session.uploadedChunks.length === session.totalChunks,
      progress: Math.round((session.uploadedChunks.length / session.totalChunks) * 100)
    };

    // Send real-time progress update
    sseManager.updateUploadProgress(sessionId, progressData);

    res.json(progressData);

    // If all chunks uploaded, trigger assembly
    if (session.uploadedChunks.length === session.totalChunks) {
      // Don't wait for assembly, return success immediately
      setImmediate(() => assembleChunks(sessionId));
    }
  } catch (error) {
    console.error('Error uploading chunk:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify uploaded chunks for resumption
app.get('/api/gcs/verify-chunks/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await sessionManager.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    // Check if session is expired
    if (new Date() > new Date(session.expiresAt)) {
      await sessionManager.delete(sessionId);
      return res.status(410).json({ error: 'Upload session expired' });
    }

    res.json({
      sessionId,
      uploadedChunks: session.uploadedChunks,
      totalChunks: session.totalChunks,
      isComplete: session.uploadedChunks.length === session.totalChunks
    });
  } catch (error) {
    console.error('Error verifying chunks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Assemble chunks into final file
async function assembleChunks(sessionId) {
  try {
    const session = await sessionManager.get(sessionId);

    if (!session) {
      console.error('Session not found for assembly:', sessionId);
      return;
    }

    const tempDir = path.join(__dirname, 'temp', sessionId);
    const finalFileName = `uploads/${session.fileName}`;

    // Create write stream to GCS
    const gcsFile = bucket.file(finalFileName);
    const writeStream = gcsFile.createWriteStream({
      metadata: {
        contentType: session.metadata.contentType || 'application/octet-stream',
        metadata: session.metadata
      }
    });

    // Assemble chunks in order
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkInfo = session.chunks[i];
      if (!chunkInfo) {
        throw new Error(`Missing chunk ${i}`);
      }

      const chunkPath = path.join(tempDir, chunkInfo.fileName);
      const chunkData = await fs.promises.readFile(chunkPath);

      writeStream.write(chunkData);
    }

    writeStream.end();

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Clean up temporary files
    await fs.promises.rm(tempDir, { recursive: true, force: true });

    // Update session status
    session.status = 'completed';
    session.gcsPath = finalFileName;
    session.completedAt = new Date();

    await sessionManager.set(sessionId, session);

    console.log(`Successfully assembled file for session ${sessionId}: ${finalFileName}`);

    // Send completion notification
    sseManager.completeUpload(sessionId, {
      status: 'completed',
      gcsPath: finalFileName,
      fileName: session.fileName,
      completedAt: session.completedAt
    });
  } catch (error) {
    console.error('Error assembling chunks:', error);

    // Update session with error
    const session = await sessionManager.get(sessionId);
    if (session) {
      session.status = 'failed';
      session.error = error.message;
      await sessionManager.set(sessionId, session);

      // Send error notification
      sseManager.failUpload(sessionId, {
        status: 'failed',
        error: error.message,
        fileName: session.fileName
      });
    }
  }
}

// Get upload session status
app.get('/api/gcs/upload-status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await sessionManager.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    // Generate signed URL if completed
    let signedUrl = null;
    if (session.status === 'completed' && session.gcsPath) {
      try {
        const gcsFile = bucket.file(session.gcsPath);
        const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
        const [url] = await gcsFile.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: expiresAt,
        });
        signedUrl = url;
      } catch (urlError) {
        console.warn('Could not generate signed URL:', urlError.message);
      }
    }

    res.json({
      sessionId,
      status: session.status || 'uploading',
      uploadedChunks: session.uploadedChunks.length,
      totalChunks: session.totalChunks,
      progress: Math.round((session.uploadedChunks.length / session.totalChunks) * 100),
      fileName: session.fileName,
      gcsPath: session.gcsPath,
      signedUrl,
      error: session.error,
      createdAt: session.createdAt,
      completedAt: session.completedAt
    });
  } catch (error) {
    console.error('Error getting upload status:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Existing Endpoints ---

app.post('/api/signed-url', async (req, res) => {
  try {
    if (!bucket) return res.status(503).json({ error: 'Storage unavailable' });
    const { videoId, service } = req.body;
    console.log('[/api/signed-url] request body:', { videoId, service });

    // Clean up the input ID (remove doubles extensions if present)
    const cleanId = videoId.replace(/\.mp4\.mp4$/, '.mp4');

    // Check cache first
    const cachedUrl = await cacheManager.getSignedUrl(cleanId);
    if (cachedUrl && cachedUrl.expiresAt && new Date(cachedUrl.expiresAt) > new Date()) {
      console.log(`✅ Cache hit for signed URL: ${cleanId}`);
      return res.json(cachedUrl);
    }

    console.log(`\n🔍 Searching for: "${cleanId}"`);

    // SEARCH PATHS
    const potentialPaths = [
      `videos/${cleanId}`,
      `uploads/${cleanId}`,           // <--- Check 'uploads' folder
      cleanId,                        // <--- Check Root (Exact match)
      `${cleanId}.mp4`,               // <--- Check Root + .mp4
      `uploads/${cleanId}.mp4`,       // <--- Check Uploads + .mp4
      `videos/${cleanId}.mp4`
    ];

    let foundFile = null;

    // 1. Try to find the file
    for (const path of potentialPaths) {
      const file = bucket.file(path);
      const [exists] = await file.exists();
      if (exists) {
        foundFile = file;
        console.log(`✅ FOUND at: ${path}`);
        break;
      }
    }

    // 2. IF NOT FOUND: Debugging Help
    if (!foundFile) {
      console.error('⚠️ File not found. Searched paths:', potentialPaths);
      console.error('⚠️ File not found. Listing files in bucket to help debug...');

      // List first 25 files in bucket to see where they actually are
      try {
        const [files] = await bucket.getFiles({ maxResults: 25 });
        console.log('--- ACTUAL BUCKET CONTENT (First 25) ---');
        files.forEach(f => console.log(`- ${f.name}`));
        console.log('----------------------------------------');

        // Try to find similar files (partial matches)
        const similarFiles = files.filter(f =>
          f.name.includes(cleanId.split('_')[0]) || // Match timestamp part
          f.name.includes(cleanId.split('_').slice(1).join('_')) // Match name part
        );

        if (similarFiles.length > 0) {
          console.log('🔍 Found similar files:');
          similarFiles.forEach(f => console.log(`  - ${f.name}`));

          // Return a more helpful error message
          return res.status(404).json({
            error: 'Video not found in storage',
            searchedFor: cleanId,
            searchedPaths: potentialPaths,
            similarFiles: similarFiles.map(f => f.name).slice(0, 5),
            suggestion: 'Check if the video filename in the database matches the actual file in storage'
          });
        }
      } catch (e) {
        console.error('Could not list files:', e.message);
      }

      return res.status(404).json({
        error: 'Video not found in storage',
        searchedFor: cleanId,
        searchedPaths: potentialPaths
      });
    }

    // 3. Generate URL
    const expiresAt = Date.now() + 60 * 60 * 1000;
    const [signedUrl] = await foundFile.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: expiresAt,
    });

    const urlData = {
      signedUrl,
      expiresAt: new Date(expiresAt).toISOString()
    };

    // Cache the signed URL for 5 minutes (much shorter than expiry)
    await cacheManager.setSignedUrl(cleanId, urlData, 300);

    res.json(urlData);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Razorpay Payment Endpoints ---
// Note: Razorpay endpoints are now handled by the payment handler

// Import the new API handlers
import subscriptionHandler from './api/subscription.js';
import clientsValidateHandler from './api/clients/validate.js';
import clientsCreateHandler from './api/clients/create.js';
import uploadHandler from './api/upload.js';
import gcsResumableUploadUrlHandler from './api/gcs/resumable-upload-url.js';
import gcsDeleteHandler from './api/gcs/delete.js';
import commentNotificationHandler from './api/notifications/comment.js';
import paymentHandler from './api/payment.js';

// Add the new API routes
app.use('/api/subscription', subscriptionHandler);
app.get('/api/clients/validate', clientsValidateHandler);
app.post('/api/clients/create', clientsCreateHandler);
app.use('/api/upload', uploadHandler);
app.post('/api/gcs/resumable-upload-url', gcsResumableUploadUrlHandler);
app.delete('/api/gcs/delete', gcsDeleteHandler);
app.post('/api/notifications/comment', commentNotificationHandler);

// Payment routes - use the payment handler for both /api/payment and /api/razorpay routes
app.use('/api/payment', paymentHandler);
app.use('/api/razorpay', paymentHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Debug Server running on http://localhost:${PORT}`);
});

// --- GCS Upload / Delete / Metadata Endpoints ---

app.post('/api/gcs/upload', upload.single('file'), async (req, res) => {
  try {
    if (!bucket) return res.status(503).json({ error: 'Storage unavailable' });

    const fileBuffer = req.file?.buffer;
    const originalName = req.file?.originalname;
    const fileName = req.body.fileName || originalName;
    const contentType = req.body.contentType || req.file?.mimetype || 'application/octet-stream';
    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};

    if (!fileBuffer || !fileName) return res.status(400).json({ error: 'No file provided' });

    const gcsFile = bucket.file(fileName);

    await gcsFile.save(fileBuffer, {
      metadata: { contentType, metadata },
      resumable: false,
    });

    // Do NOT call makePublic() since uniform bucket-level access may be enabled.
    // Instead return a short-lived signed URL for immediate read access.
    let signedUrl = null;
    try {
      const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
      const [url] = await gcsFile.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: expiresAt,
      });
      signedUrl = url;
    } catch (e) {
      console.warn('Could not generate signed URL for uploaded file:', e.message);
    }

    res.status(201).json({ success: true, fileName, signedUrl });
  } catch (error) {
    console.error('GCS upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Old delete route - replaced by dedicated handler above
// app.delete('/api/gcs/delete', express.json(), async (req, res) => {
//   try {
//     if (!bucket) return res.status(503).json({ error: 'Storage unavailable' });
//     const { fileName } = req.body;
//     if (!fileName) return res.status(400).json({ error: 'fileName required' });

//     await bucket.file(fileName).delete();
//     res.json({ success: true });
//   } catch (error) {
//     console.error('GCS delete error:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

app.get('/api/gcs/metadata', async (req, res) => {
  try {
    if (!bucket) return res.status(503).json({ error: 'Storage unavailable' });
    const fileName = String(req.query.fileName || '');
    if (!fileName) return res.status(400).json({ error: 'fileName query required' });

    const [meta] = await bucket.file(fileName).getMetadata();
    res.json(meta);
  } catch (error) {
    console.error('GCS metadata error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin endpoint to set bucket CORS policy (POST)
app.post('/api/gcs/set-cors', express.json(), async (req, res) => {
  try {
    if (!bucket) return res.status(503).json({ error: 'Storage unavailable' });

    const { origins } = req.body;
    if (!origins || !Array.isArray(origins)) return res.status(400).json({ error: 'origins array required' });

    const corsConfig = [
      {
        origin: origins,
        method: ['GET', 'HEAD', 'OPTIONS'],
        responseHeader: ['Content-Type', 'Content-Length', 'Accept-Ranges', 'Range'],
        maxAgeSeconds: 3600,
      },
    ];

    await bucket.setMetadata({ cors: corsConfig });
    res.json({ success: true, origins });
  } catch (error) {
    console.error('GCS set-cors error:', error);
    res.status(500).json({ error: error.message });
  }
});