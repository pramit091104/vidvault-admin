import { Storage } from '@google-cloud/storage';
import multer from 'multer';
import { getSession, updateSession } from '../lib/sessionStorage.js';

// Initialize Google Cloud Storage
let bucket = null;

if (process.env.GCS_BUCKET_NAME && process.env.GCS_PROJECT_ID) {
  try {
    let credentials;
    if (process.env.GCS_CREDENTIALS) {
      credentials = JSON.parse(process.env.GCS_CREDENTIALS);
    } else if (process.env.GCS_CREDENTIALS_BASE64) {
      const decoded = Buffer.from(process.env.GCS_CREDENTIALS_BASE64, 'base64').toString('utf-8');
      credentials = JSON.parse(decoded);
    }

    if (credentials) {
      const storage = new Storage({ 
        projectId: process.env.GCS_PROJECT_ID, 
        credentials 
      });
      bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
    }
  } catch (error) {
    console.warn('Failed to initialize GCS:', error.message);
  }
}

// Multer for handling chunk uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per chunk
  }
});

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

// Access global sessions (fallback - not used with Firestore)
global.uploadSessions = global.uploadSessions || new Map();

export default async function handler(req, res) {
  // Set CORS headers
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  console.log(`🚀 Upload chunk handler called - Method: ${req.method}, URL: ${req.url}`);
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    console.log(`❌ Method not allowed: ${req.method}`);
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔍 Checking bucket availability...');
    if (!bucket) {
      console.error('❌ Bucket not available - GCS not initialized');
      return res.status(503).json({ error: 'Storage unavailable' });
    }
    console.log('✅ Bucket is available');

    // Handle multipart form data
    upload.single('chunk')(req, res, async (err) => {
      if (err) {
        console.error('❌ Multer error:', err);
        return res.status(400).json({ error: err.message });
      }

      console.log('📝 Request body:', {
        sessionId: req.body?.sessionId,
        chunkId: req.body?.chunkId,
        chunkIndex: req.body?.chunkIndex,
        chunkSize: req.body?.chunkSize,
        hasFile: !!req.file
      });

      const { sessionId, chunkId, chunkIndex, chunkSize, checksum } = req.body;
      const chunkData = req.file?.buffer;

      // Validate required fields
      if (!sessionId || !chunkId || chunkIndex === undefined || !chunkData) {
        console.error('❌ Missing required fields:', {
          sessionId: !!sessionId,
          chunkId: !!chunkId,
          chunkIndex: chunkIndex !== undefined,
          chunkData: !!chunkData
        });
        return res.status(400).json({ 
          error: 'Missing required fields: sessionId, chunkId, chunkIndex, chunk data' 
        });
      }

      console.log(`🔍 Looking for session: ${sessionId}`);
      // Get upload session from file storage
      const session = await getSession(sessionId);
      if (!session) {
        console.error(`❌ Upload session not found: ${sessionId}`);
        return res.status(404).json({ error: 'Upload session not found' });
      }
      console.log(`✅ Session found: ${sessionId}`);

      // Validate chunk size
      if (chunkData.length !== parseInt(chunkSize)) {
        console.error(`❌ Chunk size mismatch: expected ${chunkSize}, got ${chunkData.length}`);
        return res.status(400).json({ error: 'Chunk size mismatch' });
      }

      console.log(`📦 Processing chunk ${chunkIndex} for session ${sessionId}`);

      // Store chunk metadata in session (not the actual data)
      const chunkInfo = {
        chunkId,
        index: parseInt(chunkIndex),
        size: chunkData.length,
        checksum,
        uploadedAt: new Date()
      };

      // Upload chunk directly to GCS with a temporary path
      const tempChunkPath = `upload_chunks/${sessionId}/${chunkIndex}.chunk`;
      const chunkFile = bucket.file(tempChunkPath);
      await chunkFile.save(chunkData, {
        metadata: {
          contentType: 'application/octet-stream',
          metadata: {
            sessionId,
            chunkId,
            chunkIndex: chunkIndex.toString()
          }
        }
      });

      // Initialize chunks object if it doesn't exist
      if (!session.chunks) {
        session.chunks = {};
      }
      
      session.chunks[chunkIndex] = chunkInfo;
      
      // Update uploaded chunks list
      if (!session.uploadedChunks.includes(chunkId)) {
        session.uploadedChunks.push(chunkId);
      }

      const isComplete = session.uploadedChunks.length === session.totalChunks;
      console.log(`📊 Upload progress: ${session.uploadedChunks.length}/${session.totalChunks} chunks`);

      // Update session in storage
      const updateResult = await updateSession(sessionId, {
        chunks: session.chunks,
        uploadedChunks: session.uploadedChunks,
        status: isComplete ? 'chunks_complete' : 'uploading'
      });

      if (!updateResult) {
        console.error('❌ Failed to update session');
        return res.status(500).json({ error: 'Failed to update session' });
      }

      console.log(`✅ Chunk ${chunkIndex} uploaded successfully. Complete: ${isComplete}`);

      // If all chunks uploaded, trigger assembly in background
      if (isComplete) {
        console.log('🔧 All chunks uploaded, triggering background assembly...');
        
        // Update status to assembling immediately
        await updateSession(sessionId, { status: 'assembling' });
        
        // Start assembly in background (don't await)
        assembleFile(sessionId).catch(err => {
          console.error('❌ Background assembly failed:', err);
        });
      }

      res.status(200).json({
        success: true,
        chunkId,
        uploadedChunks: session.uploadedChunks.length,
        totalChunks: session.totalChunks,
        isComplete,
        status: isComplete ? 'assembling' : 'uploading'
      });
    });

  } catch (error) {
    console.error('❌ Error uploading chunk:', error);
    res.status(500).json({ error: error.message });
  }
}

