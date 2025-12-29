import { VideoAnalysis, CompressionOptions, CompressionResult } from './compressionService';

export interface CompressionProgress {
  percent: number;
  stage: 'analyzing' | 'compressing' | 'uploading' | 'complete';
  message: string;
}

export class VideoCompressionService {
  private readonly baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Analyzes a video file to determine compression needs
   */
  async analyzeVideo(file: File): Promise<{ analysis: VideoAnalysis; recommendations: CompressionOptions }> {
    const formData = new FormData();
    formData.append('video', file);

    const response = await fetch(`${this.baseUrl}/api/video/analyze`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Video analysis failed');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error('Video analysis failed');
    }

    return {
      analysis: result.analysis,
      recommendations: result.recommendations
    };
  }

  /**
   * Compresses a video file with optional custom settings
   */
  async compressVideo(
    file: File, 
    options?: Partial<CompressionOptions>,
    onProgress?: (progress: CompressionProgress) => void
  ): Promise<CompressionResult & { compressedFile?: File }> {
    const formData = new FormData();
    formData.append('video', file);
    
    if (options) {
      formData.append('options', JSON.stringify(options));
    }

    // Notify progress - analyzing stage
    onProgress?.({
      percent: 0,
      stage: 'analyzing',
      message: 'Analyzing video file...'
    });

    // Notify progress - compressing stage
    onProgress?.({
      percent: 10,
      stage: 'compressing',
      message: 'Starting compression...'
    });

    const response = await fetch(`${this.baseUrl}/api/video/compress`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Video compression failed');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Video compression failed');
    }

    // Notify progress - complete
    onProgress?.({
      percent: 100,
      stage: 'complete',
      message: 'Compression complete!'
    });

    // Convert base64 back to File if compressed data is provided
    let compressedFile: File | undefined;
    if (result.result.compressedData) {
      const compressedBuffer = Uint8Array.from(atob(result.result.compressedData), c => c.charCodeAt(0));
      compressedFile = new File([compressedBuffer], result.result.fileName, {
        type: file.type
      });
    }

    return {
      ...result.result,
      compressedFile
    };
  }

  /**
   * Checks if the compression service is available
   */
  async checkServiceStatus(): Promise<{ available: boolean; version?: string; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/video/compression-status`);
      
      if (!response.ok) {
        return { available: false, error: 'Service unavailable' };
      }

      return await response.json();
    } catch (error) {
      return { 
        available: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Determines if a video file should be compressed based on size and type
   */
  shouldCompress(file: File): boolean {
    // Compress videos larger than 50MB or with certain characteristics
    const sizeLimitMB = 50;
    const sizeLimitBytes = sizeLimitMB * 1024 * 1024;
    
    return file.size > sizeLimitBytes && file.type.startsWith('video/');
  }

  /**
   * Gets recommended compression settings based on file size and type
   */
  getRecommendedSettings(file: File): Partial<CompressionOptions> {
    const fileSizeMB = file.size / (1024 * 1024);
    
    if (fileSizeMB > 500) {
      // Very large files - aggressive compression
      return {
        maxResolution: { width: 1280, height: 720 },
        maxBitrate: 4000,
        quality: 28
      };
    } else if (fileSizeMB > 200) {
      // Large files - moderate compression
      return {
        maxResolution: { width: 1920, height: 1080 },
        maxBitrate: 6000,
        quality: 25
      };
    } else {
      // Standard compression
      return {
        maxResolution: { width: 1920, height: 1080 },
        maxBitrate: 8000,
        quality: 23
      };
    }
  }

  /**
   * Formats file size for display
   */
  formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Calculates compression savings
   */
  calculateSavings(originalSize: number, compressedSize: number): {
    savedBytes: number;
    savedPercentage: number;
    compressionRatio: number;
  } {
    const savedBytes = originalSize - compressedSize;
    const savedPercentage = (savedBytes / originalSize) * 100;
    const compressionRatio = compressedSize / originalSize;

    return {
      savedBytes,
      savedPercentage,
      compressionRatio
    };
  }
}

// Export singleton instance
export const videoCompressionService = new VideoCompressionService();