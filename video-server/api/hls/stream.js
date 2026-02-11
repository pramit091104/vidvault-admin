import { Storage } from '@google-cloud/storage';
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

// Store active HLS sessions with encryption keys
const hlsSessions = new Map();

/**
 * Generate HLS streaming session
 */
export async function generateHLSSession(req, res) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const { getAuth } = await import('firebase-admin/auth');
    const decodedToken = await getAuth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const { videoId } = req.body;

    if (!videoId) {
      return res.status(400).json({ error: 'Video ID required' });
    }

    // Generate session ID
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + 3600000; // 1 hour

    // Store session
    hlsSessions.set(sessionId, {
      videoId,
      userId,
      expiresAt,
      createdAt: Date.now()
    });

    // Clean up expired sessions
    cleanupExpiredSessions();

    res.json({
      success: true,
      sessionId,
      playlistUrl: `/api/hls/playlist/${sessionId}/master.m3u8`,
      expiresAt: new Date(expiresAt).toISOString()
    });

  } catch (error) {
    console.error('HLS session generation error:', error);
    res.status(500).json({ error: 'Failed to generate HLS session' });
  }
}

/**
 * Serve HLS playlist (master or variant)
 */
export async function servePlaylist(req, res) {
  try {
    if (!bucket) {
      return res.status(503).json({ error: 'Storage unavailable' });
    }

    const { sessionId, playlistName } = req.params;

    // Validate session
    const session = hlsSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Invalid or expired session' });
    }

    if (Date.now() > session.expiresAt) {
      hlsSessions.delete(sessionId);
      return res.status(410).json({ error: 'Session expired' });
    }

    // Get playlist from GCS
    const gcsPath = `hls/${session.videoId}/${playlistName}`;
    const file = bucket.file(gcsPath);
    
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // Download playlist content
    const [content] = await file.download();
    let playlistContent = content.toString('utf-8');

    // Rewrite URLs in playlist to use our session-based endpoints
    if (playlistName === 'master.m3u8') {
      // Rewrite variant playlist URLs
      playlistContent = playlistContent.replace(
        /^([^#\n].+\.m3u8)$/gm,
        `/api/hls/playlist/${sessionId}/$1`
      );
    } else {
      // Rewrite segment URLs
      playlistContent = playlistContent.replace(
        /^([^#\n].+\.ts)$/gm,
        `/api/hls/segment/${sessionId}/$1`
      );
      
      // Rewrite key URL
      playlistContent = playlistContent.replace(
        /URI="([^"]+)"/g,
        `URI="/api/hls/key/${sessionId}"`
      );
    }

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(playlistContent);

  } catch (error) {
    console.error('Playlist serving error:', error);
    res.status(500).json({ error: 'Failed to serve playlist' });
  }
}

/**
 * Serve HLS segment
 */
export async function serveSegment(req, res) {
  try {
    if (!bucket) {
      return res.status(503).json({ error: 'Storage unavailable' });
    }

    const { sessionId, segmentName } = req.params;

    // Validate session
    const session = hlsSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Invalid or expired session' });
    }

    if (Date.now() > session.expiresAt) {
      hlsSessions.delete(sessionId);
      return res.status(410).json({ error: 'Session expired' });
    }

    // Get segment from GCS
    const gcsPath = `hls/${session.videoId}/${segmentName}`;
    const file = bucket.file(gcsPath);
    
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ error: 'Segment not found' });
    }

    // Stream segment
    res.setHeader('Content-Type', 'video/MP2T');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache segments for 1 year
    res.setHeader('Access-Control-Allow-Origin', '*');

    file.createReadStream()
      .on('error', (error) => {
        console.error('Segment stream error:', error);
        if (!res.headersSent) {
          res.status(500).end();
        }
      })
      .pipe(res);

  } catch (error) {
    console.error('Segment serving error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to serve segment' });
    }
  }
}

/**
 * Serve encryption key
 */
export async function serveKey(req, res) {
  try {
    if (!bucket) {
      return res.status(503).json({ error: 'Storage unavailable' });
    }

    const { sessionId } = req.params;

    // Validate session
    const session = hlsSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Invalid or expired session' });
    }

    if (Date.now() > session.expiresAt) {
      hlsSessions.delete(sessionId);
      return res.status(410).json({ error: 'Session expired' });
    }

    // Get encryption key from GCS
    const gcsPath = `hls/${session.videoId}/enc.key`;
    const file = bucket.file(gcsPath);
    
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ error: 'Encryption key not found' });
    }

    // Serve key
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');

    file.createReadStream()
      .on('error', (error) => {
        console.error('Key stream error:', error);
        if (!res.headersSent) {
          res.status(500).end();
        }
      })
      .pipe(res);

  } catch (error) {
    console.error('Key serving error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to serve key' });
    }
  }
}

/**
 * Clean up expired sessions
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of hlsSessions.entries()) {
    if (now > session.expiresAt) {
      hlsSessions.delete(sessionId);
    }
  }
}

// Clean up expired sessions every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

export default {
  generateHLSSession,
  servePlaylist,
  serveSegment,
  serveKey
};
