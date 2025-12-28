import * as fc from 'fast-check';

// Environment validation utility
interface EnvironmentConfig {
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  viteRazorpayKeyId?: string;
  firebaseApiKey?: string;
  gcsProjectId?: string;
}

class EnvironmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentValidationError';
  }
}

// Utility function to validate environment variables
const validateEnvironmentVariables = (env: EnvironmentConfig): void => {
  const missingVars: string[] = [];
  
  // Check required backend variables
  if (!env.razorpayKeyId) {
    missingVars.push('RAZORPAY_KEY_ID');
  }
  
  if (!env.razorpayKeySecret) {
    missingVars.push('RAZORPAY_KEY_SECRET');
  }
  
  // Check required frontend variables
  if (!env.viteRazorpayKeyId) {
    missingVars.push('VITE_RAZORPAY_KEY_ID');
  }
  
  if (missingVars.length > 0) {
    throw new EnvironmentValidationError(
      `Missing required environment variables: ${missingVars.join(', ')}`
    );
  }
};

// Utility function to handle network errors
const handleNetworkError = (error: Error): Error => {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new Error('Network error: Unable to connect to the server');
  }
  
  if (error.message.includes('ECONNREFUSED')) {
    return new Error('Connection refused: Server is not available');
  }
  
  if (error.message.includes('timeout')) {
    return new Error('Request timeout: Server did not respond in time');
  }
  
  return error;
};

// Utility function to validate API responses
const validateApiResponse = (response: any): void => {
  if (response === null || response === undefined) {
    throw new Error('Invalid response: Response is null or undefined');
  }
  
  if (typeof response !== 'object' || Array.isArray(response)) {
    throw new Error('Invalid response: Response must be an object');
  }
};

