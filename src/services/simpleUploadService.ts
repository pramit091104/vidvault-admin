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
}

export class SimpleUploadService {
  private readonly baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Upload a file directly to GCS with backend validation
   */
  async uploadFile(options: SimpleUploadOptions): Promise<SimpleUploadResult> {
    try {
      const { file, metadata, onProgress } = options;

      // Use backend API for upload with validation
      const result = await uploadFileWithValidation(file, metadata);
      
      // Simulate progress for UI (since we don't have real progress from fetch)
      if (onProgress) {
        onProgress(100);
      }

      return {
        success: true,
        ...result
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }
}

// Export singleton instance
export const simpleUploadService = new SimpleUploadService();
