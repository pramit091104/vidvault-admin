import { chunkManager, Chunk, ChunkUploadResult, UploadState } from './chunkManager';
import { progressTracker, UploadProgress } from './progressTracker';
import { retryHandler, RetryConfig } from './retryHandler';
import { v4 as uuidv4 } from 'uuid';

export interface ChunkedUploadOptions {
  chunkSize?: number;
  retryConfig?: Partial<RetryConfig>;
  onProgress?: (progress: UploadProgress) => void;
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
  onError?: (error: string, chunkIndex?: number) => void;
}

export interface ChunkedUploadResult {
  sessionId: string;
  success: boolean;
  uploadedBytes: number;
  totalBytes: number;
  duration: number;
  averageSpeed: number;
  error?: string;
}

export class ChunkedUploadService {
  private activeUploads = new Map<string, boolean>();
  private readonly DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

  /**
   * Start a chunked upload
   */
  async uploadFile(
    file: File,
    uploadUrl: string = '/api/gcs/upload-chunk',
    options: ChunkedUploadOptions = {}
  ): Promise<ChunkedUploadResult> {
    const sessionId = uuidv4();
    const chunkSize = options.chunkSize || this.DEFAULT_CHUNK_SIZE;

    try {
      // Initialize upload state
      const uploadState = chunkManager.initializeUploadState(
        sessionId,
        file.name,
        file.size,
        chunkSize
      );

      // Split file into chunks
      const chunks = chunkManager.splitFile(file, chunkSize);

      // Initialize progress tracking
      progressTracker.initializeUpload(sessionId, file.size, chunks.length);

      // Mark upload as active
      this.activeUploads.set(sessionId, true);

      // Start upload process
      const result = await this.processChunks(
        sessionId,
        chunks,
        uploadUrl,
        options
      );

      return result;
    } catch (error: any) {
      // Clean up on error
      this.activeUploads.delete(sessionId);
      progressTracker.failUpload(sessionId);

      return {
        sessionId,
        success: false,
        uploadedBytes: 0,
        totalBytes: file.size,
        duration: 0,
        averageSpeed: 0,
        error: error.message || 'Upload failed'
      };
    }
  }

  /**
   * Resume an interrupted upload
   */
  async resumeUpload(
    sessionId: string,
    file: File,
    uploadUrl: string = '/api/gcs/upload-chunk',
    options: ChunkedUploadOptions = {}
  ): Promise<ChunkedUploadResult> {
    try {
      const uploadState = chunkManager.getUploadState(sessionId);
      if (!uploadState) {
        throw new Error('No upload state found for session');
      }

      // Resume upload state
      await chunkManager.resumeUpload(sessionId);

      // Recreate chunks
      const chunks = chunkManager.splitFile(file, uploadState.chunkSize);

      // Filter out already uploaded chunks
      const remainingChunks = chunks.filter(
        chunk => !uploadState.uploadedChunks.includes(chunk.id)
      );

      // Resume progress tracking
      const uploadedBytes = uploadState.uploadedChunks.length * uploadState.chunkSize;
      progressTracker.updateProgress(sessionId, uploadedBytes);
      progressTracker.resumeUpload(sessionId);

      // Mark upload as active
      this.activeUploads.set(sessionId, true);

      // Continue with remaining chunks
      const result = await this.processChunks(
        sessionId,
        remainingChunks,
        uploadUrl,
        options,
        uploadState.uploadedChunks.length
      );

      return result;
    } catch (error: any) {
      this.activeUploads.delete(sessionId);
      progressTracker.failUpload(sessionId);

      return {
        sessionId,
        success: false,
        uploadedBytes: 0,
        totalBytes: file.size,
        duration: 0,
        averageSpeed: 0,
        error: error.message || 'Resume failed'
      };
    }
  }

  /**
   * Pause an active upload
   */
  pauseUpload(sessionId: string): void {
    this.activeUploads.set(sessionId, false);
    chunkManager.pauseUpload(sessionId);
    progressTracker.pauseUpload(sessionId);
  }

  /**
   * Cancel an upload
   */
  cancelUpload(sessionId: string): void {
    this.activeUploads.delete(sessionId);
    progressTracker.failUpload(sessionId);
    // Note: Cleanup of server-side chunks would need to be handled by backend
  }

  /**
   * Get upload progress
   */
  getProgress(sessionId: string): UploadProgress | null {
    return progressTracker.getProgress(sessionId);
  }

  /**
   * Check if upload is active
   */
  isUploadActive(sessionId: string): boolean {
    return this.activeUploads.get(sessionId) || false;
  }

