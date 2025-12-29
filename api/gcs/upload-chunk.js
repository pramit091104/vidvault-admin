import { Storage } from '@google-cloud/storage';
import multer from 'multer';
import { getSession, updateSession } from './lib/sessionStorage.js';

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

// Access global sessions
global.uploadSessions = global.uploadSessions || new Map();

// Access global sessions
global.uploadSessions = global.uploadSessions || new Map();

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!bucket) {
      return res.status(503).json({ error: 'Storage unavailable' });
    }

    // Handle multipart form data
    upload.single('chunk')(req, res, async (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({ error: err.message });
      }

      const { sessionId, chunkId, chunkIndex, chunkSize, checksum } = req.body;
      const chunkData = req.file?.buffer;

      // Validate required fields
      if (!sessionId || !chunkId || chunkIndex === undefined || !chunkData) {
        return res.status(400).json({ 
          error: 'Missing required fields: sessionId, chunkId, chunkIndex, chunk data' 
        });
      }

      // Get upload session from file storage
      const session = await getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Upload session not found' });
      }

      // Validate chunk size
      if (chunkData.length !== parseInt(chunkSize)) {
        return res.status(400).json({ error: 'Chunk size mismatch' });
      }

      // Store chunk data in session
      const chunkInfo = {
        chunkId,
        index: parseInt(chunkIndex),
        size: chunkData.length,
        data: chunkData.toString('base64'), // Store as base64 for JSON serialization
        checksum,
        uploadedAt: new Date()
      };

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

      // Update session in storage
      await updateSession(sessionId, {
        chunks: session.chunks,
        uploadedChunks: session.uploadedChunks,
        status: isComplete ? 'chunks_complete' : 'uploading'
      });

      res.status(200).json({
        success: true,
        chunkId,
        uploadedChunks: session.uploadedChunks.length,
        totalChunks: session.totalChunks,
        isComplete
      });

      // If all chunks uploaded, trigger assembly
      if (isComplete) {
        setImmediate(() => assembleFile(sessionId));
      }
    });

  } catch (error) {
    console.error('Error uploading chunk:', error);
    res.status(500).json({ error: error.message });
  }
}

// Assemble file from chunks
async function assembleFile(sessionId) {
  try {
    const session = await getSession(sessionId);
    if (!session) return;

    await updateSession(sessionId, { status: 'assembling' });

    // Sort chunks by index and convert back from base64
    const sortedChunks = Object.values(session.chunks)
      .sort((a, b) => a.index - b.index)
      .map(chunk => ({
        ...chunk,
        data: Buffer.from(chunk.data, 'base64')
      }));

    // Combine chunk data
    const buffers = sortedChunks.map(chunk => chunk.data);
    const assembledBuffer = Buffer.concat(buffers);

    // Upload to GCS
    const fileName = `uploads/${sessionId}/${session.fileName}`;
    const file = bucket.file(fileName);

    const stream = file.createWriteStream({
      metadata: {
        contentType: session.metadata.contentType || 'application/octet-stream',
        metadata: session.metadata
      }
    });

    await new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('finish', resolve);
      stream.end(assembledBuffer);
    });

    // Generate signed URL
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: expiresAt,
    });

    // Update session with completion info
    await updateSession(sessionId, {
      status: 'completed',
      gcsPath: fileName,
      signedUrl,
      completedAt: new Date(),
      chunks: {} // Clear chunks to save space
    });

  } catch (error) {
    console.error('Error assembling file:', error);
    await updateSession(sessionId, {
      status: 'failed',
      error: error.message
    });
  }
}