import HLSTranscoder from '../../services/hlsTranscoder.js';
import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Initialize Google Cloud Storage
let bucket = null;

if (process.env.GCS_BUCKET_NAME && process.env.GCS_PROJECT_ID) {
  try {
    let credentials = null;
    
    if (process.env.GCS_CREDENTIALS) {
      credentials = JSON.parse(process.env.GCS_CREDENTIALS);
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
    }
    
    const storage = new Storage({ 
      projectId: process.env.GCS_PROJECT_ID,
      credentials: credentials
    });
    bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
  } catch (error) {
    console.error('Failed to initialize GCS:', error.message);
  }
}

/**
 * Transcode uploaded video to HLS format
 */
export async function transcodeVideo(req, res) {
  let tempInputPath = null;
  let sessionId = null;

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

    if (!bucket) {
      return res.status(503).json({ error: 'Storage unavailable' });
    }

    console.log(`Starting HLS transcoding for video: ${videoId}`);

    // Download video from GCS to temp location
    const file = bucket.file(gcsPath);
    const [exists] = await file.exists();

    if (!exists) {
      return res.status(404).json({ error: 'Video file not found in storage' });
    }

    // Create temp directory
    const tempDir = path.join(process.cwd(), 'temp', 'transcode');
    await fs.promises.mkdir(tempDir, { recursive: true });

    // Download file
    tempInputPath = path.join(tempDir, `${videoId}_input${path.extname(gcsPath)}`);
    await file.download({ destination: tempInputPath });

    console.log(`Downloaded video to: ${tempInputPath}`);

    // Initialize transcoder
    const transcoder = new HLSTranscoder(bucket);
    sessionId = crypto.randomUUID();

    // Transcode to HLS
    const transcodeResult = await transcoder.transcodeToHLS(tempInputPath, sessionId, {
      resolutions: [
        { name: '360p', width: 640, height: 360, bitrate: '800k' },
        { name: '720p', width: 1280, height: 720, bitrate: '2500k' }
      ],
      segmentDuration: 6,
      encrypt: true
    });

    console.log(`Transcoding completed for session: ${sessionId}`);

    // Upload HLS files to GCS
    const uploadResult = await transcoder.uploadToGCS(
      sessionId,
      transcodeResult.outputDir,
      videoId
    );

    console.log(`Uploaded HLS files to GCS: ${uploadResult.masterPlaylistUrl}`);

    // Clean up temp files
    await transcoder.cleanup(sessionId);
    if (tempInputPath) {
      await fs.promises.unlink(tempInputPath).catch(console.error);
    }

    res.json({
      success: true,
      videoId,
      hlsPath: uploadResult.masterPlaylistUrl,
      segmentCount: uploadResult.segmentCount,
      resolutions: transcodeResult.resolutions,
      encrypted: true
    });

  } catch (error) {
    console.error('HLS transcoding error:', error);

    // Clean up on error
    if (sessionId) {
      const transcoder = new HLSTranscoder(bucket);
      await transcoder.cleanup(sessionId).catch(console.error);
    }
    if (tempInputPath) {
      await fs.promises.unlink(tempInputPath).catch(console.error);
    }

    res.status(500).json({ 
      error: 'Failed to transcode video',
      details: error.message 
    });
  }
}

/**
 * Check HLS transcoding status
 */
export async function checkTranscodeStatus(req, res) {
  try {
    const { videoId } = req.params;

    if (!bucket) {
      return res.status(503).json({ error: 'Storage unavailable' });
    }

    // Check if HLS files exist
    const masterPlaylistPath = `hls/${videoId}/master.m3u8`;
    const file = bucket.file(masterPlaylistPath);
    const [exists] = await file.exists();

    if (exists) {
      // Get list of segments
      const [files] = await bucket.getFiles({ prefix: `hls/${videoId}/` });
      const segments = files.filter(f => f.name.endsWith('.ts'));

      res.json({
        transcoded: true,
        hlsPath: masterPlaylistPath,
        segmentCount: segments.length,
        files: files.map(f => f.name)
      });
    } else {
      res.json({
        transcoded: false,
        message: 'Video not yet transcoded to HLS'
      });
    }

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check transcode status' });
  }
}

export default {
  transcodeVideo,
  checkTranscodeStatus
};
