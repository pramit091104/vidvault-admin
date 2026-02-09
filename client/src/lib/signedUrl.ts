import { v4 as uuidv4 } from 'uuid';
// import crypto from 'crypto'; // Removed Node.js crypto

interface SignedUrlPayload {
  videoId: string;
  securityCode: string;
  service: 'gcs';
  expires: number;
  nonce: string;
}

/**
 * Generate a signed URL payload for secure video access
 */
export const generateSignedUrlPayload = (
  videoId: string,
  securityCode: string,
  expiresInMinutes: number = 60
): SignedUrlPayload => {
  const expires = Date.now() + (expiresInMinutes * 60 * 1000);
  const nonce = uuidv4();

  return {
    videoId,
    securityCode,
    service: 'gcs',
    expires,
    nonce
  };
};

/**
 * Create a signed token for the payload
 */
export const createSignedToken = async (payload: SignedUrlPayload, secret: string): Promise<string> => {
  const payloadString = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const data = encoder.encode(payloadString);
  const keyData = encoder.encode(secret);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    data
  );

  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signature = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return btoa(JSON.stringify({ payload, signature }));
};

/**
 * Verify a signed token
 */
export const verifySignedToken = async (token: string, secret: string): Promise<SignedUrlPayload | null> => {
  try {
    const decoded = JSON.parse(atob(token));
    const { payload, signature } = decoded;

    // Verify signature
    const payloadString = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const data = encoder.encode(payloadString);
    const keyData = encoder.encode(secret);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      data
    );

    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const expectedSignature = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');

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