// Assemble file from chunks stored in GCS
async function assembleFile(sessionId) {
  try {
    console.log(`🔧 Starting assembly for session ${sessionId}`);
    const session = await getSession(sessionId);
    if (!session) {
      console.error(`❌ Session ${sessionId} not found for assembly`);
      return;
    }

    await updateSession(sessionId, { status: 'assembling' });

    // Get all chunk files from GCS
    const chunkPrefix = `upload_chunks/${sessionId}/`;
    const [chunkFiles] = await bucket.getFiles({ prefix: chunkPrefix });

    if (chunkFiles.length === 0) {
      throw new Error('No chunk files found');
    }

    console.log(`📦 Found ${chunkFiles.length} chunk files to assemble`);

    // Sort chunks by index
    const sortedChunkFiles = chunkFiles.sort((a, b) => {
      const indexA = parseInt(a.name.split('/').pop().replace('.chunk', ''));
      const indexB = parseInt(b.name.split('/').pop().replace('.chunk', ''));
      return indexA - indexB;
    });

    // Download and combine chunks
    const buffers = [];
    for (const chunkFile of sortedChunkFiles) {
      console.log(`📥 Downloading chunk: ${chunkFile.name}`);
      const [chunkData] = await chunkFile.download();
      buffers.push(chunkData);
    }

    const assembledBuffer = Buffer.concat(buffers);
    console.log(`✅ Assembled ${buffers.length} chunks into ${assembledBuffer.length} bytes`);

    // Upload assembled file to GCS
    const fileName = `uploads/${sessionId}/${session.fileName}`;
    const file = bucket.file(fileName);

    console.log(`📤 Uploading assembled file to: ${fileName}`);
    await file.save(assembledBuffer, {
      metadata: {
        contentType: session.metadata.contentType || 'application/octet-stream',
        metadata: session.metadata
      }
    });

    // Generate signed URL
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: expiresAt,
    });

    console.log(`🔗 Generated signed URL for assembled file`);

    // Update session with completion info
    await updateSession(sessionId, {
      status: 'completed',
      gcsPath: fileName,
      signedUrl,
      completedAt: new Date(),
      chunks: {} // Clear chunks metadata to save space
    });

    // Clean up temporary chunk files
    console.log(`🧹 Cleaning up ${chunkFiles.length} temporary chunk files`);
    await Promise.all(chunkFiles.map(chunkFile => chunkFile.delete().catch(err => {
      console.warn(`⚠️ Failed to delete chunk ${chunkFile.name}:`, err.message);
    })));

    console.log(`✅ Assembly completed successfully for session ${sessionId}`);
  } catch (error) {
    console.error(`❌ Error assembling file for session ${sessionId}:`, error);
    await updateSession(sessionId, {
      status: 'failed',
      error: error.message
    });
    throw error;
  }
}