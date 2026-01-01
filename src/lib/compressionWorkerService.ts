export interface CompressionOptions {
  resolution?: '720p' | '480p' | '360p';
  crf?: number;
  preset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow';
  audioBitrate?: string;
}

export interface CompressionProgress {
  progress: number;
  originalSize: number;
  estimatedSize?: number;
}

export interface CompressionResult {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  duration: number;
}

class CompressionWorkerService {
  private worker: Worker | null = null;
  private isInitialized = false;
  private isInitializing = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.isInitializing) {
      // Wait for existing initialization
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.isInitializing = true;

    try {
      // Create worker
      this.worker = new Worker('/compression-worker.js', { type: 'module' });
      
      // Wait for initialization
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Worker initialization timeout'));
        }, 30000); // 30 second timeout

        this.worker!.onmessage = (e) => {
          const { type, error } = e.data;
          
          if (type === 'initialized') {
            clearTimeout(timeout);
            resolve();
          } else if (type === 'error') {
            clearTimeout(timeout);
            reject(new Error(error));
          }
        };

        this.worker!.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };

        // Start initialization
        this.worker!.postMessage({ type: 'initialize' });
      });

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize compression worker:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  async compressVideo(
    file: File,
    options: CompressionOptions = {},
    onProgress?: (progress: CompressionProgress) => void
  ): Promise<CompressionResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.worker) {
      throw new Error('Compression worker not available');
    }

    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Compression timeout'));
      }, 10 * 60 * 1000); // 10 minute timeout

      this.worker!.onmessage = (e) => {
        const { type, progress, data, originalSize, compressedSize, error } = e.data;

        switch (type) {
          case 'progress':
            if (onProgress) {
              onProgress({
                progress,
                originalSize: file.size
              });
            }
            break;

          case 'completed':
            clearTimeout(timeout);
            
            // Create compressed file
            const compressedBlob = new Blob([data], { type: 'video/mp4' });
            const compressedFile = new File(
              [compressedBlob], 
              this.generateCompressedFileName(file.name),
              { type: 'video/mp4' }
            );

            const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;
            const duration = (Date.now() - startTime) / 1000;

            resolve({
              compressedFile,
              originalSize,
              compressedSize,
              compressionRatio,
              duration
            });
            break;

          case 'error':
            clearTimeout(timeout);
            reject(new Error(error));
            break;
        }
      };

      this.worker!.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };

      // Start compression
      this.worker!.postMessage({
        type: 'compress',
        data: { file, options }
      });
    });
  }

  private generateCompressedFileName(originalName: string): string {
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
    return `${nameWithoutExt}_compressed.mp4`;
  }

  shouldCompress(file: File): boolean {
    // Skip compression for small files
    const minSizeForCompression = 50 * 1024 * 1024; // 50MB
    return file.size > minSizeForCompression && file.type.startsWith('video/');
  }

  getCompressionEstimate(fileSize: number): {
    estimatedSize: number;
    estimatedTime: number;
  } {
    // Estimates based on typical compression performance
    const compressionRatio = 0.3; // 70% reduction for draft quality
    const processingSpeed = 1.5 * 1024 * 1024; // ~1.5MB/s (conservative for web worker)
    
    return {
      estimatedSize: Math.round(fileSize * compressionRatio),
      estimatedTime: Math.round(fileSize / processingSpeed)
    };
  }

  terminate(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'terminate' });
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }

  // Check if compression is supported
  static isSupported(): boolean {
    return typeof Worker !== 'undefined' && 'SharedArrayBuffer' in window;
  }

  // Get device performance tier for adaptive compression
  getDevicePerformanceTier(): 'low' | 'medium' | 'high' {
    const cores = navigator.hardwareConcurrency || 2;
    const memory = (navigator as any).deviceMemory || 4;

    if (cores >= 8 && memory >= 8) return 'high';
    if (cores >= 4 && memory >= 4) return 'medium';
    return 'low';
  }

  // Get adaptive compression options based on device
  getAdaptiveCompressionOptions(fileSize: number): CompressionOptions {
    const tier = this.getDevicePerformanceTier();
    const isLargeFile = fileSize > 500 * 1024 * 1024; // 500MB

    switch (tier) {
      case 'high':
        return {
          resolution: '720p',
          crf: isLargeFile ? 30 : 28,
          preset: 'fast',
          audioBitrate: '128k'
        };
      
      case 'medium':
        return {
          resolution: '720p',
          crf: isLargeFile ? 32 : 30,
          preset: 'veryfast',
          audioBitrate: '96k'
        };
      
      case 'low':
        return {
          resolution: isLargeFile ? '480p' : '720p',
          crf: 32,
          preset: 'ultrafast',
          audioBitrate: '96k'
        };
    }
  }
}

// Export singleton instance
export const compressionWorkerService = new CompressionWorkerService();