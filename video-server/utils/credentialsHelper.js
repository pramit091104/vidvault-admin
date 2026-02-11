/**
 * Utility functions for handling GCS and Firebase credentials
 * Fixes common issues with escaped newlines in private keys
 */

/**
 * Fixes private key newlines that may be escaped at multiple levels
 * Handles: \\n (double-escaped), \n (single-escaped), and actual newlines
 * 
 * @param {string} privateKey - The private key string to fix
 * @returns {string} - The fixed private key with proper newlines
 */
export function fixPrivateKeyNewlines(privateKey) {
  if (!privateKey || typeof privateKey !== 'string') {
    return privateKey;
  }

  let fixedKey = privateKey;

  // Step 1: Replace double-escaped newlines (\\n) with single escape (\n)
  fixedKey = fixedKey.replace(/\\\\n/g, '\\n');

  // Step 2: Replace escaped newlines (\n) with actual newlines
  fixedKey = fixedKey.replace(/\\n/g, '\n');

  // Step 3: Ensure proper formatting
  // Trim any extra whitespace and ensure it ends with a newline
  fixedKey = fixedKey.trim();
  if (!fixedKey.endsWith('\n')) {
    fixedKey += '\n';
  }

  return fixedKey;
}

/**
 * Fixes credentials object by processing the private key
 * 
 * @param {Object} credentials - The credentials object containing private_key
 * @returns {Object} - The credentials object with fixed private key
 */
export function fixCredentials(credentials) {
  if (!credentials || typeof credentials !== 'object') {
    return credentials;
  }

  const fixed = { ...credentials };

  if (fixed.private_key) {
    fixed.private_key = fixPrivateKeyNewlines(fixed.private_key);
  }

  return fixed;
}

/**
 * Parses and fixes GCS credentials from environment variable
 * 
 * @param {string} credentialsEnv - The environment variable value (JSON string or object)
 * @returns {Object|null} - Parsed and fixed credentials, or null if parsing fails
 */
export function parseAndFixGCSCredentials(credentialsEnv) {
  if (!credentialsEnv) {
    return null;
  }

  try {
    let credentials;

    // Parse if it's a string
    if (typeof credentialsEnv === 'string') {
      credentials = JSON.parse(credentialsEnv);
    } else {
      credentials = credentialsEnv;
    }

    // Fix the private key
    return fixCredentials(credentials);
  } catch (error) {
    console.error('Error parsing GCS credentials:', error);
    return null;
  }
}

/**
 * Validates that a private key has the correct format
 * 
 * @param {string} privateKey - The private key to validate
 * @returns {Object} - Validation result with isValid and errors
 */
export function validatePrivateKey(privateKey) {
  const result = {
    isValid: true,
    errors: []
  };

  if (!privateKey) {
    result.isValid = false;
    result.errors.push('Private key is empty');
    return result;
  }

  if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
    result.isValid = false;
    result.errors.push('Private key missing BEGIN marker');
  }

  if (!privateKey.includes('-----END PRIVATE KEY-----')) {
    result.isValid = false;
    result.errors.push('Private key missing END marker');
  }

  // Check for escaped newlines (indicates the key wasn't fixed properly)
  if (privateKey.includes('\\n')) {
    result.isValid = false;
    result.errors.push('Private key contains escaped newlines (\\n)');
  }

  // Check for actual newlines
  if (!privateKey.includes('\n')) {
    result.isValid = false;
    result.errors.push('Private key missing actual newlines');
  }

  return result;
}

/**
 * Logs credential validation info (without exposing sensitive data)
 * 
 * @param {Object} credentials - The credentials to log info about
 * @param {string} source - Description of where the credentials came from
 */
export function logCredentialInfo(credentials, source = 'unknown') {
  if (!credentials) {
    console.log(`[${source}] No credentials provided`);
    return;
  }

  console.log(`[${source}] Credential Info:`);
  console.log(`  - Project ID: ${credentials.project_id || 'missing'}`);
  console.log(`  - Client Email: ${credentials.client_email || 'missing'}`);

  if (credentials.private_key) {
    const validation = validatePrivateKey(credentials.private_key);
    console.log(`  - Private Key Valid: ${validation.isValid ? '✅' : '❌'}`);
    
    if (!validation.isValid) {
      console.log(`  - Validation Errors:`);
      validation.errors.forEach(error => console.log(`    • ${error}`));
    }

    // Log key format info (first and last 30 chars only)
    const key = credentials.private_key;
    console.log(`  - Key Format: ${key.substring(0, 30)}...${key.substring(key.length - 30)}`);
    console.log(`  - Key Length: ${key.length} characters`);
  } else {
    console.log(`  - Private Key: ❌ missing`);
  }
}

// CommonJS export for Node.js compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fixPrivateKeyNewlines,
    fixCredentials,
    parseAndFixGCSCredentials,
    validatePrivateKey,
    logCredentialInfo
  };
}
