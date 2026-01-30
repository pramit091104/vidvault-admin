import { auth } from '@/integrations/firebase/config';
import { getCachedSubscription, setCachedSubscription, clearCachedSubscription } from '@/lib/subscriptionCache';

export interface BackendSubscription {
  tier: 'free' | 'premium' | 'enterprise';
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
 * Get user subscription status from backend with caching
 */
export async function getSubscriptionStatus(): Promise<BackendSubscription> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Check cache first
    const cached = getCachedSubscription(user.uid);
    if (cached) {
      return cached;
    }

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
    
    // Cache the successful response
    setCachedSubscription(user.uid, data.subscription);
    
    return data.subscription;
  } catch (error) {
    console.error('Error getting subscription status:', error);
    throw error;
  }
}

/**
 * Update user subscription in backend
 */
export async function updateSubscription(subscriptionData: {
  tier: 'free' | 'premium' | 'enterprise';
  maxVideoUploads: number;
  maxClients: number;
  maxFileSize: number;
  subscriptionDate?: Date;
  expiryDate?: Date;
  status?: string;
  videoUploadsUsed?: number;
  clientsUsed?: number;
}): Promise<BackendSubscription> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const headers = await getAuthHeaders();
    
    const response = await fetch('/api/subscription/update', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        ...subscriptionData,
        subscriptionDate: subscriptionData.subscriptionDate?.toISOString(),
        expiryDate: subscriptionData.expiryDate?.toISOString()
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to update subscription' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // Update cache with new subscription data
    setCachedSubscription(user.uid, data.subscription);
    
    return data.subscription;
  } catch (error) {
    console.error('Error updating subscription:', error);
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