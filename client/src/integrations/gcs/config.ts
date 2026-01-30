// Google Cloud Storage configuration
export const GCS_CONFIG = {
  // These values should be set in your .env file
  PROJECT_ID: import.meta.env.VITE_GCS_PROJECT_ID,
  BUCKET_NAME: import.meta.env.VITE_GCS_BUCKET_NAME,
  API_KEY: import.meta.env.VITE_GCS_API_KEY,
  // Optional: Custom domain for serving files
  CUSTOM_DOMAIN: import.meta.env.VITE_GCS_CUSTOM_DOMAIN,
};

// Validate required configuration
export const validateGCSConfig = () => {
  const required = ['PROJECT_ID', 'BUCKET_NAME'];
  const missing = required.filter(key => !GCS_CONFIG[key as keyof typeof GCS_CONFIG]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required Google Cloud Storage configuration: ${missing.join(', ')}. ` +
      `Please set the following environment variables: ${missing.map(key => `VITE_GCS_${key}`).join(', ')}`
    );
  }
};

// Generate public URL for a file in GCS
export const getPublicUrl = (fileName: string): string => {
  if (GCS_CONFIG.CUSTOM_DOMAIN) {
    return `https://${GCS_CONFIG.CUSTOM_DOMAIN}/${fileName}`;
  }
  return `https://storage.googleapis.com/${GCS_CONFIG.BUCKET_NAME}/${fileName}`;
};
