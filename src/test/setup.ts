// Test setup file for Jest
import '@testing-library/jest-dom';

// Configure fast-check for property-based testing
import fc from 'fast-check';

// Global configuration for property-based tests
fc.configureGlobal({
  numRuns: 100, // Minimum 100 iterations as specified in design
  verbose: true,
  seed: 42, // Fixed seed for reproducible tests
  endOnFailure: true,
});

// Custom matchers for property-based testing
expect.extend({
  toSatisfyProperty(received: any, property: (value: any) => boolean) {
    const pass = property(received);
    if (pass) {
      return {
        message: () => `Expected ${received} not to satisfy the property`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to satisfy the property`,
        pass: false,
      };
    }
  },
});

// Global test utilities
global.testUtils = {
  // Generate test data helpers
  generateUserId: () => `user_${Math.random().toString(36).substr(2, 9)}`,
  generateVideoId: () => `video_${Math.random().toString(36).substr(2, 9)}`,
  generateTransactionId: () => `txn_${Math.random().toString(36).substr(2, 9)}`,
  
  // Mock timestamp helpers
  mockTimestamp: (date?: Date) => date || new Date(),
  
  // Test environment helpers
  isPropertyTest: () => process.env.NODE_ENV === 'test' && process.env.TEST_TYPE === 'property',
};

// Type declarations for global utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toSatisfyProperty(property: (value: any) => boolean): R;
    }
  }
  
  var testUtils: {
    generateUserId(): string;
    generateVideoId(): string;
    generateTransactionId(): string;
    mockTimestamp(date?: Date): Date;
    isPropertyTest(): boolean;
  };
}