describe('Environment Variables and Error Handling', () => {
  describe('Property 5: Error Handling', () => {
    /**
     * Feature: razorpay-payment-fix, Property 5: Error Handling
     * Validates: Requirements 2.4, 3.4, 4.4
     */
    it('should provide clear error messages for missing environment variables', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            razorpayKeyId: fc.option(fc.string({ minLength: 1 })),
            razorpayKeySecret: fc.option(fc.string({ minLength: 1 })),
            viteRazorpayKeyId: fc.option(fc.string({ minLength: 1 })),
            firebaseApiKey: fc.option(fc.string({ minLength: 1 })),
            gcsProjectId: fc.option(fc.string({ minLength: 1 }))
          }),
          async (envConfig) => {
            // Test that missing required variables are properly detected
            const hasRequiredVars = envConfig.razorpayKeyId && 
                                  envConfig.razorpayKeySecret && 
                                  envConfig.viteRazorpayKeyId;
            
            if (hasRequiredVars) {
              // Should not throw when all required vars are present
              expect(() => validateEnvironmentVariables(envConfig)).not.toThrow();
            } else {
              // Should throw with clear message when vars are missing
              expect(() => validateEnvironmentVariables(envConfig))
                .toThrow(EnvironmentValidationError);
              
              try {
                validateEnvironmentVariables(envConfig);
              } catch (error) {
                expect(error).toBeInstanceOf(EnvironmentValidationError);
                expect((error as Error).message).toContain('Missing required environment variables');
                
                // Verify specific missing variables are mentioned
                if (!envConfig.razorpayKeyId) {
                  expect((error as Error).message).toContain('RAZORPAY_KEY_ID');
                }
                if (!envConfig.razorpayKeySecret) {
                  expect((error as Error).message).toContain('RAZORPAY_KEY_SECRET');
                }
                if (!envConfig.viteRazorpayKeyId) {
                  expect((error as Error).message).toContain('VITE_RAZORPAY_KEY_ID');
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: razorpay-payment-fix, Property 5: Error Handling
     * Validates: Requirements 2.4, 3.4, 4.4
     */
    it('should handle network failures gracefully with descriptive messages', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(new TypeError('Failed to fetch')),
            fc.constant(new Error('ECONNREFUSED: Connection refused')),
            fc.constant(new Error('Request timeout after 5000ms')),
            fc.constant(new Error('Network unreachable'))
          ),
          async (networkError) => {
            // Test that network errors are properly handled and transformed
            const handledError = handleNetworkError(networkError);
            
            expect(handledError).toBeInstanceOf(Error);
            expect(handledError.message).toBeTruthy();
            
            // Verify specific error types get appropriate messages
            if (networkError.message.includes('fetch')) {
              expect(handledError.message).toContain('Network error: Unable to connect to the server');
            } else if (networkError.message.includes('ECONNREFUSED')) {
              expect(handledError.message).toContain('Connection refused: Server is not available');
            } else if (networkError.message.includes('timeout')) {
              expect(handledError.message).toContain('Request timeout: Server did not respond in time');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: razorpay-payment-fix, Property 5: Error Handling
     * Validates: Requirements 2.4, 3.4, 4.4
     */
    it('should validate API responses and provide clear error messages for invalid data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.array(fc.anything())
          ),
          async (invalidResponse) => {
            // Test that invalid API responses are properly validated
            if (invalidResponse === null || invalidResponse === undefined) {
              expect(() => validateApiResponse(invalidResponse))
                .toThrow('Invalid response: Response is null or undefined');
            } else if (typeof invalidResponse !== 'object' || Array.isArray(invalidResponse)) {
              expect(() => validateApiResponse(invalidResponse))
                .toThrow('Invalid response: Response must be an object');
            } else {
              // Valid object should not throw
              expect(() => validateApiResponse(invalidResponse)).not.toThrow();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: razorpay-payment-fix, Property 5: Error Handling
     * Validates: Requirements 2.4, 3.4, 4.4
     */
    it('should handle API error responses with proper error propagation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            status: fc.integer({ min: 400, max: 599 }),
            message: fc.string({ minLength: 1, maxLength: 100 }),
            code: fc.option(fc.string({ minLength: 1, maxLength: 20 }))
          }),
          async (errorResponse) => {
            // Simulate API error handling
            const handleApiError = (response: any): Error => {
              const message = response.message || 'Unknown API error';
              const status = response.status || 500;
              
              if (status >= 400 && status < 500) {
                return new Error(`Client error (${status}): ${message}`);
              } else if (status >= 500) {
                return new Error(`Server error (${status}): ${message}`);
              }
              
              return new Error(`API error: ${message}`);
            };
            
            const error = handleApiError(errorResponse);
            
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toContain(errorResponse.message);
            expect(error.message).toContain(errorResponse.status.toString());
            
            // Verify error categorization
            if (errorResponse.status >= 400 && errorResponse.status < 500) {
              expect(error.message).toContain('Client error');
            } else if (errorResponse.status >= 500) {
              expect(error.message).toContain('Server error');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: razorpay-payment-fix, Property 5: Error Handling
     * Validates: Requirements 2.4, 3.4, 4.4
     */
    it('should handle environment variable validation errors consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom(
            'RAZORPAY_KEY_ID',
            'RAZORPAY_KEY_SECRET', 
            'VITE_RAZORPAY_KEY_ID',
            'FIREBASE_API_KEY',
            'GCS_PROJECT_ID'
          ), { minLength: 1, maxLength: 5 }),
          async (missingVars) => {
            // Create environment config missing the specified variables
            const envConfig: EnvironmentConfig = {
              razorpayKeyId: missingVars.includes('RAZORPAY_KEY_ID') ? undefined : 'test_key',
              razorpayKeySecret: missingVars.includes('RAZORPAY_KEY_SECRET') ? undefined : 'test_secret',
              viteRazorpayKeyId: missingVars.includes('VITE_RAZORPAY_KEY_ID') ? undefined : 'test_vite_key',
              firebaseApiKey: missingVars.includes('FIREBASE_API_KEY') ? undefined : 'test_firebase_key',
              gcsProjectId: missingVars.includes('GCS_PROJECT_ID') ? undefined : 'test_gcs_project'
            };
            
            // Check if any required variables are missing
            const requiredVars = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'VITE_RAZORPAY_KEY_ID'];
            const missingRequiredVars = missingVars.filter(v => requiredVars.includes(v));
            
            if (missingRequiredVars.length > 0) {
              expect(() => validateEnvironmentVariables(envConfig))
                .toThrow(EnvironmentValidationError);
              
              try {
                validateEnvironmentVariables(envConfig);
              } catch (error) {
                // Verify all missing required variables are mentioned in the error
                missingRequiredVars.forEach(varName => {
                  expect((error as Error).message).toContain(varName);
                });
              }
            } else {
              expect(() => validateEnvironmentVariables(envConfig)).not.toThrow();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// Export utilities for use in other modules
export { validateEnvironmentVariables, handleNetworkError, validateApiResponse, EnvironmentValidationError };