import { getApiBaseUrl } from '@/config/environment';
import { getAuth } from 'firebase/auth';

export interface HLSTranscodeRequest {
  videoId: string;
  gcsPath: string;
}

export interface HLSTranscodeResponse {
  success: boolean;
  videoId: string;
  hlsPath: string;
  segmentCount: number;
  resolutions: string[];
  encrypted: boolean;
}

export interface HLSStatusResponse {
  transcoded: boolean;
  hlsPath?: string;
  segmentCount?: number;
  files?: string[];
  message?: string;
}

/**
 * HLS Service
 * Handles HLS transcoding and status checks
 */
class HLSService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getApiBaseUrl();
  }

  /**
   * Get authentication token
   */
  private async getAuthToken(): Promise<string> {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('Authentication required');
    }

    return await user.getIdToken();
  }

  /**
   * Request HLS transcoding for a video
   */
  async transcodeVideo(request: HLSTranscodeRequest): Promise<HLSTranscodeResponse> {
    try {
      const token = await this.getAuthToken();

      const response = await fetch(`${this.baseUrl}/api/hls/transcode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to transcode video');
      }

      return await response.json();
    } catch (error) {
      console.error('HLS transcode error:', error);
      throw error;
    }
  }

  /**
   * Check HLS transcoding status
   */
  async checkTranscodeStatus(videoId: string): Promise<HLSStatusResponse> {
    try {
      const token = await this.getAuthToken();

      const response = await fetch(`${this.baseUrl}/api/hls/status/${videoId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to check transcode status');
      }

      return await response.json();
    } catch (error) {
      console.error('HLS status check error:', error);
      throw error;
    }
  }

  /**
   * Transcode video and wait for completion
   * Polls status until transcoding is complete
   */
  async transcodeAndWait(
    request: HLSTranscodeRequest,
    onProgress?: (message: string) => void,
    maxWaitTime: number = 300000 // 5 minutes
  ): Promise<HLSTranscodeResponse> {
    try {
      onProgress?.('Starting HLS transcoding...');

      // Start transcoding
      const transcodeResult = await this.transcodeVideo(request);

      onProgress?.('Transcoding in progress...');

      // Poll for completion
      const startTime = Date.now();
      const pollInterval = 3000; // 3 seconds

      while (Date.now() - startTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));

        const status = await this.checkTranscodeStatus(request.videoId);

        if (status.transcoded) {
          onProgress?.('Transcoding complete!');
          return {
            ...transcodeResult,
            hlsPath: status.hlsPath || transcodeResult.hlsPath,
            segmentCount: status.segmentCount || transcodeResult.segmentCount
          };
        }

        onProgress?.('Still transcoding...');
      }

      throw new Error('Transcoding timeout - please check status later');
    } catch (error) {
      console.error('Transcode and wait error:', error);
      throw error;
    }
  }

  /**
   * Check if video has HLS version available
   */
  async hasHLSVersion(videoId: string): Promise<boolean> {
    try {
      const status = await this.checkTranscodeStatus(videoId);
      return status.transcoded;
    } catch (error) {
      console.error('Error checking HLS version:', error);
      return false;
    }
  }
}

// Export singleton instance
export const hlsService = new HLSService();

export default hlsService;
