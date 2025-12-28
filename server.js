import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Storage } from '@google-cloud/storage';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'fs';
import Razorpay from 'razorpay';
import crypto from 'crypto';

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
  origin: ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000'],
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
            const origins = (process.env.GCS_CORS_ORIGINS || 'https://www.previu.online,http://localhost:5173,http://localhost:8080')
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
      } catch (e) {
        console.error('Could not list files:', e.message);
      }

      return res.status(404).json({ error: 'Video not found in storage' });
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