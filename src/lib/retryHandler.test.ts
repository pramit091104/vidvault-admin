import { describe, test, expect, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import { RetryHandler } from './retryHandler';

describe('RetryHandler Property-Based Tests', () => {
  let retryHandler: RetryHandler;

  beforeEach(() => {
    retryHandler = new RetryHandler();
  });

  afterEach(() => {
    // Reset all retry states
    retryHandler.reset();
  });

  /**
   * Feature: video-upload-optimization, Property 3: Chunk Retry with Exponential Backoff
   * **Validates: Requirements 1.3**
   */
  test('Property 3: Chunk Retry with Exponential Backoff', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // Ensure non-empty after trim
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
        (chunkId, errorMessages) => {
          // Initially should allow retry
          expect(retryHandler.shouldRetry(chunkId)).toBe(true);
          expect(retryHandler.getAttemptCount(chunkId)).toBe(0);
          
          const maxRetries = 3;
          let attemptCount = 0;
          
          // Record failures up to max retries
          for (let i = 0; i < errorMessages.length && attemptCount < maxRetries; i++) {
            const error = errorMessages[i];
            
            // Should still allow retry before recording failure
            expect(retryHandler.shouldRetry(chunkId)).toBe(true);
            
            // Record failure
            retryHandler.recordFailure(chunkId, error);
            attemptCount++;
            
            // Verify attempt count
            expect(retryHandler.getAttemptCount(chunkId)).toBe(attemptCount);
            
            // Check retry state
            const retryState = retryHandler.getRetryState(chunkId);
            expect(retryState).not.toBeNull();
            expect(retryState!.attempts.length).toBe(attemptCount);
            expect(retryState!.attempts[attemptCount - 1].error).toBe(error);
            
            // Verify exponential backoff timing
            if (attemptCount < maxRetries) {
              expect(retryState!.nextRetryAt).toBeDefined();
              const timeUntilRetry = retryHandler.getTimeUntilNextRetry(chunkId);
              expect(timeUntilRetry).toBeGreaterThan(0);
              
              // Verify exponential backoff pattern (each retry should have longer delay)
              const expectedMinDelay = 1000 * Math.pow(2, attemptCount - 1); // 1s, 2s, 4s
              expect(timeUntilRetry).toBeGreaterThanOrEqual(expectedMinDelay * 0.75); // Allow for jitter
            }
          }
          
          // After max retries, should be exhausted
          if (attemptCount >= maxRetries) {
            expect(retryHandler.isRetryExhausted(chunkId)).toBe(true);
            expect(retryHandler.shouldRetry(chunkId)).toBe(false);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Retry logic respects custom configuration', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 500, max: 5000 }),
        fc.float({ min: 1.5, max: 3.0 }),
        (chunkId, maxRetries, baseDelay, backoffMultiplier) => {
          const customConfig = {
            maxRetries,
            baseDelay,
            backoffMultiplier,
            maxDelay: baseDelay * 10,
            jitter: false // Disable jitter for predictable testing
          };
          
          // Record failures up to custom max retries
          for (let i = 0; i < maxRetries; i++) {
            expect(retryHandler.shouldRetry(chunkId, customConfig)).toBe(true);
            retryHandler.recordFailure(chunkId, `Error ${i}`, customConfig);
          }
          
          // Should be exhausted after custom max retries
          expect(retryHandler.isRetryExhausted(chunkId)).toBe(true);
          expect(retryHandler.shouldRetry(chunkId, customConfig)).toBe(false);
          expect(retryHandler.getAttemptCount(chunkId)).toBe(maxRetries);
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Network error classification works correctly', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('timeout'),
          fc.constant('network error'),
          fc.constant('connection failed'),
          fc.constant('502 bad gateway'),
          fc.constant('503 service unavailable'),
          fc.constant('504 gateway timeout')
        ),
        (temporaryError) => {
          expect(retryHandler.classifyNetworkError(temporaryError)).toBe('temporary');
          expect(retryHandler.shouldRetryError(temporaryError)).toBe(true);
        }
      ),
      { numRuns: 10 }
    );

    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('401 unauthorized'),
          fc.constant('403 forbidden'),
          fc.constant('404 not found'),
          fc.constant('413 payload too large'),
          fc.constant('unsupported format')
        ),
        (permanentError) => {
          expect(retryHandler.classifyNetworkError(permanentError)).toBe('permanent');
          expect(retryHandler.shouldRetryError(permanentError)).toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Successful retry resets state correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 3 }),
        (chunkId, errorMessages) => {
          // Record some failures
          errorMessages.forEach(error => {
            retryHandler.recordFailure(chunkId, error);
          });
          
          // Verify failures were recorded
          expect(retryHandler.getAttemptCount(chunkId)).toBe(errorMessages.length);
          expect(retryHandler.getRetryState(chunkId)).not.toBeNull();
          
          // Record success
          retryHandler.recordSuccess(chunkId);
          
          // Verify state is reset
          expect(retryHandler.getRetryState(chunkId)).toBeNull();
          expect(retryHandler.getAttemptCount(chunkId)).toBe(0);
          expect(retryHandler.isRetryExhausted(chunkId)).toBe(false);
          
          // Should allow retry again
          expect(retryHandler.shouldRetry(chunkId)).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Multiple chunks are handled independently', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), { minLength: 2, maxLength: 10 }),
        fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 2, maxLength: 10 }),
        (chunkIds, failureCounts) => {
          // Ensure arrays have same length and unique chunk IDs
          const minLength = Math.min(chunkIds.length, failureCounts.length);
          const uniqueChunkIds = [...new Set(chunkIds)].slice(0, minLength);
          const chunks = uniqueChunkIds;
          const failures = failureCounts.slice(0, chunks.length);
          
          // Record different numbers of failures for each chunk
          chunks.forEach((chunkId, index) => {
            for (let i = 0; i < failures[index]; i++) {
              retryHandler.recordFailure(chunkId, `Error ${i} for ${chunkId}`);
            }
          });
          
          // Verify each chunk has independent state
          chunks.forEach((chunkId, index) => {
            expect(retryHandler.getAttemptCount(chunkId)).toBe(failures[index]);
            
            const retryState = retryHandler.getRetryState(chunkId);
            if (failures[index] > 0) {
              expect(retryState).not.toBeNull();
              expect(retryState!.attempts.length).toBe(failures[index]);
            }
          });
          
          // Mark one chunk as successful
          if (chunks.length > 0) {
            const successChunkId = chunks[0];
            retryHandler.recordSuccess(successChunkId);
            
            // Verify only that chunk's state is reset
            expect(retryHandler.getRetryState(successChunkId)).toBeNull();
            
            // Other chunks should still have their state
            for (let i = 1; i < chunks.length; i++) {
              if (failures[i] > 0) {
                expect(retryHandler.getRetryState(chunks[i])).not.toBeNull();
              }
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Retry statistics are calculated correctly', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), { minLength: 1, maxLength: 10 }),
        fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 1, maxLength: 10 }),
        (chunkIds, failureCounts) => {
          // Ensure arrays have same length and unique chunk IDs
          const minLength = Math.min(chunkIds.length, failureCounts.length);
          const uniqueChunkIds = [...new Set(chunkIds)].slice(0, minLength);
          const chunks = uniqueChunkIds;
          const failures = failureCounts.slice(0, chunks.length);
          
          // Record failures for each chunk
          chunks.forEach((chunkId, index) => {
            for (let i = 0; i < failures[index]; i++) {
              retryHandler.recordFailure(chunkId, `Error ${i}`);
            }
          });
          
          // Get statistics
          const stats = retryHandler.getRetryStats();
          
          // Verify statistics
          expect(stats.totalChunksWithRetries).toBe(chunks.length);
          
          const exhaustedCount = chunks.filter((_, index) => failures[index] >= 3).length;
          expect(stats.exhaustedRetries).toBe(exhaustedCount);
          expect(stats.pendingRetries).toBe(chunks.length - exhaustedCount);
          
          const totalAttempts = failures.reduce((sum, count) => sum + count, 0);
          const expectedAverage = totalAttempts / chunks.length;
          expect(Math.abs(stats.averageAttempts - expectedAverage)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Cleanup removes old retry states', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), { minLength: 1, maxLength: 5 }),
        (chunkIds) => {
          // Ensure unique chunk IDs
          const uniqueChunkIds = [...new Set(chunkIds)];
          
          // Record failures for all chunks
          uniqueChunkIds.forEach(chunkId => {
            retryHandler.recordFailure(chunkId, 'Test error');
          });
          
          // Verify all chunks have retry state
          uniqueChunkIds.forEach(chunkId => {
            expect(retryHandler.getRetryState(chunkId)).not.toBeNull();
          });
          
          // Cleanup with 0 minutes (should remove all)
          retryHandler.cleanup(0);
          
          // Verify all states are cleaned up
          uniqueChunkIds.forEach(chunkId => {
            expect(retryHandler.getRetryState(chunkId)).toBeNull();
          });
          
          // Statistics should show no retries
          const stats = retryHandler.getRetryStats();
          expect(stats.totalChunksWithRetries).toBe(0);
        }
      ),
      { numRuns: 10 }
    );
  });
});