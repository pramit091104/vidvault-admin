import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

interface SignedUrlPayload {
  videoId: string;
  securityCode: string;
  service: 'youtube' | 'gcs';
  expires: number;
  nonce: string;
}

/**
 * Generate a signed URL payload for secure video access
 */
export const generateSignedUrlPayload = (
  videoId: string,
  securityCode: string,
  service: 'youtube' | 'gcs',
  expiresInMinutes: number = 60
): SignedUrlPayload => {
  const expires = Date.now() + (expiresInMinutes * 60 * 1000);
  const nonce = uuidv4();
  
  return {
    videoId,
    securityCode,
    service,
    expires,
    nonce
  };
};

/**
 * Create a signed token for the payload
 */
export const createSignedToken = (payload: SignedUrlPayload, secret: string): string => {
  const payloadString = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');
  
  return Buffer.from(JSON.stringify({ payload, signature })).toString('base64');
};

/**
 * Verify a signed token
 */
export const verifySignedToken = (token: string, secret: string): SignedUrlPayload | null => {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    const { payload, signature } = decoded;
    
    // Verify signature
    const payloadString = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return null;
    }
    
    // Check expiration
    if (Date.now() > payload.expires) {
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('Error verifying signed token:', error);
    return null;
  }
};

/**
 * Check if a signed URL is expired
 */
export const isSignedUrlExpired = (payload: SignedUrlPayload): boolean => {
  return Date.now() > payload.expires;
};

/**
 * Get remaining time in minutes for a signed URL
 */
export const getSignedUrlTimeRemaining = (payload: SignedUrlPayload): number => {
  const remaining = payload.expires - Date.now();
  return Math.max(0, Math.floor(remaining / (60 * 1000)));
};
