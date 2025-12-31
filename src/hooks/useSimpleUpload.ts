import { useState } from 'react';
import { simpleUploadService, SimpleUploadOptions, SimpleUploadResult } from '@/services/simpleUploadService';

export function useSimpleUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimpleUploadResult | null>(null);

  const uploadFile = async (options: SimpleUploadOptions): Promise<SimpleUploadResult> => {
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    setResult(null);

    try {
      const uploadResult = await simpleUploadService.uploadFile({
        ...options,
        onProgress: (progress) => {
          setUploadProgress(progress);
          options.onProgress?.(progress);
        }
      });

      setResult(uploadResult);
      
      if (!uploadResult.success) {
        setError(uploadResult.error || 'Upload failed');
      }

      return uploadResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setIsUploading(false);
    setUploadProgress(0);
    setError(null);
    setResult(null);
  };

  return {
    isUploading,
    uploadProgress,
    error,
    result,
    uploadFile,
    reset
  };
}
