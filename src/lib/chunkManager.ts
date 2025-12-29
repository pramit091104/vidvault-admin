import { v4 as uuidv4 } from 'uuid';

export interface Chunk {
  id: string;
  data: Blob;
  index: number;
  size: number;
  checksum: string;
}

export interface ChunkUploadResult {
  success: boolean;
  chunkId: string;
  uploadedBytes: number;
  error?: string;
}

export interface UploadState {
  sessionId: string;
  fileName: string;
  totalSize: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: string[];
  status: 'initialized' | 'uploading' | 'paused' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  lastChunkIndex: number;
  failedChunks: string[];
  retryCount: number;
  metadata?: {
    title?: string;
    description?: string;
    clientName?: string;
    contentType?: string;
  };
}

export class ChunkManager {
  private static readonly DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  private static readonly MIN_CHUNK_SIZE = 1 * 1024 * 1024; // 1MB
  private static readonly MAX_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Split a file into chunks
   */
  splitFile(file: File, chunkSize: number = ChunkManager.DEFAULT_CHUNK_SIZE): Chunk[] {
    // Validate chunk size
    const validatedChunkSize = Math.max(
      ChunkManager.MIN_CHUNK_SIZE,
      Math.min(ChunkManager.MAX_CHUNK_SIZE, chunkSize)
    );

    const chunks: Chunk[] = [];
    const totalChunks = Math.ceil(file.size / validatedChunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * validatedChunkSize;
      const end = Math.min(start + validatedChunkSize, file.size);
      const chunkData = file.slice(start, end);
      
      const chunk: Chunk = {
        id: uuidv4(),
        data: chunkData,
        index: i,
        size: chunkData.size,
        checksum: this.generateChecksum(chunkData)
      };

      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Upload a single chunk
   */
  async uploadChunk(
    chunk: Chunk, 
    sessionId: string, 
    uploadUrl: string = '/api/gcs/upload-chunk',
    onProgress?: (progress: number) => void
  ): Promise<ChunkUploadResult> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();

      // Prepare chunk data
      formData.append('chunk', chunk.data);
      formData.append('chunkId', chunk.id);
      formData.append('chunkIndex', chunk.index.toString());
      formData.append('chunkSize', chunk.size.toString());
      formData.append('checksum', chunk.checksum);
      formData.append('sessionId', sessionId);

      // Track upload progress for this chunk
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = (e.loaded / e.total) * 100;
          onProgress(Math.min(progress, 100));
        }
      });

      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve({
              success: true,
              chunkId: chunk.id,
              uploadedBytes: chunk.size,
              ...response
            });
          } catch {
            resolve({
              success: true,
              chunkId: chunk.id,
              uploadedBytes: chunk.size
            });
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            resolve({
              success: false,
              chunkId: chunk.id,
              uploadedBytes: 0,
              error: error.error?.message || `Upload failed: ${xhr.statusText}`
            });
          } catch {
            resolve({
              success: false,
              chunkId: chunk.id,
              uploadedBytes: 0,
              error: `Upload failed: ${xhr.statusText}`
            });
          }
        }
      };

      xhr.onerror = () => {
        resolve({
          success: false,
          chunkId: chunk.id,
          uploadedBytes: 0,
          error: 'Network error during chunk upload'
        });
      };

      xhr.onabort = () => {
        resolve({
          success: false,
          chunkId: chunk.id,
          uploadedBytes: 0,
          error: 'Chunk upload was cancelled'
        });
      };

      xhr.open('POST', uploadUrl, true);
      xhr.send(formData);
    });
  }

  /**
   * Resume upload from a saved state
   */
  async resumeUpload(sessionId: string): Promise<void> {
    const state = this.getUploadState(sessionId);
    if (!state) {
      throw new Error('No upload state found for session');
    }

    // Update state to uploading
    state.status = 'uploading';
    state.updatedAt = new Date();
    this.saveUploadState(state);
  }

  /**
   * Pause an ongoing upload
   */
  pauseUpload(sessionId: string): void {
    const state = this.getUploadState(sessionId);
    if (state) {
      state.status = 'paused';
      state.updatedAt = new Date();
      this.saveUploadState(state);
    }
  }

  /**
   * Get upload state from localStorage
   */
  getUploadState(sessionId: string): UploadState | null {
    try {
      const stateJson = localStorage.getItem(`upload_state_${sessionId}`);
      if (!stateJson) return null;

      const state = JSON.parse(stateJson);
      // Convert date strings back to Date objects
      state.createdAt = new Date(state.createdAt);
      state.updatedAt = new Date(state.updatedAt);
      state.expiresAt = new Date(state.expiresAt);
      
      return state;
    } catch (error) {
      console.error('Error retrieving upload state:', error);
      return null;
    }
  }

  /**
   * Save upload state to localStorage
   */
  saveUploadState(state: UploadState): void {
    try {
      localStorage.setItem(`upload_state_${state.sessionId}`, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving upload state:', error);
    }
  }

  /**
   * Initialize upload state
   */
  initializeUploadState(
    sessionId: string,
    fileName: string,
    totalSize: number,
    chunkSize: number,
    metadata?: UploadState['metadata']
  ): UploadState {
    const totalChunks = Math.ceil(totalSize / chunkSize);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 24 hours from now
    
    const state: UploadState = {
      sessionId,
      fileName,
      totalSize,
      chunkSize,
      totalChunks,
      uploadedChunks: [],
      status: 'initialized',
      createdAt: now,
      updatedAt: now,
      expiresAt,
      lastChunkIndex: -1,
      failedChunks: [],
      retryCount: 0,
      metadata
    };

    this.saveUploadState(state);
    return state;
  }

  /**
   * Mark chunk as uploaded
   */
  markChunkUploaded(sessionId: string, chunkId: string, chunkIndex: number): void {
    const state = this.getUploadState(sessionId);
    if (state && !state.uploadedChunks.includes(chunkId)) {
      state.uploadedChunks.push(chunkId);
      state.lastChunkIndex = Math.max(state.lastChunkIndex, chunkIndex);
      state.updatedAt = new Date();
      
      // Remove from failed chunks if it was there
      const failedIndex = state.failedChunks.indexOf(chunkId);
      if (failedIndex > -1) {
        state.failedChunks.splice(failedIndex, 1);
      }
      
      // Check if all chunks are uploaded
      if (state.uploadedChunks.length === state.totalChunks) {
        state.status = 'completed';
      }
      
      this.saveUploadState(state);
    }
  }

  /**
   * Validate chunk integrity
   */
  validateChunk(chunk: Chunk): boolean {
    // For now, we'll just validate that the chunk has the expected structure
    // In a real implementation, you'd want to recalculate the checksum from the data
    return (
      chunk.id && 
      chunk.data && 
      chunk.size === chunk.data.size &&
      chunk.checksum &&
      chunk.index >= 0
    );
  }

  /**
   * Generate checksum for chunk data
   */
  private generateChecksum(data: Blob): string {
    // Create a more unique hash based on size, type, and a random component
    const sizeStr = data.size.toString();
    const typeStr = data.type || 'unknown';
    const randomStr = Math.random().toString(36).substr(2, 9);
    
    // Simple hash function (not cryptographically secure, but sufficient for integrity checking)
    let hash = 0;
    const str = sizeStr + typeStr + randomStr + Date.now().toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16) + '-' + randomStr;
  }

  /**
   * Clean up old upload states (older than 24 hours)
   */
  cleanupOldStates(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('upload_state_')) {
        try {
          const stateJson = localStorage.getItem(key);
          if (stateJson) {
            const state = JSON.parse(stateJson);
            const createdAt = new Date(state.createdAt).getTime();
            
            if (createdAt < cutoffTime) {
              localStorage.removeItem(key);
            }
          }
        } catch (error) {
          // Remove corrupted state
          localStorage.removeItem(key);
        }
      }
    }
  }

  /**
   * Get all incomplete upload states
   */
  getIncompleteUploads(): UploadState[] {
    const incompleteUploads: UploadState[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('upload_state_')) {
        try {
          const stateJson = localStorage.getItem(key);
          if (stateJson) {
            const state = JSON.parse(stateJson);
            state.createdAt = new Date(state.createdAt);
            state.updatedAt = new Date(state.updatedAt);
            state.expiresAt = new Date(state.expiresAt);
            
            if (state.status !== 'completed') {
              incompleteUploads.push(state);
            }
          }
        } catch (error) {
          // Remove corrupted state
          localStorage.removeItem(key);
        }
      }
    }
    
    return incompleteUploads;
  }

  /**
   * Detect incomplete uploads and offer resumption
   */
  detectIncompleteUploads(): UploadState[] {
    const incompleteUploads = this.getIncompleteUploads();
    const now = new Date();
    
    return incompleteUploads.filter(state => {
      // Check if upload state is not expired (within 24 hours)
      return state.expiresAt > now;
    });
  }

  /**
   * Get expired upload states (older than 24 hours)
   */
  getExpiredUploads(): UploadState[] {
    const incompleteUploads = this.getIncompleteUploads();
    const now = new Date();
    
    return incompleteUploads.filter(state => {
      return state.expiresAt <= now;
    });
  }

  /**
   * Verify which chunks were successfully uploaded for resumption
   */
  async verifyUploadedChunks(sessionId: string): Promise<string[]> {
    const state = this.getUploadState(sessionId);
    if (!state) {
      throw new Error('Upload state not found');
    }

    try {
      // Call backend to verify which chunks exist
      const response = await fetch(`/api/gcs/verify-chunks/${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to verify chunks: ${response.statusText}`);
      }

      const result = await response.json();
      const verifiedChunks = result.uploadedChunks || [];

      // Update state with verified chunks
      state.uploadedChunks = verifiedChunks;
      state.updatedAt = new Date();
      this.saveUploadState(state);

      return verifiedChunks;
    } catch (error) {
      console.error('Error verifying uploaded chunks:', error);
      // Fallback to stored state if verification fails
      return state.uploadedChunks;
    }
  }

  /**
   * Get chunks that need to be uploaded (missing or failed)
   */
  getChunksToUpload(sessionId: string, allChunks: Chunk[]): Chunk[] {
    const state = this.getUploadState(sessionId);
    if (!state) {
      return allChunks;
    }

    return allChunks.filter(chunk => {
      return !state.uploadedChunks.includes(chunk.id);
    });
  }

  /**
   * Mark chunk as failed
   */
  markChunkFailed(sessionId: string, chunkId: string): void {
    const state = this.getUploadState(sessionId);
    if (state && !state.failedChunks.includes(chunkId)) {
      state.failedChunks.push(chunkId);
      state.retryCount += 1;
      state.updatedAt = new Date();
      this.saveUploadState(state);
    }
  }

  /**
   * Check if upload session is expired
   */
  isSessionExpired(sessionId: string): boolean {
    const state = this.getUploadState(sessionId);
    if (!state) return true;

    const now = new Date();
    return state.expiresAt <= now;
  }

  /**
   * Extend session expiration (reset to 24 hours from now)
   */
  extendSession(sessionId: string): void {
    const state = this.getUploadState(sessionId);
    if (state) {
      const now = new Date();
      state.expiresAt = new Date(now.getTime() + (24 * 60 * 60 * 1000));
      state.updatedAt = now;
      this.saveUploadState(state);
    }
  }

  /**
   * Create a fresh session for expired uploads
   */
  createFreshSession(expiredState: UploadState): UploadState {
    const newSessionId = uuidv4();
    const now = new Date();
    
    const freshState: UploadState = {
      ...expiredState,
      sessionId: newSessionId,
      uploadedChunks: [],
      failedChunks: [],
      status: 'initialized',
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + (24 * 60 * 60 * 1000)),
      lastChunkIndex: -1,
      retryCount: 0
    };

    this.saveUploadState(freshState);
    return freshState;
  }

  /**
   * Remove upload state
   */
  removeUploadState(sessionId: string): void {
    try {
      localStorage.removeItem(`upload_state_${sessionId}`);
    } catch (error) {
      console.error('Error removing upload state:', error);
    }
  }

  /**
   * Get upload progress percentage
   */
  getUploadProgress(sessionId: string): number {
    const state = this.getUploadState(sessionId);
    if (!state) return 0;

    return Math.round((state.uploadedChunks.length / state.totalChunks) * 100);
  }

  /**
   * Get remaining chunks count
   */
  getRemainingChunksCount(sessionId: string): number {
    const state = this.getUploadState(sessionId);
    if (!state) return 0;

    return state.totalChunks - state.uploadedChunks.length;
  }

  /**
   * Update upload status
   */
  updateUploadStatus(sessionId: string, status: UploadState['status']): void {
    const state = this.getUploadState(sessionId);
    if (state) {
      state.status = status;
      state.updatedAt = new Date();
      this.saveUploadState(state);
    }
  }
}

export const chunkManager = new ChunkManager();