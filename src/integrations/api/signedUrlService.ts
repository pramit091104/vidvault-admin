// Use relative `/api` by default so Vite's proxy can forward requests in dev.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Request a signed URL from the backend.
 * This keeps secrets on the server and returns a temporary GCS URL.
 */
export const requestSignedUrl = async (
  videoId: string,
  service: 'youtube' | 'gcs'
): Promise<string> => {
  // If it's YouTube, we don't need a backend signature
  if (service === 'youtube') {
    return videoId; 
  }

  // Ensure we don't send undefined/null values
  const safeVideoId = videoId || '';

  try {
    const response = await fetch(`${API_BASE_URL}/signed-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoId: safeVideoId,
        service,
      }),
    });

    if (!response.ok) {
      // Try to parse the specific error from the server
      let errorMessage = response.statusText;
      try {
        const errorData = await response.json();
        if (errorData.error) errorMessage = errorData.error;
      } catch (e) {
        // If we can't parse JSON, it might be HTML (like a 404 page)
        const text = await response.text();
        if (text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
          errorMessage = 'Server returned HTML instead of JSON - check if API server is running correctly';
        }
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.signedUrl;
  } catch (error) {
    console.error('Error requesting signed URL:', error);
    throw error;
  }
};