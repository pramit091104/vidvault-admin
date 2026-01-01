#!/usr/bin/env node

/**
 * Server startup script with proper deprecation warning handling
 */

// Suppress specific deprecation warnings
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  // Only show warnings that are not the url.parse deprecation
  if (warning.code !== 'DEP0169') {
    console.warn(warning.name + ':', warning.message);
  }
});

// Import and start the server
import('../server.js').catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});