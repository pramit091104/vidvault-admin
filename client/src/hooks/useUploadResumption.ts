import { useState, useEffect, useCallback } from 'react';
import { uploadSessionManager, ResumableUpload, UploadSessionOptions } from '@/lib/uploadSessionManager';
import { UploadState } from '@/lib/chunkManager';

export interface UseUploadResumptionReturn {
  // Resumable uploads detection
  resumableUploads: ResumableUpload[];
  hasResumableUploads: boolean;
  hasExpiredUploads: boolean;
  
  // Session management
  initializeSession: (options: UploadSessionOptions) => string;
  resumeSession: (sessionId: string, file: File) => Promise<void>;
  startFreshSession: (expiredSessionId: string, file: File) => string;
  pauseSession: (sessionId: string) => void;
  cancelSession: (sessionId: string) => void;
  
  // Session state
  getSessionState: (sessionId: string) => UploadState | null;
  getSessionStats: (sessionId: string) => ReturnType<typeof uploadSessionManager.getSessionStats>;
  isSessionActive: (sessionId: string) => boolean;
  
  // Utilities
  refreshResumableUploads: () => void;
  cleanup: () => void;
  
  // Loading states
  isDetecting: boolean;
  isResuming: boolean;
  resumeError: string | null;
}

export function useUploadResumption(): UseUploadResumptionReturn {
  const [resumableUploads, setResumableUploads] = useState<ResumableUpload[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  // Detect resumable uploads on mount
  const detectResumableUploads = useCallback(() => {
    setIsDetecting(true);
    try {
      const uploads = uploadSessionManager.detectResumableUploads();
      setResumableUploads(uploads);
    } catch (error) {
      console.error('Error detecting resumable uploads:', error);
    } finally {
      setIsDetecting(false);
    }
  }, []);

  // Initialize detection on mount
  useEffect(() => {
    detectResumableUploads();
  }, [detectResumableUploads]);

  // Initialize a new upload session
  const initializeSession = useCallback((options: UploadSessionOptions): string => {
    setResumeError(null);
    return uploadSessionManager.initializeSession(options);
  }, []);

  // Resume an existing session
  const resumeSession = useCallback(async (sessionId: string, file: File): Promise<void> => {
    setIsResuming(true);
    setResumeError(null);
    
    try {
      await uploadSessionManager.resumeSession(sessionId, file);
      // Refresh the list after successful resume
      detectResumableUploads();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to resume upload';
      setResumeError(errorMessage);
      throw error;
    } finally {
      setIsResuming(false);
    }
  }, [detectResumableUploads]);

  // Start a fresh session for expired upload
  const startFreshSession = useCallback((expiredSessionId: string, file: File): string => {
    setResumeError(null);
    try {
      const newSessionId = uploadSessionManager.startFreshSession(expiredSessionId, file);
      // Refresh the list after creating fresh session
      detectResumableUploads();
      return newSessionId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start fresh session';
      setResumeError(errorMessage);
      throw error;
    }
  }, [detectResumableUploads]);

  // Pause a session
  const pauseSession = useCallback((sessionId: string): void => {
    uploadSessionManager.pauseSession(sessionId);
    detectResumableUploads();
  }, [detectResumableUploads]);

  // Cancel a session
  const cancelSession = useCallback((sessionId: string): void => {
    uploadSessionManager.cancelSession(sessionId);
    detectResumableUploads();
  }, [detectResumableUploads]);

  // Get session state
  const getSessionState = useCallback((sessionId: string): UploadState | null => {
    return uploadSessionManager.getSessionState(sessionId);
  }, []);

  // Get session statistics
  const getSessionStats = useCallback((sessionId: string) => {
    return uploadSessionManager.getSessionStats(sessionId);
  }, []);

  // Check if session is active
  const isSessionActive = useCallback((sessionId: string): boolean => {
    return uploadSessionManager.isSessionActive(sessionId);
  }, []);

  // Refresh resumable uploads list
  const refreshResumableUploads = useCallback(() => {
    detectResumableUploads();
  }, [detectResumableUploads]);

  // Cleanup old sessions
  const cleanup = useCallback(() => {
    uploadSessionManager.cleanup();
    detectResumableUploads();
  }, [detectResumableUploads]);

  // Computed values
  const hasResumableUploads = resumableUploads.some(upload => !upload.isExpired);
  const hasExpiredUploads = resumableUploads.some(upload => upload.isExpired);

  return {
    // Resumable uploads detection
    resumableUploads,
    hasResumableUploads,
    hasExpiredUploads,
    
    // Session management
    initializeSession,
    resumeSession,
    startFreshSession,
    pauseSession,
    cancelSession,
    
    // Session state
    getSessionState,
    getSessionStats,
    isSessionActive,
    
    // Utilities
    refreshResumableUploads,
    cleanup,
    
    // Loading states
    isDetecting,
    isResuming,
    resumeError
  };
}