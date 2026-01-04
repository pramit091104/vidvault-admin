import { getApiBaseUrl } from '../../config/environment';

// Get the API base URL using the environment utility
const API_BASE_URL = getApiBaseUrl();

/**
 * Request a signed URL from the backend.
 * This keeps secrets on the server and returns a temporary GCS URL.
 */
export const requestSignedUrl = async (
  videoId: string,
  gcsPath?: string
): Promise<string> => {
  // Ensure we don't send undefined/null values
  const safeVideoId = videoId || '';

  try {
    const requestBody: any = {
      videoId: safeVideoId,
      service: 'gcs',
    };
    
    // Include gcsPath if provided
    if (gcsPath) {
      requestBody.gcsPath = gcsPath;
    }

    const response = await fetch(`${API_BASE_URL}/api/signed-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      // Try to parse the specific error from the server
      let errorMessage = response.statusText;
      try {
        const errorData = await response.json();
        if (errorData.error) errorMessage = errorData.error;
        
        // If it's a 404, provide more helpful error message
        if (response.status === 404) {
          errorMessage = 'Video not found in storage. The video may have been moved or deleted.';
        }
      } catch (e) {
        // If we can't parse JSON, it might be HTML (like a 404 page)
        const text = await response.text();
        if (text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
          errorMessage = 'API endpoint not found - check if the server is running correctly';
        }
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.signedUrl;
  } catch (error) {
    console.error('Error requesting signed URL:', error);
    
    // If it's a network error, provide fallback behavior
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Unable to connect to the server. Please check your internet connection.');
    }
    
    throw error;
  }
};