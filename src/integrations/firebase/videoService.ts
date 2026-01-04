import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  deleteDoc,
  orderBy,
  limit,
  Timestamp 
} from 'firebase/firestore';
import { db } from './config';
import { deleteCommentsByVideoId } from './commentService';
import { increment } from 'firebase/firestore';
import { ref, getDownloadURL, uploadBytes } from 'firebase/storage';
import { logger } from '../../lib/logger';

// Collection for GCS video uploads
export const GCS_VIDEOS_COLLECTION = 'gcsClientCodes';

export interface BaseVideoRecord {
  id: string;
  title: string;
  description?: string;
  clientName: string;
  userId?: string;
  uploadedAt: Date;
  securityCode: string;
  isActive: boolean;
  accessCount: number;
  lastAccessed?: Date;
  isPublic?: boolean;
  publicSlug?: string;
  viewCount?: number;
}

export interface GCSVideoRecord extends BaseVideoRecord {
  service: 'gcs';
  fileName: string;
  publicUrl: string;
  size: number;
  contentType: string;
  privacyStatus: 'private' | 'unlisted' | 'public';
  isPubliclyAccessible: boolean;
  publicWebsiteUrl?: string;
  linkExpiresAt?: Date;
  linkExpirationHours?: number; // User-configurable expiration time
}

export type VideoRecord = GCSVideoRecord;

/**
 * Save GCS video record to Firestore with retry logic
 */
