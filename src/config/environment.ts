// Environment configuration and validation utilities

export class EnvironmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentValidationError';
  }
}

export interface EnvironmentConfig {
  // Backend Razorpay configuration
  razorpayKeyId: string;
  razorpayKeySecret: string;
  
  // Frontend Razorpay configuration
  viteRazorpayKeyId: string;
  
  // Optional configurations
  firebaseApiKey?: string;
  gcsProjectId?: string;
  corsOrigin?: string;
  port?: string;
}

/**
 * Validates that all required environment variables are present
 * @param env Environment configuration object
 * @throws EnvironmentValidationError if required variables are missing
 */
export const validateEnvironmentVariables = (env: Partial<EnvironmentConfig>): void => {
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
      `Missing required environment variables: ${missingVars.join(', ')}. ` +
      `Please check your .env file and ensure all required variables are set.`
    );
  }
};

/**
 * Loads and validates environment configuration for the backend
 * @returns Validated environment configuration
 * @throws EnvironmentValidationError if validation fails
 */
export const loadBackendEnvironment = (): EnvironmentConfig => {
  const env: Partial<EnvironmentConfig> = {
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
    viteRazorpayKeyId: process.env.VITE_RAZORPAY_KEY_ID,
    firebaseApiKey: process.env.VITE_FIREBASE_API_KEY,
    gcsProjectId: process.env.GCS_PROJECT_ID,
    corsOrigin: process.env.CORS_ORIGIN,
    port: process.env.PORT
  };
  
  validateEnvironmentVariables(env);
  
  return env as EnvironmentConfig;
};

/**
 * Loads and validates environment configuration for the frontend
 * @returns Validated environment configuration for frontend use
 * @throws EnvironmentValidationError if validation fails
 */
export const loadFrontendEnvironment = (): Pick<EnvironmentConfig, 'viteRazorpayKeyId'> => {
  const env = {
    viteRazorpayKeyId: import.meta.env?.VITE_RAZORPAY_KEY_ID
  };
  
  if (!env.viteRazorpayKeyId) {
    throw new EnvironmentValidationError(
      'Missing required environment variable: VITE_RAZORPAY_KEY_ID. ' +
      'Please check your .env file and ensure the variable is set.'
    );
  }
  
  return env;
};

/**
 * Handles network errors and provides user-friendly error messages
 * @param error The original error
 * @returns A new error with a user-friendly message
 */
export const handleNetworkError = (error: Error): Error => {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new Error('Network error: Unable to connect to the server. Please check your internet connection.');
  }
  
  if (error.message.includes('ECONNREFUSED')) {
    return new Error('Connection refused: Server is not available. Please try again later.');
  }
  
  if (error.message.includes('timeout')) {
    return new Error('Request timeout: Server did not respond in time. Please try again.');
  }
  
  if (error.message.includes('CORS')) {
    return new Error('CORS error: Cross-origin request blocked. Please ensure the API is properly configured.');
  }
  
  return error;
};

/**
 * Validates API response structure
 * @param response The API response to validate
 * @throws Error if response is invalid
 */
export const validateApiResponse = (response: any): void => {
  if (response === null || response === undefined) {
    throw new Error('Invalid response: Response is null or undefined');
  }
  
  if (typeof response !== 'object' || Array.isArray(response)) {
    throw new Error('Invalid response: Response must be an object');
  }
};

/**
 * Handles API error responses and provides structured error information
 * @param response The error response from the API
 * @returns A structured error object
 */
export const handleApiError = (response: { status?: number; message?: string; code?: string }): Error => {
  const message = response.message || 'Unknown API error';
  const status = response.status || 500;
  
  if (status >= 400 && status < 500) {
    return new Error(`Client error (${status}): ${message}`);
  } else if (status >= 500) {
    return new Error(`Server error (${status}): ${message}`);
  }
  
  return new Error(`API error: ${message}`);
};

/**
 * Checks if the application is running in development mode
 * @returns true if in development mode
 */
export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === 'development' || 
         (typeof window !== 'undefined' && window.location.hostname === 'localhost');
};

/**
 * Checks if the application is running in production mode
 * @returns true if in production mode
 */
export const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production';
};

/**
 * Gets the appropriate API base URL based on the environment
 * @returns The base URL for API calls
 */
export const getApiBaseUrl = (): string => {
  // Check if we're in a test environment
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    return '';
  }
  
  // In development, use localhost
  if (isDevelopment()) {
    return 'http://localhost:3000';
  }
  
  // In production, use relative URLs to work with the deployed backend
  return '';
};