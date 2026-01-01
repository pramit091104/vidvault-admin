import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export interface CompressionOptions {
  resolution?: '720p' | '480p' | '360p';
  crf?: number; // 18-28 (lower = better quality)
  preset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow';
  audioBitrate?: string;
}

export interface CompressionProgress {
  progress: number; // 0-100
  timeRemaining?: number; // seconds
  currentSize?: number; // bytes
  originalSize: number; // bytes
}

export interface CompressionResult {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  duration: number; // seconds
}

class VideoCompressionService {
  private ffmpeg: FFmpeg | null = null;
  private isLoaded = false;
  private isLoading = false;

  async initialize(): Promise<void> {
    if (this.isLoaded) return;
    if (this.isLoading) {
      // Wait for existing initialization
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.isLoading = true;
    
    try {
      this.ffmpeg = new FFmpeg();
      
      // Load FFmpeg with CDN URLs
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.isLoaded = true;
    } catch (error) {
      console.error('Failed to initialize FFmpeg:', error);
      throw new Error('Failed to initialize video compression engine');
    } finally {
      this.isLoading = false;
    }
  }

  async compressVideo(
    file: File,
    options: CompressionOptions = {},
    onProgress?: (progress: CompressionProgress) => void
  ): Promise<CompressionResult> {
    if (!this.isLoaded) {
      await this.initialize();
    }

    if (!this.ffmpeg) {
      throw new Error('FFmpeg not initialized');
    }

    const startTime = Date.now();
    const originalSize = file.size;

    // Default compression settings for drafts
    const {
      resolution = '720p',
      crf = 28,
      preset = 'veryfast',
      audioBitrate = '128k'
    } = options;

    try {
      // Write input file
      const inputName = 'input.mp4';
      const outputName = 'output.mp4';
      
      await this.ffmpeg.writeFile(inputName, await fetchFile(file));

      // Build FFmpeg command for draft compression
      const resolutionFilter = this.getResolutionFilter(resolution);
      const command = [
        '-i', inputName,
        '-c:v', 'libx264',
        '-preset', preset,
        '-crf', crf.toString(),
        '-vf', resolutionFilter,
        '-c:a', 'aac',
        '-b:a', audioBitrate,
        '-movflags', '+faststart', // Optimize for web playback
        '-y', // Overwrite output
        outputName
      ];

      // Set up progress tracking
      let lastProgress = 0;
      this.ffmpeg.on('progress', ({ progress }) => {
        const currentProgress = Math.round(progress * 100);
        if (currentProgress > lastProgress) {
          lastProgress = currentProgress;
          
          if (onProgress) {
            const elapsed = (Date.now() - startTime) / 1000;
            const timeRemaining = progress > 0 ? (elapsed / progress) * (1 - progress) : undefined;
            
            onProgress({
              progress: currentProgress,
              timeRemaining,
              originalSize
            });
          }
        }
      });

      // Execute compression
      await this.ffmpeg.exec(command);

      // Read compressed file
      const data = await this.ffmpeg.readFile(outputName);
      const compressedBlob = new Blob([data], { type: 'video/mp4' });
      const compressedFile = new File([compressedBlob], this.generateCompressedFileName(file.name), {
        type: 'video/mp4'
      });

      // Clean up
      await this.ffmpeg.deleteFile(inputName);
      await this.ffmpeg.deleteFile(outputName);

      const compressedSize = compressedFile.size;
      const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;
      const duration = (Date.now() - startTime) / 1000;

      return {
        compressedFile,
        originalSize,
        compressedSize,
        compressionRatio,
        duration
      };

    } catch (error) {
      console.error('Video compression failed:', error);
      throw new Error('Video compression failed. Please try again.');
    }
  }

  private getResolutionFilter(resolution: string): string {
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

  private generateCompressedFileName(originalName: string): string {
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
    return `${nameWithoutExt}_compressed.mp4`;
  }

  shouldCompress(file: File): boolean {
    // Skip compression for small files
    const minSizeForCompression = 50 * 1024 * 1024; // 50MB
    return file.size > minSizeForCompression;
  }

  getCompressionEstimate(fileSize: number): {
    estimatedSize: number;
    estimatedTime: number; // seconds
  } {
    // Rough estimates based on typical compression ratios
    const compressionRatio = 0.3; // 70% reduction typical for draft quality
    const processingSpeed = 2 * 1024 * 1024; // ~2MB/s processing speed
    
    return {
      estimatedSize: Math.round(fileSize * compressionRatio),
      estimatedTime: Math.round(fileSize / processingSpeed)
    };
  }

  terminate(): void {
    if (this.ffmpeg) {
      this.ffmpeg.terminate();
      this.ffmpeg = null;
      this.isLoaded = false;
    }
  }
}

// Export singleton instance
export const videoCompressionService = new VideoCompressionService();