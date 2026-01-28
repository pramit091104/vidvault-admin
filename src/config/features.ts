// Feature flags for upload functionality
export const FEATURES = {
  // Upload method availability
  UPPY_UPLOAD: true,
  SIMPLE_UPLOAD: true,
  
  // Smart upload behavior
  AUTO_SELECT_METHOD: true,
  MANUAL_METHOD_OVERRIDE: true,
  
  // File size thresholds (in bytes) - Updated for Vercel limits
  SIMPLE_UPLOAD_MAX_SIZE: parseInt(import.meta.env.VITE_UPLOAD_SIMPLE_MAX_SIZE || '4194304'), // 4MB (Vercel limit)
  RESUMABLE_UPLOAD_MAX_SIZE: parseInt(import.meta.env.VITE_UPLOAD_RESUMABLE_MAX_SIZE || '2147483648'), // 2GB
  CHUNK_SIZE: parseInt(import.meta.env.VITE_UPLOAD_CHUNK_SIZE || '10485760'), // 10MB
  
  // UI preferences
  SHOW_UPLOAD_METHOD_BADGES: true,
  SHOW_FILE_SIZE_WARNINGS: true,
  SHOW_UPLOAD_RECOMMENDATIONS: true
} as const;

// Helper functions
export const getUploadMethod = (fileSize: number): 'simple' | 'uppy' => {
  return fileSize < FEATURES.SIMPLE_UPLOAD_MAX_SIZE ? 'simple' : 'uppy';
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
};

export const isFileSizeValid = (fileSize: number): boolean => {
  return fileSize <= FEATURES.RESUMABLE_UPLOAD_MAX_SIZE;
};