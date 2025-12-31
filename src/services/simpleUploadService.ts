// Simple direct upload service - no chunking, just works
export interface SimpleUploadOptions {
  file: File;
  metadata?: {
    title?: string;
    description?: string;
    clientName?: string;
  };
  onProgress?: (progress: number) => void;
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
   * Upload a file directly to GCS (max 50MB)
   */
  async uploadFile(options: SimpleUploadOptions): Promise<SimpleUploadResult> {
    try {
      const { file, metadata, onProgress } = options;

      // Check file size (50MB limit)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        return {
          success: false,
          error: 'File too large. Maximum size is 50MB. Please compress your video first.'
        };
      }

      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      if (metadata) {
        formData.append('metadata', JSON.stringify({
          ...metadata,
          contentType: file.type,
          originalName: file.name
        }));
      }

      // Upload with progress tracking
      const xhr = new XMLHttpRequest();

      return new Promise((resolve, reject) => {
        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && onProgress) {
            const progress = (e.loaded / e.total) * 100;
            onProgress(progress);
          }
        });

        // Handle completion
        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            try {
              const result = JSON.parse(xhr.responseText);
              resolve({
                success: true,
                ...result
              });
            } catch (error) {
              reject(new Error('Invalid response from server'));
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              resolve({
                success: false,
                error: error.error || `Upload failed with status ${xhr.status}`
              });
            } catch {
              resolve({
                success: false,
                error: `Upload failed with status ${xhr.status}`
              });
            }
          }
        });

        // Handle errors
        xhr.addEventListener('error', () => {
          resolve({
            success: false,
            error: 'Network error during upload'
          });
        });

        xhr.addEventListener('abort', () => {
          resolve({
            success: false,
            error: 'Upload cancelled'
          });
        });

        // Send request
        xhr.open('POST', `${this.baseUrl}/api/gcs/simple-upload`);
        xhr.send(formData);
      });

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
