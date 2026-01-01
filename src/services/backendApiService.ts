import { auth } from '@/integrations/firebase/config';

export interface BackendSubscription {
  tier: 'free' | 'premium';
  videoUploadsUsed: number;
  maxVideoUploads: number;
  clientsUsed: number;
  maxClients: number;
  maxFileSize: number;
  status: string;
  subscriptionDate?: Date;
  expiryDate?: Date;
}

export interface ValidationResponse {
  allowed: boolean;
  error?: string;
  code?: string;
  subscription?: BackendSubscription;
  currentClientCount?: number;
  maxClients?: number;
}

export interface SubscriptionStatusResponse {
  success: boolean;
  subscription: BackendSubscription;
}

/**
 * Get authentication headers for API calls
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

/**
 * Get user subscription status from backend
 */
export async function getSubscriptionStatus(): Promise<BackendSubscription> {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch('/api/subscription/status', {
      method: 'GET',
      headers,
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to get subscription status' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const data: SubscriptionStatusResponse = await response.json();
    return data.subscription;
  } catch (error) {
    console.error('Error getting subscription status:', error);
    throw error;
  }
}

/**
 * Validate if user can upload a file
 */
export async function validateFileUpload(fileSize: number): Promise<ValidationResponse> {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch('/api/upload/validate', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ fileSize })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to validate upload' }));
      return {
        allowed: false,
        error: error.error || `HTTP ${response.status}`,
        code: error.code || 'VALIDATION_ERROR'
      };
    }

    return await response.json();
  } catch (error) {
    console.error('Error validating file upload:', error);
    return {
      allowed: false,
      error: error instanceof Error ? error.message : 'Failed to validate upload',
      code: 'NETWORK_ERROR'
    };
  }
}

/**
 * Validate if user can create a client
 */
export async function validateClientCreation(): Promise<ValidationResponse> {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch('/api/clients/validate', {
      method: 'GET',
      headers,
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to validate client creation' }));
      return {
        allowed: false,
        error: error.error || `HTTP ${response.status}`,
        code: error.code || 'VALIDATION_ERROR'
      };
    }

    return await response.json();
  } catch (error) {
    console.error('Error validating client creation:', error);
    return {
      allowed: false,
      error: error instanceof Error ? error.message : 'Failed to validate client creation',
      code: 'NETWORK_ERROR'
    };
  }
}

/**
 * Upload file with backend validation
 */
export async function uploadFileWithValidation(
  file: File, 
  metadata?: { title?: string; description?: string; clientName?: string }
): Promise<any> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const token = await user.getIdToken();
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', file.name);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const response = await fetch('/api/upload/simple', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}