import { chunkManager, Chunk, UploadState } from '@/lib/chunkManager';
import { progressTracker } from '@/lib/progressTracker';
import { retryHandler } from '@/lib/retryHandler';
import { uploadSessionManager } from '@/lib/uploadSessionManager';
import { videoCompressionService } from './videoCompressionService';
import { v4 as uuidv4 } from 'uuid';

export interface IntegratedUploadOptions {
  file: File;
  metadata?: {
    title?: string;
    description?: string;
    clientName?: string;
  };
  enableCompression?: boolean;
  chunkSize?: number;
  onProgress?: (progress: number) => void;
  onChunkUploaded?: (chunkId: string, chunkIndex: number) => void;
  onCompressionProgress?: (progress: number) => void;
  onError?: (error: string) => void;
}

export interface UploadResult {
  success: boolean;
  sessionId: string;
  fileName: string;
  gcsPath?: string;
  signedUrl?: string;
  originalSize: number;
  finalSize: number;
  compressionApplied: boolean;
  compressionRatio?: number;
  uploadDuration: number;
  error?: string;
}

export class IntegratedUploadService {
  private readonly baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Upload a file with integrated chunking and compression
   */
  async uploadFile(options: IntegratedUploadOptions): Promise<UploadResult> {
    const startTime = Date.now();
    let fileToUpload = options.file;
    let compressionApplied = false;
    let compressionRatio = 1;

    try {
      // Step 1: Check if compression should be applied
      if (options.enableCompression && videoCompressionService.shouldCompress(options.file)) {
        try {
          options.onCompressionProgress?.(0);
          
          const compressionResult = await videoCompressionService.compressVideo(
            options.file,
            videoCompressionService.getRecommendedSettings(options.file),
            (progress) => options.onCompressionProgress?.(progress.percent)
          );

          if (compressionResult.success && compressionResult.compressedFile) {
            fileToUpload = compressionResult.compressedFile;
            compressionApplied = true;
            compressionRatio = compressionResult.compressionRatio || 1;
          }
        } catch (compressionError) {
          console.warn('Compression failed, using original file:', compressionError);
          // Continue with original file
        }
      }

      // Step 2: Initialize chunked upload session
      const sessionId = await this.initializeUploadSession(fileToUpload, options.metadata);

      // Step 3: Upload file in chunks
      const uploadResult = await this.uploadInChunks(sessionId, fileToUpload, options);

      // Step 4: Wait for assembly completion
      const finalResult = await this.waitForAssembly(sessionId);

      const uploadDuration = Date.now() - startTime;

      return {
        success: true,
        sessionId,
        fileName: fileToUpload.name,
        gcsPath: finalResult.gcsPath,
        signedUrl: finalResult.signedUrl,
        originalSize: options.file.size,
        finalSize: fileToUpload.size,
        compressionApplied,
        compressionRatio,
        uploadDuration
      };

    } catch (error) {
      const uploadDuration = Date.now() - startTime;
      
      return {
        success: false,
        sessionId: '',
        fileName: options.file.name,
        originalSize: options.file.size,
        finalSize: fileToUpload.size,
        compressionApplied,
        compressionRatio,
        uploadDuration,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Resume an existing upload
   */
  async resumeUpload(sessionId: string, file: File, options: Partial<IntegratedUploadOptions> = {}): Promise<UploadResult> {
    const startTime = Date.now();

    try {
      // Verify session exists
      const sessionStatus = await this.getUploadStatus(sessionId);
      if (!sessionStatus) {
        throw new Error('Upload session not found');
      }

      // Resume chunked upload
      const uploadResult = await this.uploadInChunks(sessionId, file, options as IntegratedUploadOptions);

      // Wait for assembly completion
      const finalResult = await this.waitForAssembly(sessionId);

      const uploadDuration = Date.now() - startTime;

      return {
        success: true,
        sessionId,
        fileName: file.name,
        gcsPath: finalResult.gcsPath,
        signedUrl: finalResult.signedUrl,
        originalSize: file.size,
        finalSize: file.size,
        compressionApplied: false,
        uploadDuration
      };

    } catch (error) {
      const uploadDuration = Date.now() - startTime;
      
      return {
        success: false,
        sessionId,
        fileName: file.name,
        originalSize: file.size,
        finalSize: file.size,
        compressionApplied: false,
        uploadDuration,
        error: error instanceof Error ? error.message : 'Resume failed'
      };
    }
  }

  /**
   * Initialize upload session with backend
   */
  private async initializeUploadSession(file: File, metadata?: IntegratedUploadOptions['metadata']): Promise<string> {
    const chunkSize = 5 * 1024 * 1024; // 5MB chunks
    
    const response = await fetch(`${this.baseUrl}/api/gcs/init-chunked-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: file.name,
        totalSize: file.size,
        chunkSize,
        metadata: {
          ...metadata,
          contentType: file.type,
          originalName: file.name
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to initialize upload session');
    }

    const result = await response.json();
    return result.sessionId;
  }

  /**
   * Upload file in chunks
   */
  private async uploadInChunks(sessionId: string, file: File, options: IntegratedUploadOptions): Promise<void> {
    const chunkSize = options.chunkSize || 5 * 1024 * 1024; // 5MB
    const chunks = chunkManager.splitFile(file, chunkSize);

    // Initialize progress tracking
    progressTracker.initializeUpload(sessionId, file.size, chunks.length);

    let uploadedBytes = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      let success = false;
      let attempts = 0;
      const maxAttempts = 3;

      while (!success && attempts < maxAttempts) {
        try {
          const result = await this.uploadSingleChunk(sessionId, chunk);
          
          if (result.success) {
            success = true;
            uploadedBytes += chunk.size;
            
            // Update progress
            const progress = Math.round((uploadedBytes / file.size) * 100);
            options.onProgress?.(progress);
            options.onChunkUploaded?.(chunk.id, chunk.index);
            
            progressTracker.updateProgress(sessionId, uploadedBytes, i + 1);
            retryHandler.recordSuccess(chunk.id);
          } else {
            throw new Error(result.error || 'Chunk upload failed');
          }
        } catch (error) {
          attempts++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          if (attempts < maxAttempts) {
            retryHandler.recordFailure(chunk.id, errorMessage);
            await retryHandler.waitForNextRetry(chunk.id);
          } else {
            options.onError?.(`Failed to upload chunk ${i + 1}/${chunks.length}: ${errorMessage}`);
            throw error;
          }
        }
      }
    }

    progressTracker.completeUpload(sessionId);
  }

  /**
   * Upload a single chunk
   */
  private async uploadSingleChunk(sessionId: string, chunk: Chunk): Promise<{ success: boolean; error?: string }> {
    const formData = new FormData();
    formData.append('chunk', chunk.data);
    formData.append('sessionId', sessionId);
    formData.append('chunkId', chunk.id);
    formData.append('chunkIndex', chunk.index.toString());
    formData.append('chunkSize', chunk.size.toString());
    formData.append('checksum', chunk.checksum);

    const response = await fetch(`${this.baseUrl}/api/gcs/upload-chunk`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Chunk upload failed' };
    }

    const result = await response.json();
    return { success: result.success };
  }

  /**
   * Wait for file assembly to complete
   */
  private async waitForAssembly(sessionId: string, maxWaitTime: number = 120000): Promise<{ gcsPath?: string; signedUrl?: string }> {
    const startTime = Date.now();
    const pollInterval = 1000; // 1 second (faster polling)

    console.log(`⏳ Waiting for assembly of session ${sessionId}...`);

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getUploadStatus(sessionId);
      
      if (status?.status === 'completed') {
        console.log(`✅ Assembly completed for session ${sessionId}`);
        return {
          gcsPath: status.gcsPath,
          signedUrl: status.signedUrl
        };
      }
      
      if (status?.status === 'failed') {
        console.error(`❌ Assembly failed for session ${sessionId}:`, status.error);
        throw new Error(status.error || 'File assembly failed');
      }

      // Log current status
      console.log(`📊 Assembly status: ${status?.status || 'unknown'}`);

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    console.error(`⏰ Assembly timeout for session ${sessionId} after ${maxWaitTime}ms`);
    throw new Error('Assembly timeout - file may still be processing');
  }

  /**
   * Get upload status from backend
   */
  async getUploadStatus(sessionId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/gcs/upload-status/${sessionId}`);
      
      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting upload status:', error);
      return null;
    }
  }

  /**
   * Verify uploaded chunks for resumption
   */
  async verifyUploadedChunks(sessionId: string): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/gcs/verify-chunks/${sessionId}`);
      
      if (!response.ok) {
        return [];
      }

      const result = await response.json();
      return result.uploadedChunks || [];
    } catch (error) {
      console.error('Error verifying chunks:', error);
      return [];
    }
  }
}

// Export singleton instance
export const integratedUploadService = new IntegratedUploadService();