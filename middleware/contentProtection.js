import crypto from 'crypto';
import sharp from 'sharp';
import { Storage } from '@google-cloud/storage';

// Content protection middleware
class ContentProtectionManager {
  constructor() {
    this.watermarkCache = new Map();
    this.protectedUrls = new Map();
    this.accessTokens = new Map();
    
    // Protection settings
    this.settings = {
      watermark: {
        text: 'PREVIU PREVIEW',
        opacity: 0.3,
        fontSize: 48,
        color: 'rgba(255,255,255,0.7)',
        position: 'center'
      },
      preview: {
        maxWidth: 800,
        maxHeight: 600,
        quality: 60,
        format: 'jpeg'
      },
      access: {
        tokenExpiry: 3600, // 1 hour
        maxDownloads: 3,
        ipRestriction: true
      }
    };
  }

  // Generate secure access token
  generateAccessToken(userId, videoId, permissions = {}) {
    const tokenData = {
      userId,
      videoId,
      permissions: {
        canDownload: permissions.canDownload || false,
        canStream: permissions.canStream || true,
        quality: permissions.quality || 'preview', // preview, standard, hd
        expiresAt: Date.now() + (this.settings.access.tokenExpiry * 1000),
        maxUses: permissions.maxUses || this.settings.access.maxDownloads,
        ...permissions
      },
      createdAt: Date.now(),
      signature: this.signToken(userId, videoId)
    };

    const token = Buffer.from(JSON.stringify(tokenData)).toString('base64url');
    this.accessTokens.set(token, { ...tokenData, usageCount: 0 });
    
    return token;
  }

  // Sign token for integrity
  signToken(userId, videoId) {
    const secret = process.env.CONTENT_PROTECTION_SECRET || 'default-secret-change-in-production';
    return crypto
      .createHmac('sha256', secret)
      .update(`${userId}:${videoId}:${Date.now()}`)
      .digest('hex');
  }

  // Validate access token
  validateAccessToken(token, requiredPermission = 'canStream') {
    try {
      const tokenData = this.accessTokens.get(token);
      
      if (!tokenData) {
        return { valid: false, error: 'Invalid or expired token' };
      }

      // Check expiration
      if (Date.now() > tokenData.permissions.expiresAt) {
        this.accessTokens.delete(token);
        return { valid: false, error: 'Token expired' };
      }

      // Check usage limits
      if (tokenData.usageCount >= tokenData.permissions.maxUses) {
        return { valid: false, error: 'Usage limit exceeded' };
      }

      // Check specific permission
      if (requiredPermission && !tokenData.permissions[requiredPermission]) {
        return { valid: false, error: `Permission denied: ${requiredPermission}` };
      }

      // Increment usage count
      tokenData.usageCount++;

      return { 
        valid: true, 
        tokenData,
        remainingUses: tokenData.permissions.maxUses - tokenData.usageCount
      };
    } catch (error) {
      return { valid: false, error: 'Token validation failed' };
    }
  }

