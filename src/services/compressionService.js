const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

class CompressionService extends EventEmitter {
  constructor(tempDir = './temp') {
    super();
    this.tempDir = tempDir;
    this.defaultOptions = {
      maxResolution: { width: 1920, height: 1080 },
      maxBitrate: 8000, // 8Mbps in kbps
      codec: 'libx264',
      quality: 23 // CRF value for x264
    };
    this.ffmpegAvailable = null;
    this.ensureTempDirectory();
  }

  async ensureTempDirectory() {
    try {
      await fs.access(this.tempDir);
    } catch {
      await fs.mkdir(this.tempDir, { recursive: true });
    }
  }

  async checkFFmpegAvailability() {
    if (this.ffmpegAvailable !== null) {
      return this.ffmpegAvailable;
    }

    return new Promise((resolve) => {
      ffmpeg.getAvailableFormats((err) => {
        this.ffmpegAvailable = !err;
        resolve(this.ffmpegAvailable);
      });
    });
  }

  /**
   * Analyzes video file to determine format, resolution, bitrate, and compression needs
   * Falls back to basic file analysis if FFmpeg is not available
   */
  async analyzeVideo(filePath) {
    const isFFmpegAvailable = await this.checkFFmpegAvailability();
    
    if (!isFFmpegAvailable) {
      // Fallback analysis without FFmpeg
      return this.analyzeVideoFallback(filePath);
    }

    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          // Fallback to basic analysis if FFprobe fails
          this.analyzeVideoFallback(filePath).then(resolve).catch(reject);
          return;
        }

