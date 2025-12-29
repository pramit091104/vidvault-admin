export interface UploadProgress {
  sessionId: string;
  totalBytes: number;
  uploadedBytes: number;
  percentage: number;
  currentChunk: number;
  totalChunks: number;
  bandwidth: number;
  estimatedTimeRemaining: number;
  status: 'queued' | 'uploading' | 'paused' | 'completed' | 'failed';
  startTime?: Date;
  lastUpdateTime?: Date;
}

export class ProgressTracker {
  private progressMap = new Map<string, UploadProgress>();
  private bandwidthSamples = new Map<string, number[]>();
  private readonly MAX_BANDWIDTH_SAMPLES = 10;

  /**
   * Initialize upload progress tracking
   */
  initializeUpload(sessionId: string, totalSize: number, totalChunks: number): void {
    const progress: UploadProgress = {
      sessionId,
      totalBytes: totalSize,
      uploadedBytes: 0,
      percentage: 0,
      currentChunk: 0,
      totalChunks,
      bandwidth: 0,
      estimatedTimeRemaining: 0,
      status: 'queued',
      startTime: new Date(),
      lastUpdateTime: new Date()
    };

    this.progressMap.set(sessionId, progress);
    this.bandwidthSamples.set(sessionId, []);
  }

  /**
   * Update progress for a specific upload
   */
  updateProgress(sessionId: string, uploadedBytes: number, currentChunk?: number): void {
    const progress = this.progressMap.get(sessionId);
    if (!progress) return;

    const now = new Date();
    const previousBytes = progress.uploadedBytes;
    const previousTime = progress.lastUpdateTime;

    // Update basic progress
    progress.uploadedBytes = uploadedBytes;
    progress.percentage = Math.min((uploadedBytes / progress.totalBytes) * 100, 100);
    progress.lastUpdateTime = now;

    if (currentChunk !== undefined) {
      progress.currentChunk = currentChunk;
    }

    // Calculate bandwidth if we have previous data
    if (previousTime && uploadedBytes > previousBytes) {
      const timeDiff = (now.getTime() - previousTime.getTime()) / 1000; // seconds
      const bytesDiff = uploadedBytes - previousBytes;
      
      if (timeDiff > 0) {
        const currentBandwidth = bytesDiff / timeDiff; // bytes per second
        this.updateBandwidth(sessionId, currentBandwidth);
      }
    }

    // Update status based on progress
    if (progress.percentage >= 100) {
      progress.status = 'completed';
    } else if (progress.status === 'queued') {
      progress.status = 'uploading';
    }

    // Calculate estimated time remaining
    progress.estimatedTimeRemaining = this.calculateTimeRemaining(sessionId);
  }

  /**
   * Get current progress for an upload
   */
  getProgress(sessionId: string): UploadProgress | null {
    return this.progressMap.get(sessionId) || null;
  }

  /**
   * Get estimated time remaining in seconds
   */
  estimateTimeRemaining(sessionId: string): number {
    return this.calculateTimeRemaining(sessionId);
  }

  /**
   * Get current bandwidth in bytes per second
   */
  getBandwidth(sessionId: string): number {
    const progress = this.progressMap.get(sessionId);
    return progress?.bandwidth || 0;
  }

  /**
   * Update bandwidth calculation with new sample
   */
  private updateBandwidth(sessionId: string, newSample: number): void {
    const samples = this.bandwidthSamples.get(sessionId) || [];
    
    // Add new sample
    samples.push(newSample);
    
    // Keep only the most recent samples
    if (samples.length > this.MAX_BANDWIDTH_SAMPLES) {
      samples.shift();
    }
    
    this.bandwidthSamples.set(sessionId, samples);
    
    // Calculate average bandwidth
    const avgBandwidth = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
    
    const progress = this.progressMap.get(sessionId);
    if (progress) {
      progress.bandwidth = avgBandwidth;
    }
  }

  /**
   * Calculate estimated time remaining based on current bandwidth
   */
  private calculateTimeRemaining(sessionId: string): number {
    const progress = this.progressMap.get(sessionId);
    if (!progress || progress.bandwidth <= 0) return 0;

    const remainingBytes = progress.totalBytes - progress.uploadedBytes;
    return Math.ceil(remainingBytes / progress.bandwidth);
  }

  /**
   * Set upload status
   */
  setStatus(sessionId: string, status: UploadProgress['status']): void {
    const progress = this.progressMap.get(sessionId);
    if (progress) {
      progress.status = status;
      progress.lastUpdateTime = new Date();
    }
  }

  /**
   * Pause upload tracking
   */
  pauseUpload(sessionId: string): void {
    this.setStatus(sessionId, 'paused');
  }

  /**
   * Resume upload tracking
   */
  resumeUpload(sessionId: string): void {
    this.setStatus(sessionId, 'uploading');
  }

  /**
   * Mark upload as completed
   */
  completeUpload(sessionId: string): void {
    const progress = this.progressMap.get(sessionId);
    if (progress) {
      progress.status = 'completed';
      progress.percentage = 100;
      progress.uploadedBytes = progress.totalBytes;
      progress.estimatedTimeRemaining = 0;
      progress.lastUpdateTime = new Date();
    }
  }

  /**
   * Mark upload as failed
   */
  failUpload(sessionId: string): void {
    this.setStatus(sessionId, 'failed');
  }

  /**
   * Remove progress tracking for a session
   */
  removeProgress(sessionId: string): void {
    this.progressMap.delete(sessionId);
    this.bandwidthSamples.delete(sessionId);
  }

  /**
   * Get all active uploads
   */
  getAllProgress(): UploadProgress[] {
    return Array.from(this.progressMap.values());
  }

  /**
   * Clean up completed or failed uploads older than specified time
   */
  cleanup(maxAgeMinutes: number = 60): void {
    const cutoffTime = Date.now() - (maxAgeMinutes * 60 * 1000);
    
    for (const [sessionId, progress] of this.progressMap.entries()) {
      if (
        (progress.status === 'completed' || progress.status === 'failed') &&
        progress.lastUpdateTime &&
        progress.lastUpdateTime.getTime() < cutoffTime
      ) {
        this.removeProgress(sessionId);
      }
    }
  }

  /**
   * Get upload duration in seconds
   */
  getUploadDuration(sessionId: string): number {
    const progress = this.progressMap.get(sessionId);
    if (!progress || !progress.startTime) return 0;

    const endTime = progress.status === 'completed' ? progress.lastUpdateTime : new Date();
    return Math.ceil((endTime!.getTime() - progress.startTime.getTime()) / 1000);
  }

  /**
   * Get average upload speed in bytes per second
   */
  getAverageSpeed(sessionId: string): number {
    const progress = this.progressMap.get(sessionId);
    if (!progress || !progress.startTime) return 0;

    const duration = this.getUploadDuration(sessionId);
    if (duration <= 0) return 0;

    return progress.uploadedBytes / duration;
  }

  /**
   * Reset all progress tracking (for testing)
   */
  reset(): void {
    this.progressMap.clear();
    this.bandwidthSamples.clear();
  }
}

export const progressTracker = new ProgressTracker();