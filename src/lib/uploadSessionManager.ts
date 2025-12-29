import { v4 as uuidv4 } from 'uuid';
import { chunkManager, UploadState, Chunk } from './chunkManager';
import { progressTracker } from './progressTracker';

export interface UploadSessionOptions {
  file: File;
  metadata?: {
    title?: string;
    description?: string;
    clientName?: string;
  };
  chunkSize?: number;
  onProgress?: (progress: number) => void;
  onChunkUploaded?: (chunkId: string, chunkIndex: number) => void;
  onError?: (error: string) => void;
}

export interface ResumableUpload {
  sessionId: string;
  state: UploadState;
  canResume: boolean;
  isExpired: boolean;
  progress: number;
  remainingChunks: number;
}

export class UploadSessionManager {
  private activeUploads = new Map<string, boolean>();

  /**
   * Initialize a new upload session
   */
  initializeSession(options: UploadSessionOptions): string {
    const sessionId = uuidv4();
    const chunkSize = options.chunkSize || 5 * 1024 * 1024; // 5MB default

    // Initialize upload state
    const state = chunkManager.initializeUploadState(
      sessionId,
      options.file.name,
      options.file.size,
      chunkSize,
      {
        title: options.metadata?.title,
        description: options.metadata?.description,
        clientName: options.metadata?.clientName,
        contentType: options.file.type
      }
    );

    // Initialize progress tracking
    progressTracker.initializeUpload(sessionId, options.file.size, state.totalChunks);

    return sessionId;
  }

  /**
   * Detect incomplete uploads and return resumable upload information
   */
  detectResumableUploads(): ResumableUpload[] {
    const incompleteUploads = chunkManager.detectIncompleteUploads();
    const expiredUploads = chunkManager.getExpiredUploads();
    
    const resumableUploads: ResumableUpload[] = [];

    // Add non-expired incomplete uploads
    incompleteUploads.forEach(state => {
      resumableUploads.push({
        sessionId: state.sessionId,
        state,
        canResume: true,
        isExpired: false,
        progress: chunkManager.getUploadProgress(state.sessionId),
        remainingChunks: chunkManager.getRemainingChunksCount(state.sessionId)
      });
    });

    // Add expired uploads
    expiredUploads.forEach(state => {
      resumableUploads.push({
        sessionId: state.sessionId,
        state,
        canResume: false,
        isExpired: true,
        progress: chunkManager.getUploadProgress(state.sessionId),
        remainingChunks: chunkManager.getRemainingChunksCount(state.sessionId)
      });
    });

    return resumableUploads;
  }

  /**
   * Resume an existing upload session
   */
  async resumeSession(sessionId: string, file: File, options?: Partial<UploadSessionOptions>): Promise<void> {
    const state = chunkManager.getUploadState(sessionId);
    if (!state) {
      throw new Error('Upload session not found');
    }

    if (chunkManager.isSessionExpired(sessionId)) {
      throw new Error('Upload session has expired. Please start a fresh upload.');
    }

    // Verify file matches the original
    if (file.name !== state.fileName || file.size !== state.totalSize) {
      throw new Error('File does not match the original upload session');
    }

    // Mark as active
    this.activeUploads.set(sessionId, true);

    try {
      // Verify which chunks were actually uploaded
      const verifiedChunks = await chunkManager.verifyUploadedChunks(sessionId);
      
      // Update progress tracker
      const uploadedBytes = verifiedChunks.length * state.chunkSize;
      progressTracker.updateProgress(sessionId, uploadedBytes);
      progressTracker.resumeUpload(sessionId);

      // Update state to uploading
      chunkManager.updateUploadStatus(sessionId, 'uploading');

      console.log(`Resuming upload ${sessionId}: ${verifiedChunks.length}/${state.totalChunks} chunks already uploaded`);
    } catch (error) {
      this.activeUploads.delete(sessionId);
      throw error;
    }
  }

