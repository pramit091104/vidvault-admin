import crypto from 'crypto';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';

// Advanced download prevention system
class DownloadPreventionManager {
  constructor() {
    this.watermarkTemplates = new Map();
    this.protectedStreams = new Map();
    this.downloadAttempts = new Map();
    
    // Watermark settings
    this.watermarkConfig = {
      text: 'PREVIU - UNAUTHORIZED DOWNLOAD',
      fontSize: 48,
      opacity: 0.8,
      color: 'white',
      backgroundColor: 'rgba(255,0,0,0.3)',
      position: 'center',
      rotation: -30,
      frequency: 3000 // Every 3 seconds in video
    };
  }

  // Generate heavily watermarked video for any download attempts
  async generateWatermarkedVideo(inputPath, outputPath, options = {}) {
    return new Promise((resolve, reject) => {
      const watermarkText = options.text || this.watermarkConfig.text;
      const fontSize = options.fontSize || this.watermarkConfig.fontSize;
      
      // Create multiple watermark overlays
      const watermarkFilter = [
        // Main center watermark
        `drawtext=text='${watermarkText}':fontsize=${fontSize}:fontcolor=white@0.8:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,0,999999)'`,
        
        // Moving diagonal watermarks
        `drawtext=text='PROTECTED CONTENT':fontsize=32:fontcolor=red@0.7:x='if(gte(t,0), -50+t*100, NAN)':y=50:enable='between(t,0,999999)'`,
        `drawtext=text='DO NOT DISTRIBUTE':fontsize=32:fontcolor=red@0.7:x='if(gte(t,0), w-50-t*100, NAN)':y=h-100:enable='between(t,0,999999)'`,
        
        // Timestamp watermark
        `drawtext=text='Downloaded: %{localtime}':fontsize=24:fontcolor=yellow@0.9:x=10:y=10:enable='between(t,0,999999)'`,
        
        // Blinking warning
        `drawtext=text='UNAUTHORIZED DOWNLOAD':fontsize=40:fontcolor=red@0.9:x=(w-text_w)/2:y=h-80:enable='if(mod(t,2),1,0)'`
      ];

      ffmpeg(inputPath)
        .videoFilters(watermarkFilter)
        .outputOptions([
          '-c:v libx264',
          '-preset fast',
          '-crf 28', // Reduced quality
          '-maxrate 1M', // Limit bitrate
          '-bufsize 2M',
          '-vf scale=640:480', // Reduced resolution
          '-r 15' // Reduced frame rate
        ])
        .on('end', () => {
          console.log('Watermarked video generated successfully');
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('Watermarking failed:', err);
          reject(err);
        })
        .save(outputPath);
    });
  }

  // Create download prevention headers
  getDownloadPreventionHeaders() {
    return {
      // Prevent caching
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
      
      // Content security
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': "default-src 'self'; media-src 'self' blob:; object-src 'none';",
      
      // Download prevention
      'Content-Disposition': 'inline; filename="preview.mp4"',
      'X-Download-Options': 'noopen',
      'X-Permitted-Cross-Domain-Policies': 'none',
      
      // Custom headers to detect download attempts
      'X-Content-Protection': 'active',
      'X-Stream-Only': 'true'
    };
  }

  // Generate streaming-only URL with download detection
  generateStreamOnlyUrl(videoId, userId) {
    const streamToken = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now();
    
    // Create stream session
    const sessionData = {
      videoId,
      userId,
      streamToken,
      createdAt: timestamp,
      expiresAt: timestamp + (30 * 60 * 1000), // 30 minutes
      downloadAttempts: 0,
      isActive: true
    };
    
    this.protectedStreams.set(streamToken, sessionData);
    
    // Generate URL with multiple security parameters
    const params = new URLSearchParams({
      st: streamToken, // Stream token
      t: timestamp.toString(),
      v: videoId,
      h: this.generateStreamHash(videoId, userId, streamToken, timestamp)
    });
    
    return `/api/stream-only/${videoId}?${params.toString()}`;
  }

  // Generate hash for stream validation
  generateStreamHash(videoId, userId, streamToken, timestamp) {
    const secret = process.env.STREAM_SECRET || 'default-stream-secret';
    return crypto
      .createHmac('sha256', secret)
      .update(`${videoId}:${userId}:${streamToken}:${timestamp}`)
      .digest('hex')
      .substring(0, 16);
  }