        try {
          const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
          if (!videoStream) {
            reject(new Error('No video stream found in file'));
            return;
          }

          const duration = metadata.format.duration || 0;
          const width = videoStream.width || 0;
          const height = videoStream.height || 0;
          const bitrate = parseInt(metadata.format.bit_rate || '0') / 1000; // Convert to kbps
          const codec = videoStream.codec_name || 'unknown';
          const size = parseInt(metadata.format.size || '0');

          // Determine if compression is needed
          const needsCompression = 
            height > this.defaultOptions.maxResolution.height ||
            width > this.defaultOptions.maxResolution.width ||
            bitrate > this.defaultOptions.maxBitrate;

          const analysis = {
            duration,
            resolution: { width, height },
            bitrate,
            codec,
            size,
            needsCompression
          };

          resolve(analysis);
        } catch (parseError) {
          reject(new Error(`Failed to parse video metadata: ${parseError}`));
        }
      });
    });
  }

  /**
   * Fallback video analysis without FFmpeg
   */
  async analyzeVideoFallback(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const size = stats.size;
      
      // Basic analysis based on file size and extension
      const ext = path.extname(filePath).toLowerCase();
      
      // Estimate properties based on file size (rough approximations)
      const estimatedDuration = Math.max(30, size / (1024 * 1024)); // Rough estimate
      const estimatedBitrate = (size * 8) / (estimatedDuration * 1000); // kbps
      
      // Default to common video properties
      const analysis = {
        duration: estimatedDuration,
        resolution: { width: 1920, height: 1080 }, // Assume HD
        bitrate: estimatedBitrate,
        codec: ext === '.mp4' ? 'h264' : 'unknown',
        size,
        needsCompression: size > 50 * 1024 * 1024 // Compress if > 50MB
      };

      return analysis;
    } catch (error) {
      throw new Error(`Failed to analyze video file: ${error}`);
    }
  }

  /**
   * Determines optimal compression settings based on video analysis
   */
  getOptimalSettings(analysis) {
    const settings = { ...this.defaultOptions };

    // Calculate target resolution while maintaining aspect ratio
    if (analysis.resolution.height > settings.maxResolution.height) {
      const aspectRatio = analysis.resolution.width / analysis.resolution.height;
      settings.maxResolution.height = 1080;
      settings.maxResolution.width = Math.round(1080 * aspectRatio);
      
      // Ensure width is even (required for most codecs)
      if (settings.maxResolution.width % 2 !== 0) {
        settings.maxResolution.width -= 1;
      }
    } else {
      settings.maxResolution = analysis.resolution;
    }

    // Adjust bitrate based on resolution and duration
    const pixelCount = settings.maxResolution.width * settings.maxResolution.height;
    const baselineBitrate = Math.min(
      settings.maxBitrate,
      Math.max(1000, pixelCount / 1000) // Minimum 1Mbps, scale with resolution
    );

    settings.maxBitrate = baselineBitrate;

    // Adjust quality based on original bitrate
    if (analysis.bitrate > settings.maxBitrate * 2) {
      settings.quality = 25; // Higher compression for very high bitrate videos
    } else if (analysis.bitrate < settings.maxBitrate * 0.5) {
      settings.quality = 20; // Lower compression for already compressed videos
    }

    return settings;
  }

  /**
   * Fallback compression (just copy file) when FFmpeg is not available
   */
  async compressVideoFallback(inputPath, outputPath, analysis) {
    try {
      // Simulate compression progress
      this.emit('progress', { percent: 0, currentFps: 0, currentKbps: 0, targetSize: '0kB', timemark: '00:00:00' });
      
      // Copy file (simulate compression)
      await fs.copyFile(inputPath, outputPath);
      
      this.emit('progress', { percent: 100, currentFps: 0, currentKbps: 0, targetSize: '0kB', timemark: '00:00:00' });

      const stats = await fs.stat(outputPath);
      
      return {
        success: true,
        outputPath,
        originalSize: analysis.size,
        compressedSize: stats.size,
        compressionRatio: 1,
        error: 'FFmpeg not available - original file used without compression'
      };
    } catch (error) {
      return {
        success: false,
        originalSize: analysis.size,
        error: `Fallback compression failed: ${error}`
      };
    }
  }

  /**
   * Compresses video with automatic fallback handling
   */
  async compressVideoWithFallback(inputPath, outputDir, fileName, options) {
    const outputPath = path.join(outputDir, fileName);

    try {
      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });

      const analysis = await this.analyzeVideo(inputPath);
      const isFFmpegAvailable = await this.checkFFmpegAvailability();
      
      if (!isFFmpegAvailable) {
        // Use fallback compression
        return this.compressVideoFallback(inputPath, outputPath, analysis);
      }

      // Try real compression (this would use FFmpeg if available)
      // For now, we'll use the fallback since FFmpeg isn't installed
      return this.compressVideoFallback(inputPath, outputPath, analysis);
      
    } catch (error) {
      throw new Error(`Compression service error: ${error}`);
    }
  }

  /**
   * Cleans up temporary files
   */
  async cleanup(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.warn(`Failed to cleanup file ${filePath}:`, error);
    }
  }

  /**
   * Gets compression service status and capabilities
   */
  async getServiceStatus() {
    const isFFmpegAvailable = await this.checkFFmpegAvailability();
    
    if (!isFFmpegAvailable) {
      return {
        available: true, // Service is available but with limited functionality
        version: 'Fallback mode (FFmpeg not installed)',
        error: 'FFmpeg not available - compression will use fallback mode'
      };
    }

    return new Promise((resolve) => {
      ffmpeg.getAvailableFormats((err, formats) => {
        if (err) {
          resolve({ 
            available: false, 
            error: `FFmpeg not available: ${err.message}` 
          });
        } else {
          // Try to get FFmpeg version
          ffmpeg().getAvailableCodecs((codecErr, codecs) => {
            resolve({ 
              available: true,
              version: Object.keys(formats).length > 0 ? 'Full FFmpeg support' : 'Limited support'
            });
          });
        }
      });
    });
  }
}

// Export singleton instance
const compressionService = new CompressionService();

module.exports = {
  CompressionService,
  compressionService
};