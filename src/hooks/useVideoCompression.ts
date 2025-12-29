import { useState, useCallback } from 'react';
import { videoCompressionService, CompressionProgress } from '@/services/videoCompressionService';
import { VideoAnalysis, CompressionOptions, CompressionResult } from '@/services/compressionService';

export interface UseVideoCompressionResult {
  // State
  isAnalyzing: boolean;
  isCompressing: boolean;
  analysis: VideoAnalysis | null;
  recommendations: CompressionOptions | null;
  progress: CompressionProgress | null;
  error: string | null;
  
  // Actions
  analyzeVideo: (file: File) => Promise<void>;
  compressVideo: (file: File, options?: Partial<CompressionOptions>) => Promise<CompressionResult & { compressedFile?: File }>;
  checkServiceStatus: () => Promise<{ available: boolean; version?: string; error?: string }>;
  shouldCompress: (file: File) => boolean;
  getRecommendedSettings: (file: File) => Partial<CompressionOptions>;
  reset: () => void;
}

export function useVideoCompression(): UseVideoCompressionResult {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [recommendations, setRecommendations] = useState<CompressionOptions | null>(null);
  const [progress, setProgress] = useState<CompressionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setIsAnalyzing(false);
    setIsCompressing(false);
    setAnalysis(null);
    setRecommendations(null);
    setProgress(null);
    setError(null);
  }, []);

  const analyzeVideo = useCallback(async (file: File) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await videoCompressionService.analyzeVideo(file);
      setAnalysis(result.analysis);
      setRecommendations(result.recommendations);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const compressVideo = useCallback(async (
    file: File, 
    options?: Partial<CompressionOptions>
  ): Promise<CompressionResult & { compressedFile?: File }> => {
    setIsCompressing(true);
    setError(null);
    setProgress(null);

    try {
      const result = await videoCompressionService.compressVideo(
        file,
        options,
        (progressData) => setProgress(progressData)
      );
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Compression failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsCompressing(false);
      setProgress(null);
    }
  }, []);

  const checkServiceStatus = useCallback(async () => {
    return await videoCompressionService.checkServiceStatus();
  }, []);

  const shouldCompress = useCallback((file: File) => {
    return videoCompressionService.shouldCompress(file);
  }, []);

  const getRecommendedSettings = useCallback((file: File) => {
    return videoCompressionService.getRecommendedSettings(file);
  }, []);

  return {
    // State
    isAnalyzing,
    isCompressing,
    analysis,
    recommendations,
    progress,
    error,
    
    // Actions
    analyzeVideo,
    compressVideo,
    checkServiceStatus,
    shouldCompress,
    getRecommendedSettings,
    reset
  };
}