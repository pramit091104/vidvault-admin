// Startup validation utilities for environment configuration

import { loadBackendEnvironment, loadFrontendEnvironment, EnvironmentValidationError } from './environment';

/**
 * Validates environment configuration for backend services
 * Should be called when the backend server starts
 */
export const validateBackendStartup = (): void => {
  try {
    console.log('Validating backend environment configuration...');
    const config = loadBackendEnvironment();
    console.log('✓ Backend environment validation successful');
    console.log(`✓ Razorpay Key ID: ${config.razorpayKeyId.substring(0, 8)}...`);
    console.log(`✓ Razorpay Key Secret: ${config.razorpayKeySecret ? '[SET]' : '[NOT SET]'}`);
  } catch (error) {
    console.error('❌ Backend environment validation failed:');
    console.error(error instanceof EnvironmentValidationError ? error.message : error);
    process.exit(1);
  }
};

/**
 * Validates environment configuration for frontend services
 * Should be called when the frontend application initializes
 */
export const validateFrontendStartup = (): void => {
  try {
    console.log('Validating frontend environment configuration...');
    const config = loadFrontendEnvironment();
    console.log('✓ Frontend environment validation successful');
    console.log(`✓ Razorpay Key ID: ${config.viteRazorpayKeyId.substring(0, 8)}...`);
  } catch (error) {
    console.error('❌ Frontend environment validation failed:');
    console.error(error instanceof EnvironmentValidationError ? error.message : error);
    throw error; // Don't exit in frontend, let the app handle it
  }
};

/**
 * Checks if all required environment variables are available
 * Returns validation status without throwing errors
 */
export const checkEnvironmentHealth = (): { 
  isValid: boolean; 
  missingVars: string[]; 
  errors: string[] 
} => {
  const result = {
    isValid: true,
    missingVars: [] as string[],
    errors: [] as string[]
  };

  try {
    // Check backend environment
    loadBackendEnvironment();
  } catch (error) {
    result.isValid = false;
    if (error instanceof EnvironmentValidationError) {
      const message = error.message;
      const match = message.match(/Missing required environment variables: ([^.]+)/);
      if (match) {
        result.missingVars.push(...match[1].split(', '));
      }
    }
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    // Check frontend environment (if in browser context)
    if (typeof window !== 'undefined') {
      loadFrontendEnvironment();
    }
  } catch (error) {
    result.isValid = false;
    if (error instanceof EnvironmentValidationError) {
      const message = error.message;
      if (message.includes('VITE_RAZORPAY_KEY_ID')) {
        result.missingVars.push('VITE_RAZORPAY_KEY_ID');
      }
    }
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
};