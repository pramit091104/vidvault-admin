import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a secure random 4-digit code for security code
 * @returns A 4-digit random number as string
 */
export const generateRandomDigits = (): string => {
  return Math.floor(Math.random() * 10000).toString().padStart(4, '0');
};

/**
 * Generates a security code based on service type and client name
 * Format: [SERVICE_PREFIX][CLIENT_INITIALS][RANDOM_4_DIGITS]
 * Examples: YTPR8262 (YouTube), GSPR6281 (Google Cloud Storage)
 * @param service - 'youtube' or 'gcs'
 * @param clientName - Client name (uses first 2 letters)
 * @returns Formatted security code
 */
export const generateSecurityCode = (service: 'youtube' | 'gcs', clientName: string): string => {
  // Service prefix
  const servicePrefix = service === 'youtube' ? 'YT' : 'GS';
  
  // Get first 2 letters of client name (uppercase)
  const clientInitials = clientName
    .trim()
    .substring(0, 2)
    .toUpperCase()
    .padEnd(2, 'X'); // Pad with 'X' if name is too short
  
  // Generate random 4-digit code
  const randomDigits = generateRandomDigits();
  
  return `${servicePrefix}${clientInitials}${randomDigits}`;
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
 * @param service - 'youtube' or 'gcs'
 * @param title - Video title
 * @param clientName - Client name
 * @param youtubeVideoId - YouTube video ID (optional)
 * @param youtubeVideoUrl - YouTube video URL (optional)
 * @param userId - User ID who uploaded the video (optional)
 * @returns Security code record
 */
export const createSecurityCodeRecord = (
  service: 'youtube' | 'gcs',
  title: string,
  clientName: string,
  youtubeVideoId?: string,
  youtubeVideoUrl?: string,
  userId?: string
): VideoSecurityCode => {
  return {
    videoId: generateVideoId(),
    securityCode: generateSecurityCode(service, clientName),
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
