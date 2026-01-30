import crypto from 'crypto';

// Advanced URL obfuscation and network tab protection
class URLObfuscationManager {
  constructor() {
    this.activeStreams = new Map();
    this.urlSegments = new Map();
    this.rotationInterval = 30000; // 30 seconds
    
    // Start URL rotation
    setInterval(() => {
      this.rotateActiveUrls();
    }, this.rotationInterval);
  }

  // Generate obfuscated streaming endpoint that changes frequently
  generateObfuscatedUrl(videoId, userId) {
    const timestamp = Date.now();
    const sessionId = crypto.randomBytes(16).toString('hex');
    
    // Create multiple layers of obfuscation
    const segments = {
      a: crypto.randomBytes(8).toString('hex'), // Random segment
      b: Buffer.from(videoId).toString('base64url'), // Encoded video ID
      c: crypto.randomBytes(8).toString('hex'), // Random segment
      d: Buffer.from(userId.substring(0, 8)).toString('base64url'), // Encoded user ID
      e: crypto.randomBytes(8).toString('hex'), // Random segment
      t: timestamp.toString(36), // Timestamp in base36
      f: crypto.randomBytes(8).toString('hex') // Random segment
    };

    // Create signature
    const dataToSign = `${segments.b}:${segments.d}:${segments.t}`;
    const signature = crypto
      .createHmac('sha256', process.env.URL_OBFUSCATION_SECRET || 'default-secret')
      .update(dataToSign)
      .digest('hex')
      .substring(0, 16);

    // Store segment mapping
    this.urlSegments.set(sessionId, {
      videoId,
      userId,
      timestamp,
      signature,
      segments,
      expiresAt: timestamp + 300000 // 5 minutes
    });

    // Generate obfuscated path that looks like a regular API endpoint
    const obfuscatedPath = `/api/media/stream/${segments.a}/${segments.b}/${segments.c}/${segments.d}/${segments.e}/${segments.t}/${segments.f}/${signature}`;
    
    return {
      sessionId,
      obfuscatedUrl: obfuscatedPath,
      expiresAt: timestamp + 300000
    };
  }

  // Decode obfuscated URL
  decodeObfuscatedUrl(path) {
    try {
      const pathParts = path.split('/');
      if (pathParts.length !== 10 || pathParts[1] !== 'api' || pathParts[2] !== 'media' || pathParts[3] !== 'stream') {
        return null;
      }

      const [, , , , a, b, c, d, e, t, f, signature] = pathParts;
      
      // Decode segments
      const videoId = Buffer.from(b, 'base64url').toString();
      const userIdPart = Buffer.from(d, 'base64url').toString();
      const timestamp = parseInt(t, 36);

      // Verify signature
      const dataToSign = `${b}:${d}:${t}`;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.URL_OBFUSCATION_SECRET || 'default-secret')
        .update(dataToSign)
        .digest('hex')
        .substring(0, 16);

      if (signature !== expectedSignature) {
        return null;
      }

      // Check expiration
      if (Date.now() > timestamp + 300000) {
        return null;
      }

      return {
        videoId,
        userIdPart,
        timestamp,
        isValid: true
      };
    } catch (error) {
      return null;
    }
  }

  // Rotate active URLs to prevent network tab abuse
  rotateActiveUrls() {
    const now = Date.now();
    for (const [sessionId, data] of this.urlSegments.entries()) {
      if (now > data.expiresAt) {
        this.urlSegments.delete(sessionId);
      }
    }
  }

  // Generate blob URL with protection
  generateProtectedBlob(videoBuffer, mimeType = 'video/mp4') {
    // Add invisible watermark to blob data
    const watermarkedBuffer = this.addInvisibleWatermark(videoBuffer);
    
    // Create blob with custom MIME type to prevent direct saving
    const blob = new Blob([watermarkedBuffer], { 
      type: 'application/octet-stream' // Hide real MIME type
    });
    
    return URL.createObjectURL(blob);
  }

  // Add invisible watermark to video buffer
  addInvisibleWatermark(buffer) {
    // Add custom headers/metadata that identify the content as protected
    const watermarkData = Buffer.from('PREVIU_PROTECTED_CONTENT_DO_NOT_DISTRIBUTE', 'utf8');
    return Buffer.concat([watermarkData, buffer]);
  }
}

export const urlObfuscation = new URLObfuscationManager();
export default urlObfuscation;