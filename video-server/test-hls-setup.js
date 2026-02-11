/**
 * HLS Setup Test Script
 * Run this to verify HLS implementation is working correctly
 */

import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function testFFmpegInstallation() {
  log('\n=== Testing FFmpeg Installation ===', 'cyan');
  
  try {
    if (!ffmpegPath) {
      error('FFmpeg static path not found');
      return false;
    }
    
    success(`FFmpeg static path: ${ffmpegPath}`);
    
    // Test FFmpeg execution
    const { stdout } = await execAsync(`"${ffmpegPath}" -version`);
    const version = stdout.split('\n')[0];
    success(`FFmpeg version: ${version}`);
    
    // Check for required codecs
    if (stdout.includes('libx264')) {
      success('H.264 codec available');
    } else {
      warning('H.264 codec not found');
    }
    
    if (stdout.includes('aac')) {
      success('AAC codec available');
    } else {
      warning('AAC codec not found');
    }
    
    return true;
  } catch (err) {
    error(`FFmpeg test failed: ${err.message}`);
    return false;
  }
}

async function testFluentFFmpeg() {
  log('\n=== Testing Fluent-FFmpeg ===', 'cyan');
  
  try {
    // Set FFmpeg path
    ffmpeg.setFfmpegPath(ffmpegPath);
    success('Fluent-FFmpeg configured with static FFmpeg');
    
    // Test getting available formats
    return new Promise((resolve) => {
      ffmpeg.getAvailableFormats((err, formats) => {
        if (err) {
          error(`Failed to get formats: ${err.message}`);
          resolve(false);
          return;
        }
        
        if (formats.hls) {
          success('HLS format available');
          resolve(true);
        } else {
          warning('HLS format not found in available formats');
          resolve(false);
        }
      });
    });
  } catch (err) {
    error(`Fluent-FFmpeg test failed: ${err.message}`);
    return false;
  }
}

async function testTempDirectory() {
  log('\n=== Testing Temp Directory ===', 'cyan');
  
  try {
    const tempDir = path.join(__dirname, 'temp', 'hls');
    
    // Create temp directory
    await fs.promises.mkdir(tempDir, { recursive: true });
    success(`Temp directory created: ${tempDir}`);
    
    // Test write permissions
    const testFile = path.join(tempDir, 'test.txt');
    await fs.promises.writeFile(testFile, 'test');
    success('Write permissions OK');
    
    // Test read permissions
    await fs.promises.readFile(testFile);
    success('Read permissions OK');
    
    // Cleanup
    await fs.promises.unlink(testFile);
    success('Cleanup successful');
    
    return true;
  } catch (err) {
    error(`Temp directory test failed: ${err.message}`);
    return false;
  }
}

async function testGCSConfiguration() {
  log('\n=== Testing GCS Configuration ===', 'cyan');
  
  try {
    const requiredEnvVars = [
      'GCS_BUCKET_NAME',
      'GCS_PROJECT_ID',
      'GCS_CREDENTIALS'
    ];
    
    let allPresent = true;
    
    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        success(`${envVar} is set`);
      } else {
        error(`${envVar} is missing`);
        allPresent = false;
      }
    }
    
    if (allPresent && process.env.GCS_CREDENTIALS) {
      try {
        const credentials = JSON.parse(process.env.GCS_CREDENTIALS);
        if (credentials.project_id && credentials.client_email && credentials.private_key) {
          success('GCS credentials are valid JSON with required fields');
        } else {
          warning('GCS credentials JSON is missing some fields');
        }
      } catch (err) {
        error('GCS credentials are not valid JSON');
        allPresent = false;
      }
    }
    
    return allPresent;
  } catch (err) {
    error(`GCS configuration test failed: ${err.message}`);
    return false;
  }
}

async function testHLSModules() {
  log('\n=== Testing HLS Modules ===', 'cyan');
  
  try {
    // Test HLS transcoder
    try {
      const HLSTranscoder = await import('./services/hlsTranscoder.js');
      success('HLS Transcoder module loaded');
    } catch (err) {
      error(`Failed to load HLS Transcoder: ${err.message}`);
      return false;
    }
    
    // Test HLS stream handler
    try {
      const hlsStreamHandler = await import('./api/hls/stream.js');
      success('HLS Stream Handler module loaded');
    } catch (err) {
      error(`Failed to load HLS Stream Handler: ${err.message}`);
      return false;
    }
    
    // Test HLS transcode handler
    try {
      const hlsTranscodeHandler = await import('./api/hls/transcode.js');
      success('HLS Transcode Handler module loaded');
    } catch (err) {
      error(`Failed to load HLS Transcode Handler: ${err.message}`);
      return false;
    }
    
    return true;
  } catch (err) {
    error(`HLS modules test failed: ${err.message}`);
    return false;
  }
}

async function testDependencies() {
  log('\n=== Testing Dependencies ===', 'cyan');
  
  const dependencies = [
    'fluent-ffmpeg',
    'ffmpeg-static',
    '@google-cloud/storage',
    'crypto',
    'fs',
    'path'
  ];
  
  let allPresent = true;
  
  for (const dep of dependencies) {
    try {
      await import(dep);
      success(`${dep} is installed`);
    } catch (err) {
      error(`${dep} is missing`);
      allPresent = false;
    }
  }
  
  return allPresent;
}

async function runAllTests() {
  log('\n╔════════════════════════════════════════╗', 'cyan');
  log('║   HLS Implementation Test Suite       ║', 'cyan');
  log('╚════════════════════════════════════════╝', 'cyan');
  
  const results = {
    dependencies: await testDependencies(),
    ffmpeg: await testFFmpegInstallation(),
    fluentFFmpeg: await testFluentFFmpeg(),
    tempDir: await testTempDirectory(),
    gcs: await testGCSConfiguration(),
    modules: await testHLSModules()
  };
  
  log('\n=== Test Summary ===', 'cyan');
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  for (const [test, result] of Object.entries(results)) {
    if (result) {
      success(`${test}: PASSED`);
    } else {
      error(`${test}: FAILED`);
    }
  }
  
  log(`\n${passed}/${total} tests passed`, passed === total ? 'green' : 'yellow');
  
  if (passed === total) {
    log('\n🎉 All tests passed! HLS implementation is ready to use.', 'green');
    log('\nNext steps:', 'cyan');
    info('1. Upload a test video');
    info('2. Transcode it using: POST /api/hls/transcode');
    info('3. Play it using the HLSVideoPlayer component');
    info('4. Check the network tab to see encrypted segments');
  } else {
    log('\n⚠️  Some tests failed. Please fix the issues above.', 'yellow');
    log('\nCommon fixes:', 'cyan');
    info('1. Run: npm install (in video-server directory)');
    info('2. Set GCS environment variables in .env file');
    info('3. Ensure temp directory has write permissions');
    info('4. Check FFmpeg installation');
  }
  
  return passed === total;
}

// Run tests
runAllTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    error(`Test suite failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  });
