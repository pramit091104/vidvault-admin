import { useState, useCallback, useRef } from 'react';
import { compressionWorkerService, CompressionOptions, CompressionProgress, CompressionResult } from '../lib/compressionWorkerService';

export interface UseVideoCompressionState {
  isCompressing: boolean;
  progress: number;
  error: string | null;
  result: CompressionResult | null;
  estimatedTime: number | null;
  estimatedSize: number | null;
}

export interface UseVideoCompressionActions {
  compressVideo: (file: File, options?: CompressionOptions) => Promise<CompressionResult>;
  cancelCompression: () => void;
  reset: () => void;
  shouldCompress: (file: File) => boolean;
  getEstimate: (fileSize: number) => { estimatedSize: number; estimatedTime: number };
}

export function useVideoCompression(): UseVideoCompressionState & UseVideoCompressionActions {
  const [state, setState] = useState<UseVideoCompressionState>({
    isCompressing: false,
    progress: 0,
    error: null,
    result: null,
    estimatedTime: null,
    estimatedSize: null
  });

  const compressionRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  const compressVideo = useCallback(async (
    file: File, 
    options?: CompressionOptions
  ): Promise<CompressionResult> => {
    // Reset state
    compressionRef.current.cancelled = false;
    setState({
      isCompressing: true,
      progress: 0,
      error: null,
      result: null,
      estimatedTime: null,
      estimatedSize: null
    });

    try {
      // Get estimates
      const estimate = compressionWorkerService.getCompressionEstimate(file.size);
      setState(prev => ({
        ...prev,
        estimatedTime: estimate.estimatedTime,
        estimatedSize: estimate.estimatedSize
      }));

      // Get adaptive options if none provided
      const compressionOptions = options || compressionWorkerService.getAdaptiveCompressionOptions(file.size);

      // Start compression
      const result = await compressionWorkerService.compressVideo(
        file,
        compressionOptions,
        (progress: CompressionProgress) => {
          if (compressionRef.current.cancelled) return;
          
          setState(prev => ({
            ...prev,
            progress: progress.progress
          }));
        }
      );

      if (compressionRef.current.cancelled) {
        throw new Error('Compression cancelled');
      }

      setState(prev => ({
        ...prev,
        isCompressing: false,
        progress: 100,
        result
      }));

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Compression failed';
      
      setState(prev => ({
        ...prev,
        isCompressing: false,
        error: errorMessage
      }));

      throw error;
    }
  }, []);

  const cancelCompression = useCallback(() => {
    compressionRef.current.cancelled = true;
    setState(prev => ({
      ...prev,
      isCompressing: false,
      error: 'Compression cancelled'
    }));
  }, []);

  const reset = useCallback(() => {
    compressionRef.current.cancelled = false;
    setState({
      isCompressing: false,
      progress: 0,
      error: null,
      result: null,
      estimatedTime: null,
      estimatedSize: null
    });
  }, []);

  const shouldCompress = useCallback((file: File) => {
    return compressionWorkerService.shouldCompress(file);
  }, []);

  const getEstimate = useCallback((fileSize: number) => {
    return compressionWorkerService.getCompressionEstimate(fileSize);
  }, []);

  return {
    ...state,
    compressVideo,
    cancelCompression,
    reset,
    shouldCompress,
    getEstimate
  };
}