  // Validate stream request and detect download attempts
  async validateStreamRequest(req, res, videoId) {
    try {
      const { st: streamToken, t: timestamp, h: hash } = req.query;
      
      if (!streamToken || !timestamp || !hash) {
        return { valid: false, error: 'Invalid stream parameters' };
      }

      const session = this.protectedStreams.get(streamToken);
      if (!session || !session.isActive) {
        return { valid: false, error: 'Stream session not found or expired' };
      }

      // Check expiration
      if (Date.now() > session.expiresAt) {
        this.protectedStreams.delete(streamToken);
        return { valid: false, error: 'Stream session expired' };
      }

      // Detect download attempts by analyzing request headers
      const downloadIndicators = this.detectDownloadAttempt(req);
      
      if (downloadIndicators.isDownloadAttempt) {
        session.downloadAttempts++;
        
        console.warn('🚨 Download attempt detected:', {
          videoId,
          userId: session.userId,
          indicators: downloadIndicators.indicators,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });

        // Log download attempt
        await this.logDownloadAttempt(session.userId, videoId, downloadIndicators);
        
        // Return watermarked version for download attempts
        return { 
          valid: true, 
          session, 
          forceWatermark: true,
          downloadAttempt: true 
        };
      }

      return { valid: true, session, forceWatermark: false };
      
    } catch (error) {
      console.error('Stream validation error:', error);
      return { valid: false, error: 'Validation failed' };
    }
  }

