import Uppy, { UppyFile } from '@uppy/core';
import XHRUpload from '@uppy/xhr-upload';
import { auth } from '@/integrations/firebase/config';
import { getApiBaseUrl } from '@/config/environment';

const API_BASE_URL = getApiBaseUrl();

export interface UppyUploadOptions {
  file: File;
  metadata: {
    title: string;
    description?: string;
    clientName: string;
  };
  onProgress?: (progress: number) => void;
  onUploadSpeed?: (speed: number) => void;
  onChunkProgress?: (current: number, total: number) => void;
  onSuccess?: (result: UppyUploadResult) => void;
  onError?: (error: string) => void;
}

export interface UppyUploadResult {
  gcsPath: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  success: boolean;
}

export class UppyUploadService {
  private uppy: Uppy | null = null;
  private uploadStartTime: number = 0;
  private lastProgressTime: number = 0;
  private lastProgressBytes: number = 0;

  /**
   * Initialize and start upload with Uppy
   */
  async startUpload(options: UppyUploadOptions): Promise<void> {
    const { file, metadata, onProgress, onUploadSpeed, onChunkProgress, onSuccess, onError } = options;

    try {
      // Get Firebase Auth token
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const idToken = await currentUser.getIdToken();

      // Request resumable upload URL from backend
      const urlResponse = await fetch(`${API_BASE_URL}/api/gcs/resumable-upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type,
          metadata: metadata
        })
      });

      if (!urlResponse.ok) {
        const errorData = await urlResponse.json();
        throw new Error(errorData.error || 'Failed to get upload URL');
      }

      const { uploadUrl, gcsPath } = await urlResponse.json();

      // Initialize Uppy
      this.uppy = new Uppy({
        id: 'uppyUploader',
        autoProceed: false,
        allowMultipleUploadBatches: false,
        restrictions: {
          maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
          maxNumberOfFiles: 1,
          allowedFileTypes: ['video/*']
        },
        onBeforeFileAdded: (currentFile) => {
          // Validate file type
          const allowedTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/ogg', 'video/x-matroska'];
          if (!allowedTypes.includes(currentFile.type || '')) {
            onError?.('Invalid file type. Only video files are allowed.');
            return false;
          }
          return currentFile;
        }
      });

      // Configure XHR Upload with resumable support
      this.uppy.use(XHRUpload, {
        endpoint: uploadUrl,
        method: 'PUT',
        fieldName: 'file',
        formData: false,
        headers: {
          'Content-Type': file.type,
        },
        // Chunked upload configuration
        limit: 1,
        timeout: 0, // No timeout for large files
        // Retry configuration
        retryDelays: [1000, 3000, 5000], // Retry after 1s, 3s, 5s
        withCredentials: false
      });

      // Track upload progress
      this.uppy.on('upload-progress', (file, progress) => {
        if (!file) return;

        const percentage = Math.round((progress.bytesUploaded / progress.bytesTotal) * 100);
        onProgress?.(percentage);

        // Calculate upload speed
        const now = Date.now();
        if (this.lastProgressTime > 0) {
          const timeDiff = (now - this.lastProgressTime) / 1000; // seconds
          const bytesDiff = progress.bytesUploaded - this.lastProgressBytes;
          
          if (timeDiff > 0) {
            const speed = bytesDiff / timeDiff; // bytes per second
            onUploadSpeed?.(speed);
          }
        }

        this.lastProgressTime = now;
        this.lastProgressBytes = progress.bytesUploaded;

        // Estimate chunks (10MB chunks)
        const chunkSize = 10 * 1024 * 1024;
        const totalChunks = Math.ceil(progress.bytesTotal / chunkSize);
        const currentChunk = Math.ceil(progress.bytesUploaded / chunkSize);
        onChunkProgress?.(currentChunk, totalChunks);
      });

      // Handle upload success
      this.uppy.on('upload-success', (file, response) => {
        console.log('✅ Upload successful:', file?.name);
        
        const result: UppyUploadResult = {
          gcsPath: gcsPath,
          fileName: file?.name || '',
          fileSize: file?.size || 0,
          uploadedAt: new Date().toISOString(),
          success: true
        };

        onSuccess?.(result);
      });

      // Handle upload errors
      this.uppy.on('upload-error', (file, error) => {
        console.error('❌ Upload error:', error);
        onError?.(error.message || 'Upload failed');
      });

      // Handle retry
      this.uppy.on('upload-retry', (fileId) => {
        console.log('🔄 Retrying upload for file:', fileId);
      });

      // Prevent page unload during upload
      this.uppy.on('upload-started', () => {
        this.uploadStartTime = Date.now();
        window.addEventListener('beforeunload', this.handleBeforeUnload);
      });

      this.uppy.on('complete', () => {
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
      });

      // Add file to Uppy
      this.uppy.addFile({
        name: file.name,
        type: file.type,
        data: file,
        meta: {
          ...metadata
        }
      });

      // Start upload
      await this.uppy.upload();

    } catch (error: any) {
      console.error('❌ Upload initialization error:', error);
      onError?.(error.message || 'Failed to initialize upload');
      this.cleanup();
    }
  }

  /**
   * Pause upload
   */
  pauseUpload(): void {
    if (this.uppy) {
      this.uppy.pauseAll();
      console.log('⏸️ Upload paused');
    }
  }

  /**
   * Resume upload
   */
  resumeUpload(): void {
    if (this.uppy) {
      this.uppy.resumeAll();
      console.log('▶️ Upload resumed');
    }
  }

  /**
   * Cancel upload
   */
  cancelUpload(): void {
    if (this.uppy) {
      this.uppy.cancelAll();
      console.log('❌ Upload cancelled');
      this.cleanup();
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.uppy) {
      this.uppy.close();
      this.uppy = null;
    }
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }

  /**
   * Prevent accidental page close during upload
   */
  private handleBeforeUnload = (e: BeforeUnloadEvent): string => {
    e.preventDefault();
    const message = 'Upload in progress. Are you sure you want to leave?';
    e.returnValue = message;
    return message;
  };

  /**
   * Get upload instance
   */
  getUppy(): Uppy | null {
    return this.uppy;
  }
}

// Export singleton instance
export const uppyUploadService = new UppyUploadService();
