import { useState, useCallback } from 'react';
import { integratedUploadService, IntegratedUploadOptions, UploadResult } from '@/services/integratedUploadService';

export interface UseIntegratedUploadResult {
  // State
  isUploading: boolean;
  uploadProgress: number;
  compressionProgress: number;
  currentChunk: number;
  totalChunks: number;
  error: string | null;
  result: UploadResult | null;
  
  // Actions
  uploadFile: (options: IntegratedUploadOptions) => Promise<UploadResult>;
  resumeUpload: (sessionId: string, file: File, options?: Partial<IntegratedUploadOptions>) => Promise<UploadResult>;
  reset: () => void;
  
  // Status
  stage: 'idle' | 'compressing' | 'uploading' | 'assembling' | 'completed' | 'failed';
}

export function useIntegratedUpload(): UseIntegratedUploadResult {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [stage, setStage] = useState<UseIntegratedUploadResult['stage']>('idle');

  const reset = useCallback(() => {
    setIsUploading(false);
    setUploadProgress(0);
    setCompressionProgress(0);
    setCurrentChunk(0);
    setTotalChunks(0);
    setError(null);
    setResult(null);
    setStage('idle');
  }, []);

  const uploadFile = useCallback(async (options: IntegratedUploadOptions): Promise<UploadResult> => {
    setIsUploading(true);
    setError(null);
    setResult(null);
    setUploadProgress(0);
    setCompressionProgress(0);
    setCurrentChunk(0);

    // Calculate total chunks
    const chunkSize = options.chunkSize || 5 * 1024 * 1024; // 5MB
    const chunks = Math.ceil(options.file.size / chunkSize);
    setTotalChunks(chunks);

    try {
      // Enhanced options with progress callbacks
      const enhancedOptions: IntegratedUploadOptions = {
        ...options,
        onProgress: (progress) => {
          setUploadProgress(progress);
          setStage('uploading');
          options.onProgress?.(progress);
        },
        onChunkUploaded: (chunkId, chunkIndex) => {
          setCurrentChunk(chunkIndex + 1);
          options.onChunkUploaded?.(chunkId, chunkIndex);
        },
        onCompressionProgress: (progress) => {
          setCompressionProgress(progress);
          setStage('compressing');
          options.onCompressionProgress?.(progress);
        },
        onError: (errorMessage) => {
          setError(errorMessage);
          options.onError?.(errorMessage);
        }
      };

      // Start upload
      if (options.enableCompression) {
        setStage('compressing');
      } else {
        setStage('uploading');
      }

      const uploadResult = await integratedUploadService.uploadFile(enhancedOptions);

      if (uploadResult.success) {
        setStage('assembling');
        // Assembly happens automatically, just wait a moment for UI feedback
        await new Promise(resolve => setTimeout(resolve, 1000));
        setStage('completed');
        setUploadProgress(100);
      } else {
        setStage('failed');
        setError(uploadResult.error || 'Upload failed');
      }

      setResult(uploadResult);
      return uploadResult;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      setStage('failed');
      
      const failedResult: UploadResult = {
        success: false,
        sessionId: '',
        fileName: options.file.name,
        originalSize: options.file.size,
        finalSize: options.file.size,
        compressionApplied: false,
        uploadDuration: 0,
        error: errorMessage
      };
      
      setResult(failedResult);
      return failedResult;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const resumeUpload = useCallback(async (
    sessionId: string, 
    file: File, 
    options: Partial<IntegratedUploadOptions> = {}
  ): Promise<UploadResult> => {
    setIsUploading(true);
    setError(null);
    setResult(null);
    setStage('uploading');

    try {
      // Enhanced options with progress callbacks
      const enhancedOptions: Partial<IntegratedUploadOptions> = {
        ...options,
        onProgress: (progress) => {
          setUploadProgress(progress);
          options.onProgress?.(progress);
        },
        onChunkUploaded: (chunkId, chunkIndex) => {
          setCurrentChunk(chunkIndex + 1);
          options.onChunkUploaded?.(chunkId, chunkIndex);
        },
        onError: (errorMessage) => {
          setError(errorMessage);
          options.onError?.(errorMessage);
        }
      };

      const uploadResult = await integratedUploadService.resumeUpload(sessionId, file, enhancedOptions);

      if (uploadResult.success) {
        setStage('completed');
        setUploadProgress(100);
      } else {
        setStage('failed');
        setError(uploadResult.error || 'Resume failed');
      }

      setResult(uploadResult);
      return uploadResult;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Resume failed';
      setError(errorMessage);
      setStage('failed');
      
      const failedResult: UploadResult = {
        success: false,
        sessionId,
        fileName: file.name,
        originalSize: file.size,
        finalSize: file.size,
        compressionApplied: false,
        uploadDuration: 0,
        error: errorMessage
      };
      
      setResult(failedResult);
      return failedResult;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return {
    // State
    isUploading,
    uploadProgress,
    compressionProgress,
    currentChunk,
    totalChunks,
    error,
    result,
    
    // Actions
    uploadFile,
    resumeUpload,
    reset,
    
    // Status
    stage
  };
}