  // Detect download attempts based on request characteristics
  detectDownloadAttempt(req) {
    const indicators = [];
    let isDownloadAttempt = false;

    // Check User-Agent for download managers/tools
    const userAgent = req.get('User-Agent') || '';
    const downloadUserAgents = [
      'wget', 'curl', 'aria2', 'axel', 'DownThemAll', 'FlashGet',
      'Internet Download Manager', 'Free Download Manager', 'JDownloader',
      'youtube-dl', 'yt-dlp', 'ffmpeg', 'vlc', 'mpv'
    ];
    
    for (const agent of downloadUserAgents) {
      if (userAgent.toLowerCase().includes(agent.toLowerCase())) {
        indicators.push(`Suspicious User-Agent: ${agent}`);
        isDownloadAttempt = true;
      }
    }

    // Check for range requests (common in download managers)
    const range = req.get('Range');
    if (range && range.includes('bytes=')) {
      indicators.push('Range request detected');
      // Allow small range requests for streaming, block large ones
      const rangeMatch = range.match(/bytes=(\d+)-(\d*)/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1]);
        const end = rangeMatch[2] ? parseInt(rangeMatch[2]) : null;
        if (end && (end - start) > 10 * 1024 * 1024) { // > 10MB chunks
          indicators.push('Large range request (download attempt)');
          isDownloadAttempt = true;
        }
      }
    }

    // Check for missing or suspicious referer
    const referer = req.get('Referer') || '';
    if (!referer || (!referer.includes('localhost') && !referer.includes('previu.online'))) {
      indicators.push('Missing or invalid referer');
      isDownloadAttempt = true;
    }

    // Check for download-specific headers
    const acceptHeader = req.get('Accept') || '';
    if (acceptHeader.includes('application/octet-stream') || 
        acceptHeader.includes('*/*') && !acceptHeader.includes('text/html')) {
      indicators.push('Download-specific Accept header');
      isDownloadAttempt = true;
    }

    // Check for missing browser-specific headers
    const acceptLanguage = req.get('Accept-Language');
    const acceptEncoding = req.get('Accept-Encoding');
    if (!acceptLanguage || !acceptEncoding) {
      indicators.push('Missing browser headers');
      isDownloadAttempt = true;
    }

    // Check connection type
    const connection = req.get('Connection');
    if (connection && connection.toLowerCase() === 'close') {
      indicators.push('Connection: close (download pattern)');
      // Don't mark as download attempt for this alone, but note it
    }

    return { isDownloadAttempt, indicators };
  }

  // Log download attempt for monitoring
  async logDownloadAttempt(userId, videoId, indicators) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      userId,
      videoId,
      indicators: indicators.indicators,
      severity: 'HIGH'
    };

    // Store in download attempts map for rate limiting
    const key = `${userId}:${videoId}`;
    const attempts = this.downloadAttempts.get(key) || [];
    attempts.push(logEntry);
    
    // Keep only last 10 attempts
    if (attempts.length > 10) {
      attempts.splice(0, attempts.length - 10);
    }
    
    this.downloadAttempts.set(key, attempts);

    // In production, store in database
    console.log('Download attempt logged:', logEntry);
  }

  // Serve video with download prevention
  async serveProtectedVideo(req, res, videoPath, session, forceWatermark = false) {
    try {
      // Set download prevention headers
      const headers = this.getDownloadPreventionHeaders();
      Object.entries(headers).forEach(([key, value]) => {
        res.set(key, value);
      });

      // If download attempt detected, serve watermarked version
      if (forceWatermark) {
        return await this.serveWatermarkedVideo(req, res, videoPath, session);
      }

      // For normal streaming, serve with additional protections
      const stat = await fs.stat(videoPath);
      const fileSize = stat.size;
      
      // Handle range requests carefully (allow small chunks for streaming)
      const range = req.get('Range');
      if (range) {
        const rangeMatch = range.match(/bytes=(\d+)-(\d*)/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1]);
          const end = rangeMatch[2] ? parseInt(rangeMatch[2]) : Math.min(start + 1024 * 1024, fileSize - 1); // Max 1MB chunks
          
          // Limit chunk size to prevent downloads
          const chunkSize = Math.min(end - start + 1, 1024 * 1024); // Max 1MB
          const actualEnd = start + chunkSize - 1;
          
          res.status(206);
          res.set({
            'Content-Range': `bytes ${start}-${actualEnd}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': 'video/mp4'
          });
          
          const stream = (await import('fs')).createReadStream(videoPath, { start, end: actualEnd });
          stream.pipe(res);
        }
      } else {
        // Full file streaming (but with protections)
        res.set({
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4'
        });
        
        const stream = (await import('fs')).createReadStream(videoPath);
        stream.pipe(res);
      }

    } catch (error) {
      console.error('Protected video serving error:', error);
      res.status(500).json({ error: 'Video serving failed' });
    }
  }

  // Serve heavily watermarked video for download attempts
  async serveWatermarkedVideo(req, res, videoPath, session) {
    try {
      const tempDir = path.join(process.cwd(), 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      
      const watermarkedPath = path.join(tempDir, `watermarked_${session.streamToken}.mp4`);
      
      // Generate watermarked version
      await this.generateWatermarkedVideo(videoPath, watermarkedPath, {
        text: `UNAUTHORIZED DOWNLOAD - USER: ${session.userId.substring(0, 8)}`,
        timestamp: new Date().toISOString()
      });

      // Serve watermarked version
      const stat = await fs.stat(watermarkedPath);
      res.set({
        'Content-Length': stat.size,
        'Content-Type': 'video/mp4',
        'X-Watermarked': 'true',
        'X-Download-Detected': 'true'
      });

      const stream = (await import('fs')).createReadStream(watermarkedPath);
      stream.pipe(res);

      // Clean up watermarked file after serving
      stream.on('end', async () => {
        try {
          await fs.unlink(watermarkedPath);
        } catch (error) {
          console.warn('Failed to cleanup watermarked file:', error);
        }
      });

    } catch (error) {
      console.error('Watermarked video serving error:', error);
      res.status(500).json({ error: 'Watermarked video serving failed' });
    }
  }

  // Get download prevention statistics
  getStats() {
    return {
      activeStreams: this.protectedStreams.size,
      downloadAttempts: Array.from(this.downloadAttempts.values()).reduce((sum, attempts) => sum + attempts.length, 0),
      watermarkTemplates: this.watermarkTemplates.size
    };
  }

  // Cleanup expired sessions
  cleanup() {
    const now = Date.now();
    for (const [token, session] of this.protectedStreams.entries()) {
      if (now > session.expiresAt) {
        this.protectedStreams.delete(token);
      }
    }
  }
}

// Create singleton instance
export const downloadPrevention = new DownloadPreventionManager();

// Cleanup interval
setInterval(() => {
  downloadPrevention.cleanup();
}, 5 * 60 * 1000); // Every 5 minutes

export default downloadPrevention;