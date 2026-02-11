import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set FFmpeg path
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

/**
 * HLS Transcoder Service
 * Converts videos to HLS format with encryption for secure streaming
 */
class HLSTranscoder {
  constructor(bucket) {
    this.bucket = bucket;
    this.tempDir = path.join(__dirname, '..', 'temp', 'hls');
  }

  /**
   * Generate encryption key for HLS segments
   */
  generateEncryptionKey() {
    return crypto.randomBytes(16);
  }

  /**
   * Generate key info file for HLS encryption
   */
  async generateKeyInfo(sessionId, encryptionKey) {
    const keyInfoDir = path.join(this.tempDir, sessionId);
    await fs.promises.mkdir(keyInfoDir, { recursive: true });

    const keyPath = path.join(keyInfoDir, 'enc.key');
    const keyInfoPath = path.join(keyInfoDir, 'enc.keyinfo');
    const keyUrl = `/api/hls/key/${sessionId}`;

    // Write encryption key
    await fs.promises.writeFile(keyPath, encryptionKey);

    // Write key info file
    // Format: key URI, key file path, IV (optional)
    const keyInfo = `${keyUrl}\n${keyPath}\n`;
    await fs.promises.writeFile(keyInfoPath, keyInfo);

    return { keyPath, keyInfoPath, keyUrl };
  }

  /**
   * Transcode video to HLS format with encryption
   * @param {string} inputPath - Path to input video file
   * @param {string} sessionId - Unique session ID for this transcode
   * @param {object} options - Transcoding options
   * @returns {Promise<object>} - Transcode result with playlist path
   */
  async transcodeToHLS(inputPath, sessionId, options = {}) {
    const {
      resolutions = [
        { name: '360p', width: 640, height: 360, bitrate: '800k' },
        { name: '720p', width: 1280, height: 720, bitrate: '2500k' }
      ],
      segmentDuration = 6, // 6 second segments
      encrypt = true
    } = options;

    const outputDir = path.join(this.tempDir, sessionId);
    await fs.promises.mkdir(outputDir, { recursive: true });

    let encryptionKey = null;
    let keyInfo = null;

    if (encrypt) {
      encryptionKey = this.generateEncryptionKey();
      keyInfo = await this.generateKeyInfo(sessionId, encryptionKey);
    }

    // Create master playlist
    const masterPlaylistPath = path.join(outputDir, 'master.m3u8');
    const masterPlaylistContent = ['#EXTM3U', '#EXT-X-VERSION:3'];

    // Transcode each resolution
    for (const resolution of resolutions) {
      const variantName = resolution.name;
      const variantPath = path.join(outputDir, `${variantName}.m3u8`);
      const segmentPattern = path.join(outputDir, `${variantName}_%03d.ts`);

      await this.transcodeVariant(
        inputPath,
        variantPath,
        segmentPattern,
        resolution,
        segmentDuration,
        keyInfo
      );

      // Add variant to master playlist
      masterPlaylistContent.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(resolution.bitrate) * 1000},RESOLUTION=${resolution.width}x${resolution.height}`,
        `${variantName}.m3u8`
      );
    }

    // Write master playlist
    await fs.promises.writeFile(masterPlaylistPath, masterPlaylistContent.join('\n'));

    return {
      sessionId,
      masterPlaylistPath,
      outputDir,
      encryptionKey: encryptionKey ? encryptionKey.toString('hex') : null,
      resolutions: resolutions.map(r => r.name)
    };
  }

  /**
   * Transcode a single variant (resolution)
   */
  async transcodeVariant(inputPath, playlistPath, segmentPattern, resolution, segmentDuration, keyInfo) {
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath)
        .outputOptions([
          '-c:v libx264',
          '-c:a aac',
          `-b:v ${resolution.bitrate}`,
          '-b:a 128k',
          `-vf scale=${resolution.width}:${resolution.height}`,
          '-preset fast',
          '-g 48', // GOP size
          '-sc_threshold 0',
          '-f hls',
          `-hls_time ${segmentDuration}`,
          '-hls_playlist_type vod',
          '-hls_segment_filename', segmentPattern
        ]);

      // Add encryption if key info provided
      if (keyInfo) {
        command = command.outputOptions([
          '-hls_key_info_file', keyInfo.keyInfoPath
        ]);
      }

      command
        .output(playlistPath)
        .on('start', (commandLine) => {
          console.log(`FFmpeg command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`Transcoding ${resolution.name}: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          console.log(`Transcoding ${resolution.name} completed`);
          resolve();
        })
        .on('error', (err) => {
          console.error(`Transcoding ${resolution.name} error:`, err);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Upload HLS files to GCS
   */
  async uploadToGCS(sessionId, outputDir, videoId) {
    const files = await fs.promises.readdir(outputDir);
    const uploadPromises = [];

    for (const file of files) {
      const filePath = path.join(outputDir, file);
      const gcsPath = `hls/${videoId}/${file}`;

      const uploadPromise = this.bucket.upload(filePath, {
        destination: gcsPath,
        metadata: {
          contentType: file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/MP2T',
          cacheControl: 'public, max-age=3600'
        }
      });

      uploadPromises.push(uploadPromise);
    }

    await Promise.all(uploadPromises);

    return {
      masterPlaylistUrl: `hls/${videoId}/master.m3u8`,
      videoId,
      segmentCount: files.filter(f => f.endsWith('.ts')).length
    };
  }

  /**
   * Clean up temporary files
   */
  async cleanup(sessionId) {
    const outputDir = path.join(this.tempDir, sessionId);
    try {
      await fs.promises.rm(outputDir, { recursive: true, force: true });
      console.log(`Cleaned up HLS temp files for session: ${sessionId}`);
    } catch (error) {
      console.error(`Error cleaning up HLS temp files:`, error);
    }
  }

  /**
   * Get encryption key for a session
   */
  async getEncryptionKey(sessionId) {
    const keyPath = path.join(this.tempDir, sessionId, 'enc.key');
    try {
      return await fs.promises.readFile(keyPath);
    } catch (error) {
      console.error(`Error reading encryption key:`, error);
      return null;
    }
  }
}

export default HLSTranscoder;
