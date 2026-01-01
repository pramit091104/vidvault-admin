// Video Compression Web Worker
// This runs FFmpeg in a separate thread to prevent UI blocking

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg = null;
let isLoaded = false;

// Initialize FFmpeg
async function initializeFFmpeg() {
  if (isLoaded) return;
  
  try {
    ffmpeg = new FFmpeg();
    
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    isLoaded = true;
    
    // Set up progress reporting
    ffmpeg.on('progress', ({ progress }) => {
      self.postMessage({
        type: 'progress',
        progress: Math.round(progress * 100)
      });
    });

    self.postMessage({ type: 'initialized' });
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      error: `Failed to initialize FFmpeg: ${error.message}` 
    });
  }
}

// Compress video
async function compressVideo(file, options) {
  if (!isLoaded) {
    throw new Error('FFmpeg not initialized');
  }

  const {
    resolution = '720p',
    crf = 28,
    preset = 'veryfast',
    audioBitrate = '128k'
  } = options;

  try {
    const inputName = 'input.mp4';
    const outputName = 'output.mp4';
    
    // Write input file
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // Build compression command
    const resolutionFilter = getResolutionFilter(resolution);
    const command = [
      '-i', inputName,
      '-c:v', 'libx264',
      '-preset', preset,
      '-crf', crf.toString(),
      '-vf', resolutionFilter,
      '-c:a', 'aac',
      '-b:a', audioBitrate,
      '-movflags', '+faststart',
      '-y',
      outputName
    ];

    // Execute compression
    await ffmpeg.exec(command);

    // Read compressed file
    const data = await ffmpeg.readFile(outputName);
    
    // Clean up
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    // Return compressed data
    self.postMessage({
      type: 'completed',
      data: data,
      originalSize: file.size,
      compressedSize: data.length
    });

  } catch (error) {
    self.postMessage({
      type: 'error',
      error: `Compression failed: ${error.message}`
    });
  }
}

function getResolutionFilter(resolution) {
  switch (resolution) {
    case '720p':
      return 'scale=-2:720';
    case '480p':
      return 'scale=-2:480';
    case '360p':
      return 'scale=-2:360';
    default:
      return 'scale=-2:720';
  }
}

// Handle messages from main thread
self.onmessage = async function(e) {
  const { type, data } = e.data;

  switch (type) {
    case 'initialize':
      await initializeFFmpeg();
      break;
      
    case 'compress':
      await compressVideo(data.file, data.options);
      break;
      
    case 'terminate':
      if (ffmpeg) {
        ffmpeg.terminate();
        ffmpeg = null;
        isLoaded = false;
      }
      self.close();
      break;
      
    default:
      self.postMessage({
        type: 'error',
        error: `Unknown message type: ${type}`
      });
  }
};