  /**
   * Process chunks sequentially with retry logic
   */
  private async processChunks(
    sessionId: string,
    chunks: Chunk[],
    uploadUrl: string,
    options: ChunkedUploadOptions,
    startingChunkIndex: number = 0
  ): Promise<ChunkedUploadResult> {
    const startTime = Date.now();
    let totalUploadedBytes = 0;

    for (let i = 0; i < chunks.length; i++) {
      // Check if upload is still active
      if (!this.activeUploads.get(sessionId)) {
        throw new Error('Upload was paused or cancelled');
      }

      const chunk = chunks[i];
      const actualChunkIndex = startingChunkIndex + i;

      try {
        // Upload chunk with retry logic
        const result = await this.uploadChunkWithRetry(
          chunk,
          sessionId,
          uploadUrl,
          options.retryConfig
        );

        if (result.success) {
          // Mark chunk as uploaded
          chunkManager.markChunkUploaded(sessionId, chunk.id);
          retryHandler.recordSuccess(chunk.id);
          
          totalUploadedBytes += result.uploadedBytes;

          // Update progress
          progressTracker.updateProgress(sessionId, totalUploadedBytes, actualChunkIndex + 1);

          // Notify progress callback
          if (options.onProgress) {
            const progress = progressTracker.getProgress(sessionId);
            if (progress) {
              options.onProgress(progress);
            }
          }

          // Notify chunk completion
          if (options.onChunkComplete) {
            options.onChunkComplete(actualChunkIndex + 1, chunks.length + startingChunkIndex);
          }
        } else {
          throw new Error(result.error || 'Chunk upload failed');
        }
      } catch (error: any) {
        // Handle chunk upload error
        if (options.onError) {
          options.onError(error.message, actualChunkIndex);
        }

        // If retries are exhausted, fail the entire upload
        if (retryHandler.isRetryExhausted(chunk.id)) {
          throw new Error(`Chunk ${actualChunkIndex} failed after all retry attempts: ${error.message}`);
        }

        throw error;
      }
    }

    // Complete upload
    const duration = (Date.now() - startTime) / 1000;
    const averageSpeed = totalUploadedBytes / duration;

    progressTracker.completeUpload(sessionId);
    this.activeUploads.delete(sessionId);

    return {
      sessionId,
      success: true,
      uploadedBytes: totalUploadedBytes,
      totalBytes: totalUploadedBytes,
      duration,
      averageSpeed
    };
  }

  /**
   * Upload a single chunk with retry logic
   */
  private async uploadChunkWithRetry(
    chunk: Chunk,
    sessionId: string,
    uploadUrl: string,
    retryConfig?: Partial<RetryConfig>
  ): Promise<ChunkUploadResult> {
    while (retryHandler.shouldRetry(chunk.id, retryConfig)) {
      try {
        // Validate chunk integrity before upload
        if (!chunkManager.validateChunk(chunk)) {
          throw new Error('Chunk integrity validation failed');
        }

        // Wait for retry delay if needed
        await retryHandler.waitForNextRetry(chunk.id);

        // Attempt chunk upload
        const result = await chunkManager.uploadChunk(chunk, sessionId, uploadUrl);

        if (result.success) {
          return result;
        } else {
          throw new Error(result.error || 'Chunk upload failed');
        }
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';

        // Check if error should be retried
        if (!retryHandler.shouldRetryError(errorMessage)) {
          // Permanent error, don't retry
          retryHandler.recordFailure(chunk.id, errorMessage, retryConfig);
          return {
            success: false,
            chunkId: chunk.id,
            uploadedBytes: 0,
            error: errorMessage
          };
        }

        // Record failure for retry logic
        retryHandler.recordFailure(chunk.id, errorMessage, retryConfig);

        // If retries are exhausted, return failure
        if (retryHandler.isRetryExhausted(chunk.id)) {
          return {
            success: false,
            chunkId: chunk.id,
            uploadedBytes: 0,
            error: `Max retries exceeded: ${errorMessage}`
          };
        }

        // Continue to next retry attempt
      }
    }

    // Should not reach here, but return failure as fallback
    return {
      success: false,
      chunkId: chunk.id,
      uploadedBytes: 0,
      error: 'Retry logic exhausted'
    };
  }

  /**
   * Get all incomplete uploads
   */
  getIncompleteUploads(): UploadState[] {
    return chunkManager.getIncompleteUploads();
  }

  /**
   * Clean up old upload states and retry data
   */
  cleanup(): void {
    chunkManager.cleanupOldStates();
    retryHandler.cleanup();
    progressTracker.cleanup();
  }
}

export const chunkedUploadService = new ChunkedUploadService();