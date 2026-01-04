import { auth } from '@/integrations/firebase/config';
import { getApiBaseUrl } from '@/config/environment';

const API_BASE_URL = getApiBaseUrl();

export interface SecureVideoStreamOptions {
  videoId: string;
  includeAuth?: boolean;
}

/**
 * Get a secure streaming URL that proxies through our server
 * This prevents users from accessing direct GCS URLs
 */
export const getSecureStreamUrl = async (options: SecureVideoStreamOptions): Promise<string> => {
  const { videoId, includeAuth = true } = options;
  
  let streamUrl = `${API_BASE_URL || ''}/api/video/stream?videoId=${videoId}`;
  
  // Add authentication token for additional security
  if (includeAuth && auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      streamUrl += `&token=${encodeURIComponent(token)}`;
    } catch (error) {
      console.warn('Failed to get auth token for video streaming:', error);
    }
  }
  
  return streamUrl;
};

/**
 * Validate video access before streaming
 */
export const validateVideoAccess = async (videoId: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL || ''}/api/video/validate-access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(auth.currentUser && {
          'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
        })
      },
      body: JSON.stringify({ videoId })
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error validating video access:', error);
    return false;
  }
};

/**
 * Generate a time-limited access token for video streaming
 */
export const generateVideoAccessToken = async (videoId: string, expiresInMinutes: number = 60): Promise<string | null> => {
  try {
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    
    const token = await auth.currentUser.getIdToken();
    
    const response = await fetch(`${API_BASE_URL || ''}/api/video/generate-access-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        videoId, 
        expiresInMinutes 
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate access token');
    }
    
    const data = await response.json();
    return data.accessToken;
  } catch (error) {
    console.error('Error generating video access token:', error);
    return null;
  }
};