  /**
   * Start a fresh session for an expired upload
   */
  startFreshSession(expiredSessionId: string, file: File, options?: Partial<UploadSessionOptions>): string {
    const expiredState = chunkManager.getUploadState(expiredSessionId);
    if (!expiredState) {
      throw new Error('Expired upload session not found');
    }

    // Remove the expired state
    chunkManager.removeUploadState(expiredSessionId);

    // Create new session with same metadata
    const newOptions: UploadSessionOptions = {
      file,
      metadata: expiredState.metadata,
      chunkSize: expiredState.chunkSize,
      ...options
    };

    return this.initializeSession(newOptions);
  }

  /**
   * Pause an active upload session
   */
  pauseSession(sessionId: string): void {
    chunkManager.pauseUpload(sessionId);
    progressTracker.pauseUpload(sessionId);
    this.activeUploads.delete(sessionId);
  }

  /**
   * Cancel and remove an upload session
   */
  cancelSession(sessionId: string): void {
    chunkManager.removeUploadState(sessionId);
    progressTracker.removeProgress(sessionId);
    this.activeUploads.delete(sessionId);
  }

  /**
   * Get chunks that need to be uploaded for a session
   */
  getChunksToUpload(sessionId: string, file: File): Chunk[] {
    const state = chunkManager.getUploadState(sessionId);
    if (!state) {
      throw new Error('Upload session not found');
    }

    // Split file into chunks
    const allChunks = chunkManager.splitFile(file, state.chunkSize);
    
    // Return only chunks that haven't been uploaded
    return chunkManager.getChunksToUpload(sessionId, allChunks);
  }

  /**
   * Mark a chunk as successfully uploaded
   */
  markChunkUploaded(sessionId: string, chunkId: string, chunkIndex: number, uploadedBytes: number): void {
    chunkManager.markChunkUploaded(sessionId, chunkId, chunkIndex);
    
    // Update progress
    const state = chunkManager.getUploadState(sessionId);
    if (state) {
      const totalUploadedBytes = state.uploadedChunks.length * state.chunkSize;
      progressTracker.updateProgress(sessionId, totalUploadedBytes, chunkIndex);
    }
  }

  /**
   * Mark a chunk as failed
   */
  markChunkFailed(sessionId: string, chunkId: string): void {
    chunkManager.markChunkFailed(sessionId, chunkId);
  }

  /**
   * Check if session is active
   */
  isSessionActive(sessionId: string): boolean {
    return this.activeUploads.has(sessionId);
  }

  /**
   * Get session state
   */
  getSessionState(sessionId: string): UploadState | null {
    return chunkManager.getUploadState(sessionId);
  }

  /**
   * Complete an upload session
   */
  completeSession(sessionId: string): void {
    chunkManager.updateUploadStatus(sessionId, 'completed');
    progressTracker.completeUpload(sessionId);
    this.activeUploads.delete(sessionId);
  }

  /**
   * Fail an upload session
   */
  failSession(sessionId: string, error: string): void {
    chunkManager.updateUploadStatus(sessionId, 'failed');
    progressTracker.failUpload(sessionId);
    this.activeUploads.delete(sessionId);
  }

  /**
   * Clean up old sessions (completed, failed, or expired)
   */
  cleanup(): void {
    // Clean up old upload states
    chunkManager.cleanupOldStates();
    
    // Clean up progress tracker
    progressTracker.cleanup();
  }

  /**
   * Extend session expiration
   */
  extendSession(sessionId: string): void {
    chunkManager.extendSession(sessionId);
  }

  /**
   * Get upload statistics for a session
   */
  getSessionStats(sessionId: string): {
    totalChunks: number;
    uploadedChunks: number;
    failedChunks: number;
    progress: number;
    remainingChunks: number;
    isExpired: boolean;
  } | null {
    const state = chunkManager.getUploadState(sessionId);
    if (!state) return null;

    return {
      totalChunks: state.totalChunks,
      uploadedChunks: state.uploadedChunks.length,
      failedChunks: state.failedChunks.length,
      progress: chunkManager.getUploadProgress(sessionId),
      remainingChunks: chunkManager.getRemainingChunksCount(sessionId),
      isExpired: chunkManager.isSessionExpired(sessionId)
    };
  }
}

export const uploadSessionManager = new UploadSessionManager();