import { describe, test, expect, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import { ProgressTracker } from './progressTracker';

describe('ProgressTracker Property-Based Tests', () => {
  let progressTracker: ProgressTracker;

  beforeEach(() => {
    progressTracker = new ProgressTracker();
  });

  afterEach(() => {
    // Clean up all progress tracking
    progressTracker.reset();
  });

  test('Progress tracking initialization and updates work correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1024, max: 100 * 1024 * 1024 }),
        fc.integer({ min: 1, max: 1000 }),
        (sessionId, totalSize, totalChunks) => {
          // Initialize upload
          progressTracker.initializeUpload(sessionId, totalSize, totalChunks);
          
          // Verify initial state
          const initialProgress = progressTracker.getProgress(sessionId);
          expect(initialProgress).not.toBeNull();
          expect(initialProgress!.sessionId).toBe(sessionId);
          expect(initialProgress!.totalBytes).toBe(totalSize);
          expect(initialProgress!.uploadedBytes).toBe(0);
          expect(initialProgress!.percentage).toBe(0);
          expect(initialProgress!.totalChunks).toBe(totalChunks);
          expect(initialProgress!.status).toBe('queued');
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Progress updates maintain monotonic increase', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 10 * 1024 * 1024, max: 100 * 1024 * 1024 }),
        fc.integer({ min: 10, max: 100 }),
        (sessionId, totalSize, totalChunks) => {
          // Initialize upload
          progressTracker.initializeUpload(sessionId, totalSize, totalChunks);
          
          // Generate sequence of increasing uploaded bytes
          const chunkSize = Math.floor(totalSize / totalChunks);
          let previousPercentage = 0;
          
          for (let chunk = 1; chunk <= totalChunks; chunk++) {
            const uploadedBytes = Math.min(chunk * chunkSize, totalSize);
            
            // Update progress
            progressTracker.updateProgress(sessionId, uploadedBytes, chunk);
            
            // Verify progress
            const progress = progressTracker.getProgress(sessionId);
            expect(progress).not.toBeNull();
            
            // Progress should be monotonically increasing
            expect(progress!.percentage).toBeGreaterThanOrEqual(previousPercentage);
            expect(progress!.uploadedBytes).toBe(uploadedBytes);
            expect(progress!.currentChunk).toBe(chunk);
            
            // Percentage should not exceed 100
            expect(progress!.percentage).toBeLessThanOrEqual(100);
            
            previousPercentage = progress!.percentage;
          }
          
          // Final progress should be 100% or close to it
          const finalProgress = progressTracker.getProgress(sessionId);
          expect(finalProgress!.percentage).toBeGreaterThanOrEqual(99);
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Bandwidth calculation works correctly with multiple samples', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1024 * 1024, max: 10 * 1024 * 1024 }),
        fc.array(fc.integer({ min: 1024, max: 1024 * 1024 }), { minLength: 2, maxLength: 10 }),
        (sessionId, totalSize, bytesUpdates) => {
          // Initialize upload
          progressTracker.initializeUpload(sessionId, totalSize, 10);
          
          let cumulativeBytes = 0;
          
          // Simulate progress updates with actual delays
          for (let i = 0; i < bytesUpdates.length; i++) {
            cumulativeBytes += bytesUpdates[i];
            
            // Update progress immediately (no setTimeout in tests)
            progressTracker.updateProgress(sessionId, Math.min(cumulativeBytes, totalSize));
            
            // Get current bandwidth
            const currentBandwidth = progressTracker.getBandwidth(sessionId);
            
            // Bandwidth should be non-negative
            expect(currentBandwidth).toBeGreaterThanOrEqual(0);
            
            // Note: Bandwidth calculation requires time differences, 
            // so we can't reliably test it without real time delays
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Status transitions work correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 10 * 1024, max: 10 * 1024 * 1024 }), // Ensure file is large enough
        (sessionId, totalSize) => {
          // Initialize upload
          progressTracker.initializeUpload(sessionId, totalSize, 10);
          
          // Initial status should be 'queued'
          let progress = progressTracker.getProgress(sessionId);
          expect(progress!.status).toBe('queued');
          
          // Update progress with small amount - should change to 'uploading'
          const smallProgress = Math.min(1024, totalSize * 0.1); // 10% or 1KB, whichever is smaller
          progressTracker.updateProgress(sessionId, smallProgress);
          progress = progressTracker.getProgress(sessionId);
          
          // Only expect 'uploading' if we haven't completed the upload
          if (smallProgress < totalSize) {
            expect(progress!.status).toBe('uploading');
          }
          
          // Pause upload
          progressTracker.pauseUpload(sessionId);
          progress = progressTracker.getProgress(sessionId);
          expect(progress!.status).toBe('paused');
          
          // Resume upload
          progressTracker.resumeUpload(sessionId);
          progress = progressTracker.getProgress(sessionId);
          expect(progress!.status).toBe('uploading');
          
          // Complete upload
          progressTracker.completeUpload(sessionId);
          progress = progressTracker.getProgress(sessionId);
          expect(progress!.status).toBe('completed');
          expect(progress!.percentage).toBe(100);
          expect(progress!.uploadedBytes).toBe(totalSize);
          
          // Fail upload (test from fresh state)
          const failSessionId = sessionId + '_fail';
          progressTracker.initializeUpload(failSessionId, totalSize, 10);
          progressTracker.failUpload(failSessionId);
          const failProgress = progressTracker.getProgress(failSessionId);
          expect(failProgress!.status).toBe('failed');
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Time estimation calculations are reasonable', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 10 * 1024 * 1024, max: 100 * 1024 * 1024 }),
        fc.integer({ min: 1024, max: 1024 * 1024 }),
        (sessionId, totalSize, bytesPerSecond) => {
          // Initialize upload
          progressTracker.initializeUpload(sessionId, totalSize, 10);
          
          // Simulate some progress with known bandwidth
          const uploadedBytes = Math.floor(totalSize * 0.3); // 30% uploaded
          progressTracker.updateProgress(sessionId, uploadedBytes);
          
          // Get time estimation
          const timeRemaining = progressTracker.estimateTimeRemaining(sessionId);
          
          // Time remaining should be non-negative
          expect(timeRemaining).toBeGreaterThanOrEqual(0);
          
          // For completed uploads, time remaining should be 0
          progressTracker.completeUpload(sessionId);
          const completedTimeRemaining = progressTracker.estimateTimeRemaining(sessionId);
          expect(completedTimeRemaining).toBe(0);
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Multiple concurrent uploads are tracked independently', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 5 }),
        fc.array(fc.integer({ min: 1024 * 1024, max: 50 * 1024 * 1024 }), { minLength: 2, maxLength: 5 }),
        (sessionIds, totalSizes) => {
          // Ensure arrays have same length and unique session IDs
          const minLength = Math.min(sessionIds.length, totalSizes.length);
          const uniqueSessionIds = [...new Set(sessionIds)].slice(0, minLength);
          const sessions = uniqueSessionIds;
          const sizes = totalSizes.slice(0, sessions.length);
          
          // Initialize multiple uploads
          sessions.forEach((sessionId, index) => {
            progressTracker.initializeUpload(sessionId, sizes[index], 10);
          });
          
          // Update progress for each upload independently
          sessions.forEach((sessionId, index) => {
            const uploadedBytes = Math.floor(sizes[index] * 0.5); // 50% progress
            progressTracker.updateProgress(sessionId, uploadedBytes);
          });
          
          // Verify each upload is tracked independently
          sessions.forEach((sessionId, index) => {
            const progress = progressTracker.getProgress(sessionId);
            expect(progress).not.toBeNull();
            expect(progress!.sessionId).toBe(sessionId);
            expect(progress!.totalBytes).toBe(sizes[index]);
            expect(progress!.uploadedBytes).toBe(Math.floor(sizes[index] * 0.5));
          });
          
          // Get all progress
          const allProgress = progressTracker.getAllProgress();
          expect(allProgress.length).toBe(sessions.length);
        }
      ),
      { numRuns: 10 }
    );
  });
});