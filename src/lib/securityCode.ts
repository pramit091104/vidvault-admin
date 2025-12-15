import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a secure random code for video access
 * @param length - Length of the security code (default: 8)
 * @returns A secure random alphanumeric code
 */
export const generateSecurityCode = (length: number = 8): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  
  // Use crypto.getRandomValues for better randomness
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);
  
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  
  return result;
};

/**
 * Generates a unique video ID with timestamp
 * @returns A unique identifier for the video
 */
export const generateVideoId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = uuidv4().split('-')[0];
  return `video_${timestamp}_${random}`;
};

/**
 * Security code interface for Firestore
 */
export interface VideoSecurityCode {
  videoId: string;
  securityCode: string;
  title: string;
  clientName: string;
  youtubeVideoId?: string;
  youtubeVideoUrl?: string;
  uploadedAt: Date;
  userId?: string;
  isActive: boolean;
  accessCount: number;
  lastAccessed?: Date;
}

/**
 * Creates a security code record for a new video
 * @param title - Video title
 * @param clientName - Client name (used as document ID)
 * @param youtubeVideoId - YouTube video ID (optional)
 * @param youtubeVideoUrl - YouTube video URL (optional)
 * @param userId - User ID who uploaded the video (optional)
 * @returns Security code record
 */
export const createSecurityCodeRecord = (
  title: string,
  clientName: string,
  youtubeVideoId?: string,
  youtubeVideoUrl?: string,
  userId?: string
): VideoSecurityCode => {
  return {
    videoId: generateVideoId(),
    securityCode: generateSecurityCode(),
    title: title.trim(),
    clientName: clientName.trim(),
    youtubeVideoId,
    youtubeVideoUrl,
    uploadedAt: new Date(),
    userId,
    isActive: true,
    accessCount: 0,
  };
};
