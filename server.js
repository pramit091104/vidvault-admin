import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'video/ogg',
  'video/x-matroska'
];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// Initialize Google Cloud Storage (only if configured)
let storage = null;
let bucket = null;
const bucketName = process.env.GCS_BUCKET_NAME;

if (bucketName && process.env.GCS_PROJECT_ID) {
  try {
    storage = new Storage({
      projectId: process.env.GCS_PROJECT_ID,
      keyFilename: process.env.GCS_KEY_FILE || undefined,
    });
    bucket = storage.bucket(bucketName);
    console.log('Google Cloud Storage initialized successfully');
  } catch (error) {
    console.warn('Failed to initialize Google Cloud Storage:', error.message);
  }
} else {
  console.log('Google Cloud Storage not configured - GCS endpoints will be disabled');
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Security middlewares
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json());

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer for file uploads
const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: multerStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Only video files are allowed'));
    }
    cb(null, true);
  }
});

// Serve static files with caching
app.use('/uploads', express.static('uploads', {
  maxAge: '1y',
  setHeaders: (res, path) => {
    res.set('Cache-Control', 'public, max-age=31536000');
  }
}));

// Test endpoint
app.get('/', (req, res) => {
  res.send('File Upload Server is running!');
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
    
    res.json({
      success: true,
      fileUrl,
      fileName: req.file.filename,
      filePath: `/uploads/${req.file.filename}`
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false,
      error: 'File upload failed',
      details: error.message 
    });
  }
});

// Configure multer for GCS uploads (memory storage)
const gcsUpload = multer({ storage: multer.memoryStorage() }).single('file');

// Google Cloud Storage upload endpoint
app.post('/api/gcs/upload', gcsUpload, async (req, res) => {
  try {
    // Check if GCS is configured
    if (!bucket) {
      return res.status(503).json({ 
        success: false,
        error: 'Google Cloud Storage is not configured or available',
        details: 'Please configure GCS credentials and bucket name'
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!bucketName) {
      return res.status(500).json({ error: 'Google Cloud Storage bucket not configured' });
    }

    const { fileName, contentType, metadata } = req.body;
    
    if (!fileName) {
      return res.status(400).json({ error: 'File name is required' });
    }

    // Create a blob in the bucket
    const blob = bucket.file(fileName);
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: contentType || req.file.mimetype,
        metadata: metadata ? JSON.parse(metadata) : {},
      },
    });

    blobStream.on('error', (err) => {
      console.error('GCS upload error:', err);
      res.status(500).json({ 
        success: false,
        error: 'Failed to upload to Google Cloud Storage',
        details: err.message 
      });
    });

    blobStream.on('finish', async () => {
      try {
        // Make the file public (optional, based on privacy settings)
        if (metadata) {
          const parsedMetadata = JSON.parse(metadata);
          if (parsedMetadata.privacyStatus === 'public') {
            await blob.makePublic();
          }
        }

        // Get file metadata
        const [metadataResult] = await blob.getMetadata();
        
        res.json({
          success: true,
          fileName,
          size: metadataResult.size,
          contentType: metadataResult.contentType,
          uploadedAt: new Date().toISOString(),
          publicUrl: `https://storage.googleapis.com/${bucketName}/${fileName}`,
        });
      } catch (error) {
        console.error('Error getting file metadata:', error);
        res.status(500).json({ 
          success: false,
          error: 'File uploaded but failed to get metadata',
          details: error.message 
        });
      }
    });

    // Pipe the file buffer to GCS
    blobStream.end(req.file.buffer);
  } catch (error) {
    console.error('GCS upload error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Google Cloud Storage upload failed',
      details: error.message 
    });
  }
});

// GCS file deletion endpoint
app.delete('/api/gcs/delete', async (req, res) => {
  try {
    // Check if GCS is configured
    if (!bucket) {
      return res.status(503).json({ 
        success: false,
        error: 'Google Cloud Storage is not configured or available',
        details: 'Please configure GCS credentials and bucket name'
      });
    }

    const { fileName } = req.body;
    
    if (!fileName) {
      return res.status(400).json({ error: 'File name is required' });
    }

    if (!bucketName) {
      return res.status(500).json({ error: 'Google Cloud Storage bucket not configured' });
    }

    const blob = bucket.file(fileName);
    await blob.delete();
    
    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('GCS delete error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete file from Google Cloud Storage',
      details: error.message 
    });
  }
});

// GCS file metadata endpoint
app.get('/api/gcs/metadata', async (req, res) => {
  try {
    // Check if GCS is configured
    if (!bucket) {
      return res.status(503).json({ 
        success: false,
        error: 'Google Cloud Storage is not configured or available',
        details: 'Please configure GCS credentials and bucket name'
      });
    }

    const { fileName } = req.query;
    
    if (!fileName) {
      return res.status(400).json({ error: 'File name is required' });
    }

    if (!bucketName) {
      return res.status(500).json({ error: 'Google Cloud Storage bucket not configured' });
    }

    const blob = bucket.file(fileName);
    const [metadata] = await blob.getMetadata();
    
    res.json({
      success: true,
      metadata: {
        name: metadata.name,
        size: metadata.size,
        contentType: metadata.contentType,
        timeCreated: metadata.timeCreated,
        updated: metadata.updated,
        generation: metadata.generation,
        md5Hash: metadata.md5Hash,
        crc32c: metadata.crc32c,
      }
    });
  } catch (error) {
    console.error('GCS metadata error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get file metadata from Google Cloud Storage',
      details: error.message 
    });
  }
});

// Enhanced logging for server errors
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  console.error('Request details:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
  });
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log('📂 Ready to handle file uploads at POST /api/upload');
  console.log('📂 Serving static files from /uploads\n');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  server.close(() => process.exit(1));
});
