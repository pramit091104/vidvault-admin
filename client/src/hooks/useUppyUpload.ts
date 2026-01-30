import { useState, useCallback, useRef, useEffect } from 'react';
import { UppyUploadService, UppyUploadOptions, UppyUploadResult } from '@/lib/uppyUploadService';

export interface UseUppyUploadReturn {
  isUploading: boolean;
  uploadProgress: number;
  uploadSpeed: number;
  currentChunk: number;
  totalChunks: number;
  error: string | null;
  result: UppyUploadResult | null;
  startUpload: (options: UppyUploadOptions) => Promise<void>;
  pauseUpload: () => void;
  resumeUpload: () => void;
  cancelUpload: () => void;
  reset: () => void;
  isPaused: boolean;
}

export const useUppyUpload = (): UseUppyUploadReturn => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UppyUploadResult | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const uploadServiceRef = useRef<UppyUploadService | null>(null);

  // Initialize upload service
  useEffect(() => {
    uploadServiceRef.current = new UppyUploadService();

    return () => {
      // Cleanup on unmount
      uploadServiceRef.current?.cleanup();
    };
  }, []);

  const startUpload = useCallback(async (options: UppyUploadOptions) => {
    if (!uploadServiceRef.current) {
      setError('Upload service not initialized');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadSpeed(0);
    setCurrentChunk(0);
    setTotalChunks(0);
    setError(null);
    setResult(null);
    setIsPaused(false);

    const enhancedOptions: UppyUploadOptions = {
      ...options,
      onProgress: (progress) => {
        setUploadProgress(progress);
        options.onProgress?.(progress);
      },
      onUploadSpeed: (speed) => {
        setUploadSpeed(speed);
        options.onUploadSpeed?.(speed);
      },
      onChunkProgress: (current, total) => {
        setCurrentChunk(current);
        setTotalChunks(total);
        options.onChunkProgress?.(current, total);
      },
      onSuccess: (uploadResult) => {
        setResult(uploadResult);
        setIsUploading(false);
        setUploadProgress(100);
        options.onSuccess?.(uploadResult);
      },
      onError: (errorMessage) => {
        setError(errorMessage);
        setIsUploading(false);
        options.onError?.(errorMessage);
      }
    };

    await uploadServiceRef.current.startUpload(enhancedOptions);
  }, []);

  const pauseUpload = useCallback(() => {
    uploadServiceRef.current?.pauseUpload();
    setIsPaused(true);
  }, []);

  const resumeUpload = useCallback(() => {
    uploadServiceRef.current?.resumeUpload();
    setIsPaused(false);
  }, []);

  const cancelUpload = useCallback(() => {
    uploadServiceRef.current?.cancelUpload();
    setIsUploading(false);
    setIsPaused(false);
    setError('Upload cancelled by user');
  }, []);

  const reset = useCallback(() => {
    uploadServiceRef.current?.cleanup();
    setIsUploading(false);
    setUploadProgress(0);
    setUploadSpeed(0);
    setCurrentChunk(0);
    setTotalChunks(0);
    setError(null);
    setResult(null);
    setIsPaused(false);
  }, []);

  return {
    isUploading,
    uploadProgress,
    uploadSpeed,
    currentChunk,
    totalChunks,
    error,
    result,
    startUpload,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    reset,
    isPaused
  };
};
