export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // in milliseconds
  maxDelay: number; // in milliseconds
  backoffMultiplier: number;
  jitter: boolean;
}

export interface RetryAttempt {
  attempt: number;
  timestamp: Date;
  error?: string;
}

export interface RetryState {
  chunkId: string;
  attempts: RetryAttempt[];
  nextRetryAt?: Date;
  isExhausted: boolean;
}

export class RetryHandler {
  private retryStates = new Map<string, RetryState>();
  private readonly defaultConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 16000, // 16 seconds
    backoffMultiplier: 2,
    jitter: true
  };

  /**
   * Check if a chunk should be retried
   */
  shouldRetry(chunkId: string, config?: Partial<RetryConfig>): boolean {
    // Validate chunkId
    if (!chunkId || chunkId.trim().length === 0) {
      return false;
    }

    const state = this.retryStates.get(chunkId);
    const finalConfig = { ...this.defaultConfig, ...config };

    if (!state) {
      // First attempt, always allow
      return true;
    }

    if (state.isExhausted) {
      return false;
    }

    if (state.attempts.length >= finalConfig.maxRetries) {
      state.isExhausted = true;
      return false;
    }

    // Check if enough time has passed for next retry
    if (state.nextRetryAt && new Date() < state.nextRetryAt) {
      return false;
    }

    return true;
  }

  /**
   * Record a failed attempt and calculate next retry time
   */
  recordFailure(chunkId: string, error?: string, config?: Partial<RetryConfig>): void {
    // Validate chunkId
    if (!chunkId || chunkId.trim().length === 0) {
      return;
    }

    const finalConfig = { ...this.defaultConfig, ...config };
    let state = this.retryStates.get(chunkId);

    if (!state) {
      state = {
        chunkId,
        attempts: [],
        isExhausted: false
      };
      this.retryStates.set(chunkId, state);
    }

    // Record the attempt
    const attempt: RetryAttempt = {
      attempt: state.attempts.length + 1,
      timestamp: new Date(),
      error
    };
    state.attempts.push(attempt);

    // Calculate next retry time if not exhausted
    if (state.attempts.length < finalConfig.maxRetries) {
      const delay = this.calculateDelay(state.attempts.length, finalConfig);
      state.nextRetryAt = new Date(Date.now() + delay);
    } else {
      state.isExhausted = true;
    }
  }

  /**
   * Record a successful attempt
   */
  recordSuccess(chunkId: string): void {
    // Remove retry state on success
    this.retryStates.delete(chunkId);
  }

  /**
   * Get retry state for a chunk
   */
  getRetryState(chunkId: string): RetryState | null {
    return this.retryStates.get(chunkId) || null;
  }

  /**
   * Get time until next retry in milliseconds
   */
  getTimeUntilNextRetry(chunkId: string): number {
    const state = this.retryStates.get(chunkId);
    if (!state || !state.nextRetryAt) return 0;

    const timeUntil = state.nextRetryAt.getTime() - Date.now();
    return Math.max(0, timeUntil);
  }

  /**
   * Check if retry attempts are exhausted for a chunk
   */
  isRetryExhausted(chunkId: string): boolean {
    const state = this.retryStates.get(chunkId);
    return state?.isExhausted || false;
  }

  /**
   * Get number of retry attempts made for a chunk
   */
  getAttemptCount(chunkId: string): number {
    const state = this.retryStates.get(chunkId);
    return state?.attempts.length || 0;
  }

  /**
   * Reset retry state for a chunk
   */
  resetRetryState(chunkId: string): void {
    this.retryStates.delete(chunkId);
  }

  /**
   * Calculate exponential backoff delay with optional jitter
   */
  private calculateDelay(attemptNumber: number, config: RetryConfig): number {
    // Calculate exponential backoff: baseDelay * (backoffMultiplier ^ (attemptNumber - 1))
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attemptNumber - 1);
    
    // Cap at maximum delay
    delay = Math.min(delay, config.maxDelay);
    
    // Add jitter to prevent thundering herd
    if (config.jitter) {
      // Add random jitter of ±25%
      const jitterRange = delay * 0.25;
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      delay += jitter;
    }
    
    return Math.max(0, Math.floor(delay));
  }

  /**
   * Get all chunks that are ready for retry
   */
  getChunksReadyForRetry(): string[] {
    const readyChunks: string[] = [];
    const now = new Date();

    for (const [chunkId, state] of this.retryStates.entries()) {
      if (!state.isExhausted && (!state.nextRetryAt || now >= state.nextRetryAt)) {
        readyChunks.push(chunkId);
      }
    }

    return readyChunks;
  }

  /**
   * Clean up old retry states
   */
  cleanup(maxAgeMinutes: number = 60): void {
    const cutoffTime = Date.now() - (maxAgeMinutes * 60 * 1000);

    for (const [chunkId, state] of this.retryStates.entries()) {
      const lastAttempt = state.attempts[state.attempts.length - 1];
      if (lastAttempt && lastAttempt.timestamp.getTime() < cutoffTime) {
        this.retryStates.delete(chunkId);
      }
    }
  }

  /**
   * Get retry statistics for monitoring
   */
  getRetryStats(): {
    totalChunksWithRetries: number;
    exhaustedRetries: number;
    pendingRetries: number;
    averageAttempts: number;
  } {
    const states = Array.from(this.retryStates.values());
    const exhaustedCount = states.filter(s => s.isExhausted).length;
    const pendingCount = states.filter(s => !s.isExhausted).length;
    const totalAttempts = states.reduce((sum, s) => sum + s.attempts.length, 0);
    const averageAttempts = states.length > 0 ? totalAttempts / states.length : 0;

    return {
      totalChunksWithRetries: states.length,
      exhaustedRetries: exhaustedCount,
      pendingRetries: pendingCount,
      averageAttempts
    };
  }

  /**
   * Create a delay promise for waiting until next retry
   */
  async waitForNextRetry(chunkId: string): Promise<void> {
    const delay = this.getTimeUntilNextRetry(chunkId);
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /**
   * Reset all retry states (for testing)
   */
  reset(): void {
    this.retryStates.clear();
  }

  /**
   * Check network error type and adjust retry strategy
   */
  classifyNetworkError(error: string): 'temporary' | 'permanent' | 'unknown' {
    const lowerError = error.toLowerCase();
    
    // Temporary errors that should be retried
    if (
      lowerError.includes('timeout') ||
      lowerError.includes('network error') ||
      lowerError.includes('connection') ||
      lowerError.includes('502') ||
      lowerError.includes('503') ||
      lowerError.includes('504')
    ) {
      return 'temporary';
    }
    
    // Permanent errors that shouldn't be retried
    if (
      lowerError.includes('401') ||
      lowerError.includes('403') ||
      lowerError.includes('404') ||
      lowerError.includes('413') || // Payload too large
      lowerError.includes('unsupported')
    ) {
      return 'permanent';
    }
    
    return 'unknown';
  }

  /**
   * Determine if error should be retried based on classification
   */
  shouldRetryError(error: string): boolean {
    const classification = this.classifyNetworkError(error);
    return classification === 'temporary' || classification === 'unknown';
  }
}

export const retryHandler = new RetryHandler();