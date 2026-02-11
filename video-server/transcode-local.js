/**
 * Local Video Transcoding Script
 * Use this to transcode videos on your local machine and upload to GCS
 * 
 * Usage: node transcode-local.js <videoId> <inputPath>
 * Example: node transcode-local.js video-123 ./uploads/video.mp4
 */

import dotenv from 'dotenv';
import { Storage } from '@google-cloud/storage';
import HLSTranscoder from './services/hlsTranscoder.js';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      error('Usage: node transcode-local.js <videoId> <inputPath>');
      error('Example: node transcode-local.js video-123 ./uploads/video.mp4');
      process.exit(1);
    }

    const [videoId, inputPath] = args;

    log('\n╔════════════════════════════════════════╗', 'cyan');
    log('║   Local HLS Transcoding Script        ║', 'cyan');
    log('╚════════════════════════════════════════╝', 'cyan');
    
    info(`\nVideo ID: ${videoId}`);
    info(`Input Path: ${inputPath}`);

    // Initialize GCS
    log('\n📦 Initializing Google Cloud Storage...', 'cyan');
    
    if (!process.env.GCS_BUCKET_NAME || !process.env.GCS_PROJECT_ID || !process.env.GCS_CREDENTIALS) {
      error('Missing GCS configuration in .env file');
      error('Required: GCS_BUCKET_NAME, GCS_PROJECT_ID, GCS_CREDENTIALS');
      process.exit(1);
    }

    let credentials = JSON.parse(process.env.GCS_CREDENTIALS);
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    const storage = new Storage({
      projectId: process.env.GCS_PROJECT_ID,
      credentials: credentials
    });
    const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

    success('GCS initialized');

    // Initialize transcoder
    log('\n🎬 Initializing HLS Transcoder...', 'cyan');
    const transcoder = new HLSTranscoder(bucket);
    success('Transcoder initialized');

    // Generate session ID
    const sessionId = crypto.randomUUID();
    info(`Session ID: ${sessionId}`);

    // Transcode video
    log('\n⚙️  Starting transcoding...', 'cyan');
    info('This may take a while (approximately 3x video duration)');
    info('Progress will be shown below:\n');

    const transcodeResult = await transcoder.transcodeToHLS(inputPath, sessionId, {
      resolutions: [
        { name: '360p', width: 640, height: 360, bitrate: '800k' },
        { name: '720p', width: 1280, height: 720, bitrate: '2500k' }
      ],
      segmentDuration: 6,
      encrypt: true
    });

    success('Transcoding completed!');
    info(`Master playlist: ${transcodeResult.masterPlaylistPath}`);
    info(`Output directory: ${transcodeResult.outputDir}`);
    info(`Resolutions: ${transcodeResult.resolutions.join(', ')}`);
    info(`Encrypted: ${transcodeResult.encryptionKey ? 'Yes' : 'No'}`);

    // Upload to GCS
    log('\n☁️  Uploading to Google Cloud Storage...', 'cyan');
    const uploadResult = await transcoder.uploadToGCS(
      sessionId,
      transcodeResult.outputDir,
      videoId
    );

    success('Upload completed!');
    info(`HLS Path: ${uploadResult.masterPlaylistUrl}`);
    info(`Segment Count: ${uploadResult.segmentCount}`);

    // Cleanup temp files
    log('\n🧹 Cleaning up temporary files...', 'cyan');
    await transcoder.cleanup(sessionId);
    success('Cleanup completed');

    // Summary
    log('\n╔════════════════════════════════════════╗', 'green');
    log('║   Transcoding Successful!              ║', 'green');
    log('╚════════════════════════════════════════╝', 'green');
    
    log('\n📊 Summary:', 'cyan');
    success(`Video ID: ${videoId}`);
    success(`HLS Path: ${uploadResult.masterPlaylistUrl}`);
    success(`Segments: ${uploadResult.segmentCount}`);
    success(`Resolutions: 360p, 720p`);
    success(`Encrypted: Yes`);

    log('\n🎯 Next Steps:', 'cyan');
    info('1. Update your video record with the HLS path');
    info('2. Use <HLSVideoPlayer> component to play the video');
    info('3. Check the network tab to see encrypted segments');

    log('\n💡 Update Video Record:', 'cyan');
    log(`
    await updateVideo('${videoId}', {
      hlsPath: '${uploadResult.masterPlaylistUrl}',
      hasHLS: true,
      hlsSegmentCount: ${uploadResult.segmentCount}
    });
    `, 'yellow');

    log('\n🎉 Done!\n', 'green');

  } catch (err) {
    error(`\nTranscoding failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

// Run the script
main();
