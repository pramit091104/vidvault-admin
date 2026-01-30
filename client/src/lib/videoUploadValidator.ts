/**
 * Video upload data validator
 * Ensures all required fields are present before saving to Firestore
 */

import { GCSVideoRecord } from '@/integrations/firebase/videoService';

export interface VideoUploadData {
  id: string;
  title: string;
  description: string;
  clientName: string;
  userId: string;
  fileName: string;
  publicUrl: string;
  size: number;
  contentType: string;
  uploadedAt: Date;
  securityCode: string;
  isActive: boolean;
  accessCount: number;
  privacyStatus: 'private' | 'unlisted' | 'public';
  isPubliclyAccessible: boolean;
  isPublic: boolean;
  viewCount: number;
  gcsPath?: string;
  publicSlug?: string;
  publicWebsiteUrl?: string;
  linkExpirationHours?: number;
  linkExpiresAt?: Date;
}

/**
 * Validates that all required fields are present for video upload
 */
export const validateVideoUploadData = (data: Partial<VideoUploadData>): VideoUploadData => {
  const requiredFields = [
    'id', 'title', 'clientName', 'userId', 'fileName', 
    'publicUrl', 'size', 'contentType', 'uploadedAt', 
    'securityCode', 'isActive', 'accessCount', 'privacyStatus', 
    'isPubliclyAccessible', 'isPublic', 'viewCount'
  ];

  const missingFields = requiredFields.filter(field => 
    data[field as keyof VideoUploadData] === undefined || 
    data[field as keyof VideoUploadData] === null
  );

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields for video upload: ${missingFields.join(', ')}`);
  }

  // Validate data types
  if (typeof data.size !== 'number' || data.size <= 0) {
    throw new Error('Invalid file size');
  }

  if (typeof data.accessCount !== 'number' || data.accessCount < 0) {
    throw new Error('Invalid access count');
  }

  if (typeof data.viewCount !== 'number' || data.viewCount < 0) {
    throw new Error('Invalid view count');
  }

  if (!['private', 'unlisted', 'public'].includes(data.privacyStatus!)) {
    throw new Error('Invalid privacy status');
  }

  return data as VideoUploadData;
};

/**
 * Generates a secure random security code
 */
export const generateSecurityCode = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};