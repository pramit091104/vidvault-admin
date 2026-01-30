// Simple direct upload service - no chunking, just works
import { UserSubscription } from '@/contexts/AuthContext';
import { uploadFileWithValidation } from '@/services/backendApiService';

export interface SimpleUploadOptions {
  file: File;
  metadata?: {
    title?: string;
    description?: string;
    clientName?: string;
  };
  onProgress?: (progress: number) => void;
  subscription?: UserSubscription;
}

export interface SimpleUploadResult {
  success: boolean;
  uploadId?: string;
  fileName?: string;
  gcsPath?: string;
  signedUrl?: string;
  size?: number;
  error?: string;
  code?: string;
}

export class SimpleUploadService {
  private readonly baseUrl: string;
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 1000; // 1 second

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Upload a file directly to GCS with backend validation and retry logic
   */
  async uploadFile(options: SimpleUploadOptions): Promise<SimpleUploadResult> {
    const { file, metadata, onProgress } = options;
    let lastError: Error | null = null;

    // Simulate initial progress
    if (onProgress) {
      onProgress(0);
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Simulate progress during upload
        if (onProgress) {
          onProgress(Math.min(25 * attempt, 75));
        }

        // Use backend API for upload with validation
        const result = await uploadFileWithValidation(file, metadata);
        
        // Complete progress
        if (onProgress) {
          onProgress(100);
        }

        return {
          success: true,
          ...result
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Upload failed');
        
        console.warn(`Upload attempt ${attempt}/${this.maxRetries} failed:`, lastError.message);
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(lastError)) {
          break;
        }
        
        // Wait before retrying (exponential backoff)
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * Math.pow(2, attempt - 1));
        }
      }
    }

    // Reset progress on failure
    if (onProgress) {
      onProgress(0);
    }

    return {
      success: false,
      error: lastError?.message || 'Upload failed after multiple attempts',
      code: this.getErrorCode(lastError)
    };
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('file too large') ||
      message.includes('upload limit') ||
      message.includes('not authenticated') ||
      message.includes('permission denied') ||
      message.includes('invalid file type')
    );
  }

  /**
   * Get error code from error message
   */
  private getErrorCode(error: Error | null): string {
    if (!error) return 'UNKNOWN_ERROR';
    
    const message = error.message.toLowerCase();
    if (message.includes('file too large')) return 'FILE_SIZE_EXCEEDED';
    if (message.includes('upload limit')) return 'UPLOAD_LIMIT_EXCEEDED';
    if (message.includes('not authenticated')) return 'AUTH_ERROR';
    if (message.includes('network')) return 'NETWORK_ERROR';
    
    return 'UPLOAD_ERROR';
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const simpleUploadService = new SimpleUploadService();
