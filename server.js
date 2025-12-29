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

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const BUCKET_NAME = process.env.GCS_BUCKET_NAME;

// Multer for multipart/form-data (file uploads)
const upload = multer({ storage: multer.memoryStorage() });

// --- Middleware ---
app.use(helmet());
app.use(cors({ 
  origin: ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000', 'https://previu.online'],
  credentials: true 
}));
app.use(express.json());

// --- Initialize Google Cloud Storage ---
let bucket = null;

if (BUCKET_NAME && process.env.GCS_PROJECT_ID) {
  try {
    let credentials;
    if (process.env.GCS_CREDENTIALS_BASE64) {
      const decoded = Buffer.from(process.env.GCS_CREDENTIALS_BASE64, 'base64').toString('utf-8');
      credentials = JSON.parse(decoded);
    } else if (process.env.GCS_KEY_FILE && fs.existsSync(process.env.GCS_KEY_FILE)) {
      const keyFileContent = fs.readFileSync(process.env.GCS_KEY_FILE, 'utf8');
      credentials = JSON.parse(keyFileContent);
    }

    if (credentials) {
      const storage = new Storage({ projectId: process.env.GCS_PROJECT_ID, credentials });
      bucket = storage.bucket(BUCKET_NAME);
      console.log('✅ Google Cloud Storage initialized');
      // Optionally auto-configure CORS on startup to allow browser video playback
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
    }
  } catch (error) {
    console.warn('❌ Failed to initialize GCS:', error.message);
  }
}

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
      } catch {}
      throw analysisError;
    }
  } catch (error) {
    console.error('Video analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/video/compress', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const { options } = req.body;
    const compressionOptions = options ? JSON.parse(options) : undefined;

    // Save uploaded file temporarily
    const tempDir = path.join(__dirname, 'temp');
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    const inputPath = path.join(tempDir, `input_${Date.now()}_${req.file.originalname}`);
    await fs.promises.writeFile(inputPath, req.file.buffer);

    const outputFileName = `compressed_${Date.now()}_${req.file.originalname}`;
    const outputPath = path.join(tempDir, outputFileName);

    try {
      // Fallback compression: just copy the file (simulate compression)
      await fs.promises.copyFile(inputPath, outputPath);

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
          outputPath,
          originalSize: originalStats.size,
          compressedSize: compressedStats.size,
          compressionRatio: 1,
          compressedData: compressedBuffer.toString('base64'),
          fileName: outputFileName,
          error: 'FFmpeg not available - original file used without compression'
        }
      });
    } catch (compressionError) {
      // Cleanup temp files on error
      try {
        await fs.promises.unlink(inputPath);
        await fs.promises.unlink(outputPath);
      } catch {}
      throw compressionError;
    }
  } catch (error) {
    console.error('Video compression error:', error);
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
    
    // Store session info (in production, use a database)
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

    // In production, store this in a database
    // For now, we'll use a simple in-memory store
    global.uploadSessions = global.uploadSessions || new Map();
    global.uploadSessions.set(sessionId, sessionData);

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

    // Get session data
    global.uploadSessions = global.uploadSessions || new Map();
    const session = global.uploadSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    // Check if session is expired
    if (new Date() > session.expiresAt) {
      global.uploadSessions.delete(sessionId);
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

    res.json({
      success: true,
      chunkId,
      uploadedChunks: session.uploadedChunks.length,
      totalChunks: session.totalChunks,
      isComplete: session.uploadedChunks.length === session.totalChunks
    });

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
    
    global.uploadSessions = global.uploadSessions || new Map();
    const session = global.uploadSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    // Check if session is expired
    if (new Date() > session.expiresAt) {
      global.uploadSessions.delete(sessionId);
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
    global.uploadSessions = global.uploadSessions || new Map();
    const session = global.uploadSessions.get(sessionId);
    
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

    console.log(`Successfully assembled file for session ${sessionId}: ${finalFileName}`);
  } catch (error) {
    console.error('Error assembling chunks:', error);
    
    // Update session with error
    const session = global.uploadSessions.get(sessionId);
    if (session) {
      session.status = 'failed';
      session.error = error.message;
    }
  }
}

// Get upload session status
app.get('/api/gcs/upload-status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    global.uploadSessions = global.uploadSessions || new Map();
    const session = global.uploadSessions.get(sessionId);
    
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

    res.json({ signedUrl, expiresAt: new Date(expiresAt).toISOString() });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Razorpay Payment Endpoints ---

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_Rx5tnJCOUHefCi',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'gJfWtk2zshP9dKcZQocNPg6T',
});

// Create order endpoint
app.post('/api/razorpay/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt, notes } = req.body;

    const options = {
      amount: amount, // Amount in smallest currency unit (paise)
      currency,
      receipt,
      notes,
      payment_capture: 1, // Auto capture payment
    };

    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// Verify payment endpoint
app.post('/api/razorpay/verify-payment', (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body;

    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'gJfWtk2zshP9dKcZQocNPg6T');
    hmac.update(orderId + '|' + paymentId);
    const generatedSignature = hmac.digest('hex');

    const isValid = generatedSignature === signature;
    res.json({ isValid });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

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

app.delete('/api/gcs/delete', express.json(), async (req, res) => {
  try {
    if (!bucket) return res.status(503).json({ error: 'Storage unavailable' });
    const { fileName } = req.body;
    if (!fileName) return res.status(400).json({ error: 'fileName required' });

    await bucket.file(fileName).delete();
    res.json({ success: true });
  } catch (error) {
    console.error('GCS delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

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