export const saveGCSVideo = async (
  videoData: Omit<GCSVideoRecord, 'uploadedAt' | 'service'> & { uploadedAt: Date }
): Promise<void> => {
  const maxRetries = 3;
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`saveGCSVideo attempt ${attempt}/${maxRetries} with data:`, {
        id: videoData.id,
        userId: videoData.userId,
        isActive: videoData.isActive,
        hasRequiredFields: !!(videoData.id && videoData.userId && videoData.title)
      });
      
      const docId = videoData.id;
      const docRef = doc(db, GCS_VIDEOS_COLLECTION, docId);
      const firestoreData = {
        ...videoData,
        service: 'gcs',
        uploadedAt: Timestamp.fromDate(videoData.uploadedAt),
        lastAccessed: videoData.lastAccessed ? Timestamp.fromDate(videoData.lastAccessed) : null,
        linkExpiresAt: videoData.linkExpiresAt ? Timestamp.fromDate(videoData.linkExpiresAt) : null,
      };
      
      console.log(`Attempt ${attempt}: About to save to Firestore with docId:`, docId);
      await setDoc(docRef, firestoreData);
      console.log(`Attempt ${attempt}: Successfully saved to Firestore`);
      return; // Success, exit the retry loop
    } catch (error: any) {
      lastError = error;
      console.error(`Attempt ${attempt} failed:`, error);
      
      // If it's the last attempt, throw the error
      if (attempt === maxRetries) {
        logger.error('Error saving GCS video after all retries', error);
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
      console.log(`Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Get GCS video by ID
 */
export const getGCSVideo = async (videoId: string): Promise<GCSVideoRecord | null> => {
  try {
    const docRef = doc(db, GCS_VIDEOS_COLLECTION, videoId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ...data,
        uploadedAt: data.uploadedAt.toDate(),
        lastAccessed: data.lastAccessed ? data.lastAccessed.toDate() : undefined,
        linkExpiresAt: data.linkExpiresAt ? data.linkExpiresAt.toDate() : undefined,
      } as GCSVideoRecord;
    }
    return null;
  } catch (error) {
    logger.error('Error retrieving GCS video', error);
    throw error;
  }
};

/**
 * Get all videos for a specific user from GCS collection
 */
export const getAllVideosForUser = async (
  userId: string, 
  maxResults: number = 50
): Promise<VideoRecord[]> => {
  try {
    // Get GCS videos - try query with isActive first, fallback if needed
    let gcsVideos: GCSVideoRecord[] = [];
    try {
      const gcsQuery = query(
        collection(db, GCS_VIDEOS_COLLECTION),
        where('userId', '==', userId),
        where('isActive', '==', true),
        orderBy('uploadedAt', 'desc'),
        limit(maxResults)
      );
      
      const gcsSnapshot = await getDocs(gcsQuery);
      
      gcsSnapshot.forEach((doc) => {
        const data = doc.data();
        gcsVideos.push({
          ...data,
          uploadedAt: data.uploadedAt.toDate(),
          lastAccessed: data.lastAccessed ? data.lastAccessed.toDate() : undefined,
          linkExpiresAt: data.linkExpiresAt ? data.linkExpiresAt.toDate() : undefined,
        } as GCSVideoRecord);
      });
    } catch (gcsError: any) {
      console.log('GCS query with isActive failed:', gcsError.message);
      // Fallback: query without isActive condition
      try {
        console.log('Trying fallback GCS query (userId only)...');
        const fallbackGcsQuery = query(
          collection(db, GCS_VIDEOS_COLLECTION),
          where('userId', '==', userId),
          orderBy('uploadedAt', 'desc'),
          limit(maxResults)
        );
        const fallbackSnapshot = await getDocs(fallbackGcsQuery);
        console.log('GCS videos found (fallback):', fallbackSnapshot.size);
        
        fallbackSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.isActive !== false) { // Include active and missing isActive field
            console.log('GCS video doc (fallback):', doc.id, data);
            gcsVideos.push({
              ...data,
              uploadedAt: data.uploadedAt.toDate(),
              lastAccessed: data.lastAccessed ? data.lastAccessed.toDate() : undefined,
              linkExpiresAt: data.linkExpiresAt ? data.linkExpiresAt.toDate() : undefined,
            } as GCSVideoRecord);
          }
        });
      } catch (fallbackError) {
        console.error('Fallback GCS query also failed:', fallbackError);
      }
    }

    // Sort by upload date and limit results
    const sorted = gcsVideos.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()).slice(0, maxResults);
    return sorted;
  } catch (error) {
    logger.error('Error retrieving all videos for user', error);
    throw error;
  }
};

/**
 * Update video access count and last accessed timestamp
 */
export const updateVideoAccess = async (videoId: string): Promise<void> => {
  try {
    const docRef = doc(db, GCS_VIDEOS_COLLECTION, videoId);
    
    await updateDoc(docRef, {
      accessCount: increment(1),
      lastAccessed: Timestamp.now(),
    });
  } catch (error) {
    logger.error('Error updating video access', error);
    throw error;
  }
};

/**
 * Deactivate a video record (soft delete)
 */
export const deactivateVideo = async (videoId: string): Promise<void> => {
  try {
    const docRef = doc(db, GCS_VIDEOS_COLLECTION, videoId);
    
    await updateDoc(docRef, { isActive: false });
  } catch (error) {
    logger.error('Error deactivating video', error);
    throw error;
  }
};

/**
 * Delete a video record permanently
 */
export const deleteVideo = async (videoId: string): Promise<void> => {
  try {
    // First delete all comments associated with this video
    await deleteCommentsByVideoId(videoId);
    
    // Then delete the video record
    const docRef = doc(db, GCS_VIDEOS_COLLECTION, videoId);
    
    await deleteDoc(docRef);
    
    logger.info(`Successfully deleted video ${videoId} and its comments`);
  } catch (error) {
    logger.error('Error deleting video', error);
    throw error;
  }
};

/**
 * Get video by slug (public) or ID (private)
 */
export const getVideoBySlugOrId = async (slugOrId: string): Promise<VideoRecord | null> => {
  try {
    // First, try to find a public video by slug
    const gcsQuery = query(
      collection(db, GCS_VIDEOS_COLLECTION),
      where('publicSlug', '==', slugOrId),
      where('isPublic', '==', true),
      where('isActive', '==', true),
      limit(1)
    );
    
    const gcsSnapshot = await getDocs(gcsQuery);
    if (!gcsSnapshot.empty) {
      const doc = gcsSnapshot.docs[0];
      const data = doc.data();
      return {
        ...data,
        uploadedAt: data.uploadedAt.toDate(),
        lastAccessed: data.lastAccessed ? data.lastAccessed.toDate() : undefined,
      } as GCSVideoRecord;
    }
    
    // If no public video found, try to find by video ID (for private videos)
    // This allows direct access to videos by their ID even if not made public
    try {
      const videoById = await getGCSVideo(slugOrId);
      if (videoById && videoById.isActive) {
        // Return the video even if it's private - the watch page can handle the display
        return videoById;
      }
    } catch (error) {
      // If video ID lookup fails, continue to return null
      console.log('Video ID lookup failed:', error);
    }
    
    return null;
  } catch (error) {
    logger.error('Error retrieving video by slug or ID', error);
    throw error;
  }
};

/**
 * Update public video view count
 */
export const updateVideoViewCount = async (slug: string): Promise<void> => {
  try {
    const docsQuery = query(
      collection(db, GCS_VIDEOS_COLLECTION),
      where('publicSlug', '==', slug),
      limit(1)
    );
    
    const snapshot = await getDocs(docsQuery);
    if (!snapshot.empty) {
      const docRef = doc(db, GCS_VIDEOS_COLLECTION, snapshot.docs[0].id);
      await updateDoc(docRef, {
        viewCount: increment(1),
        lastAccessed: Timestamp.now(),
      });
    }
  } catch (error) {
    logger.error('Error updating video view count', error);
    // Don't throw error for view count updates to avoid breaking user experience
  }
};

/**
 * Update video link expiration settings
 */
export const updateVideoLinkExpiration = async (
  videoId: string,
  expirationHours: number | null
): Promise<void> => {
  try {
    const docRef = doc(db, GCS_VIDEOS_COLLECTION, videoId);
    
    const updateData: any = {
      linkExpirationHours: expirationHours,
    };
    
    // Calculate expiration date if hours are provided
    if (expirationHours && expirationHours > 0) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expirationHours);
      updateData.linkExpiresAt = Timestamp.fromDate(expiresAt);
    } else {
      // Remove expiration if set to null/0
      updateData.linkExpiresAt = null;
    }
    
    await updateDoc(docRef, updateData);
    logger.info(`Updated link expiration for video ${videoId}: ${expirationHours} hours`);
  } catch (error) {
    logger.error('Error updating video link expiration', error);
    throw error;
  }
};

/**
 * Check if a video link has expired
 */
export const isVideoLinkExpired = (video: GCSVideoRecord): boolean => {
  if (!video.linkExpiresAt) {
    return false; // No expiration set
  }
  
  return new Date() > video.linkExpiresAt;
};

/**
 * Toggle public access for a video
 */
export const toggleVideoPublicAccess = async (
  videoId: string,
  isPublic: boolean,
  publicSlug?: string
): Promise<void> => {
  try {
    const docRef = doc(db, GCS_VIDEOS_COLLECTION, videoId);
    
    const updateData: any = { isPublic };
    if (isPublic && publicSlug) {
      updateData.publicSlug = publicSlug;
    }
    
    await updateDoc(docRef, updateData);
  } catch (error) {
    logger.error('Error toggling video public access', error);
    throw error;
  }
};