  // Generate watermarked preview
  async generateWatermarkedPreview(videoBuffer, options = {}) {
    try {
      // For video files, we'll extract a frame and watermark it
      // This is a simplified version - in production, use FFmpeg for video processing
      
      const watermarkText = options.watermarkText || this.settings.watermark.text;
      const quality = options.quality || this.settings.preview.quality;
      
      // Create watermark overlay
      const watermarkSvg = this.createWatermarkSvg(watermarkText, options);
      
      // Process image/video frame
      let processedBuffer;
      
      if (options.isVideo) {
        // For videos, you'd extract a frame here using FFmpeg
        // For now, we'll return the original buffer with metadata
        processedBuffer = videoBuffer;
      } else {
        // For images, apply watermark and resize
        processedBuffer = await sharp(videoBuffer)
          .resize(this.settings.preview.maxWidth, this.settings.preview.maxHeight, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .composite([{
            input: Buffer.from(watermarkSvg),
            gravity: 'center',
            blend: 'over'
          }])
          .jpeg({ quality })
          .toBuffer();
      }

      return {
        buffer: processedBuffer,
        metadata: {
          watermarked: true,
          quality: quality,
          protection: 'preview'
        }
      };
    } catch (error) {
      console.error('Watermark generation failed:', error);
      throw new Error('Failed to generate protected preview');
    }
  }

  // Create SVG watermark
  createWatermarkSvg(text, options = {}) {
    const width = options.width || 800;
    const height = options.height || 600;
    const fontSize = options.fontSize || this.settings.watermark.fontSize;
    const opacity = options.opacity || this.settings.watermark.opacity;
    
    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="watermark" patternUnits="userSpaceOnUse" width="300" height="200">
            <text x="150" y="100" 
                  font-family="Arial, sans-serif" 
                  font-size="${fontSize}" 
                  font-weight="bold"
                  text-anchor="middle" 
                  fill="white" 
                  opacity="${opacity}"
                  transform="rotate(-45 150 100)">
              ${text}
            </text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#watermark)" />
      </svg>
    `;
  }

  // Generate protected streaming URL
  generateProtectedUrl(videoId, userId, permissions = {}) {
    const token = this.generateAccessToken(userId, videoId, permissions);
    const protectedPath = `/api/protected/stream/${videoId}`;
    
    // Add additional security parameters
    const urlParams = new URLSearchParams({
      token,
      t: Date.now().toString(), // Timestamp to prevent caching
      h: crypto.createHash('md5').update(`${videoId}:${userId}:${token}`).digest('hex').substring(0, 8)
    });

    return `${protectedPath}?${urlParams.toString()}`;
  }

  // Validate request and serve protected content
  async serveProtectedContent(req, res, videoId) {
    try {
      // Extract and validate token
      const token = req.query.token;
      const validation = this.validateAccessToken(token, 'canStream');
      
      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      // Additional security checks
      const securityCheck = this.performSecurityChecks(req, validation.tokenData);
      if (!securityCheck.passed) {
        return res.status(403).json({ error: securityCheck.error });
      }

      // Determine content quality based on permissions
      const quality = validation.tokenData.permissions.quality;
      const canDownload = validation.tokenData.permissions.canDownload;

      // Set appropriate headers
      this.setProtectionHeaders(res, canDownload);

      // Serve content based on quality level
      if (quality === 'preview') {
        return await this.servePreviewContent(req, res, videoId, validation.tokenData);
      } else if (quality === 'standard' || quality === 'hd') {
        return await this.serveFullContent(req, res, videoId, validation.tokenData);
      }

    } catch (error) {
      console.error('Protected content serving error:', error);
      res.status(500).json({ error: 'Content serving failed' });
    }
  }

  // Perform additional security checks
  performSecurityChecks(req, tokenData) {
    // Check IP restriction if enabled
    if (this.settings.access.ipRestriction && tokenData.permissions.restrictToIp) {
      const clientIp = req.ip || req.connection.remoteAddress;
      if (clientIp !== tokenData.permissions.restrictToIp) {
        return { passed: false, error: 'IP address mismatch' };
      }
    }

    // Check referrer if specified
    if (tokenData.permissions.allowedReferrers) {
      const referrer = req.get('Referer') || '';
      const allowed = tokenData.permissions.allowedReferrers.some(ref => 
        referrer.includes(ref)
      );
      if (!allowed) {
        return { passed: false, error: 'Invalid referrer' };
      }
    }

    // Check user agent restrictions
    if (tokenData.permissions.blockedUserAgents) {
      const userAgent = req.get('User-Agent') || '';
      const blocked = tokenData.permissions.blockedUserAgents.some(ua => 
        userAgent.toLowerCase().includes(ua.toLowerCase())
      );
      if (blocked) {
        return { passed: false, error: 'Blocked user agent' };
      }
    }

    return { passed: true };
  }

  // Set protection headers
  setProtectionHeaders(res, canDownload = false) {
    // Prevent caching
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Content security headers
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    });

    // Download prevention headers
    if (!canDownload) {
      res.set({
        'Content-Disposition': 'inline',
        'X-Download-Options': 'noopen'
      });
    }
  }

  // Serve preview quality content
  async servePreviewContent(req, res, videoId, tokenData) {
    // Implementation would fetch and serve watermarked/reduced quality content
    console.log(`Serving preview content for video ${videoId}`);
    
    // This would integrate with your existing video serving logic
    // but apply watermarking and quality reduction
  }

  // Serve full quality content (for paid users)
  async serveFullContent(req, res, videoId, tokenData) {
    // Implementation would serve full quality content
    console.log(`Serving full content for video ${videoId}`);
    
    // This would integrate with your existing video serving logic
  }

  // Clean up expired tokens
  cleanupExpiredTokens() {
    const now = Date.now();
    for (const [token, data] of this.accessTokens.entries()) {
      if (now > data.permissions.expiresAt) {
        this.accessTokens.delete(token);
      }
    }
  }

  // Get protection statistics
  getStats() {
    return {
      activeTokens: this.accessTokens.size,
      watermarkCache: this.watermarkCache.size,
      protectedUrls: this.protectedUrls.size
    };
  }
}

// Create singleton instance
export const contentProtection = new ContentProtectionManager();

// Middleware for protecting video routes
export const protectContent = (requiredPermission = 'canStream') => {
  return async (req, res, next) => {
    try {
      const token = req.query.token || req.headers['x-access-token'];
      
      if (!token) {
        return res.status(401).json({ error: 'Access token required' });
      }

      const validation = contentProtection.validateAccessToken(token, requiredPermission);
      
      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      // Add token data to request
      req.tokenData = validation.tokenData;
      req.remainingUses = validation.remainingUses;
      
      next();
    } catch (error) {
      console.error('Content protection middleware error:', error);
      res.status(500).json({ error: 'Protection validation failed' });
    }
  };
};

// Cleanup interval
setInterval(() => {
  contentProtection.cleanupExpiredTokens();
}, 5 * 60 * 1000); // Every 5 minutes

export default contentProtection;