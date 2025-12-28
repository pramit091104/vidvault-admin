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

// Collections for different upload services
export const YOUTUBE_VIDEOS_COLLECTION = 'youtubeClientCodes';
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

export interface YouTubeVideoRecord extends BaseVideoRecord {
  service: 'youtube';
  youtubeVideoId: string;
  youtubeVideoUrl: string;
  privacyStatus: 'private' | 'unlisted' | 'public';
  thumbnailUrl?: string;
  uploadStatus: 'processing' | 'completed' | 'failed';
  publicUrl?: string;
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
}

export type VideoRecord = YouTubeVideoRecord | GCSVideoRecord;

/**
 * Save YouTube video record to Firestore
 */
export const saveYouTubeVideo = async (
  videoData: Omit<YouTubeVideoRecord, 'uploadedAt' | 'service'> & { uploadedAt: Date }
): Promise<void> => {
  try {
    const docId = videoData.id;
    const docRef = doc(db, YOUTUBE_VIDEOS_COLLECTION, docId);
    const firestoreData = {
      ...videoData,
      service: 'youtube',
      uploadedAt: Timestamp.fromDate(videoData.uploadedAt),
      lastAccessed: videoData.lastAccessed ? Timestamp.fromDate(videoData.lastAccessed) : null,
    };
    await setDoc(docRef, firestoreData);
  } catch (error) {
    logger.error('Error saving YouTube video', error);
    throw error;
  }
};

/**
 * Save GCS video record to Firestore
 */
export const saveGCSVideo = async (
  videoData: Omit<GCSVideoRecord, 'uploadedAt' | 'service'> & { uploadedAt: Date }
): Promise<void> => {
  try {
    const docId = videoData.id;
    const docRef = doc(db, GCS_VIDEOS_COLLECTION, docId);
    const firestoreData = {
      ...videoData,
      service: 'gcs',
      uploadedAt: Timestamp.fromDate(videoData.uploadedAt),
      lastAccessed: videoData.lastAccessed ? Timestamp.fromDate(videoData.lastAccessed) : null,
    };
    await setDoc(docRef, firestoreData);
  } catch (error) {
    logger.error('Error saving GCS video', error);
    throw error;
  }
};

/**
 * Get YouTube video by ID
 */
export const getYouTubeVideo = async (videoId: string): Promise<YouTubeVideoRecord | null> => {
  try {
    const docRef = doc(db, YOUTUBE_VIDEOS_COLLECTION, videoId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ...data,
        uploadedAt: data.uploadedAt.toDate(),
        lastAccessed: data.lastAccessed ? data.lastAccessed.toDate() : undefined,
      } as YouTubeVideoRecord;
    }
    return null;
  } catch (error) {
    logger.error('Error retrieving YouTube video', error);
    throw error;
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
      } as GCSVideoRecord;
    }
    return null;
  } catch (error) {
    logger.error('Error retrieving GCS video', error);
    throw error;
  }
};

/**
 * Get all videos for a specific user from both collections
 */
export const getAllVideosForUser = async (
  userId: string, 
  maxResults: number = 50
): Promise<VideoRecord[]> => {
  try {
   
    // Get YouTube videos
    const youtubeQuery = query(
      collection(db, YOUTUBE_VIDEOS_COLLECTION),
      where('userId', '==', userId),
      where('isActive', '==', true),
      orderBy('uploadedAt', 'desc'),
      limit(maxResults)
    );
    
    const youtubeSnapshot = await getDocs(youtubeQuery);
    const youtubeVideos: YouTubeVideoRecord[] = [];
    
    youtubeSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log('YouTube video doc:', doc.id, data);
      youtubeVideos.push({
        ...data,
        uploadedAt: data.uploadedAt.toDate(),
        lastAccessed: data.lastAccessed ? data.lastAccessed.toDate() : undefined,
      } as YouTubeVideoRecord);
    });

    // Get GCS videos - also try query with just userId if first query returns nothing
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
            } as GCSVideoRecord);
          }
        });
      } catch (fallbackError) {
        console.error('Fallback GCS query also failed:', fallbackError);
      }
    }

    // Combine and sort by upload date
    const allVideos = [...youtubeVideos, ...gcsVideos];
    const sorted = allVideos.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()).slice(0, maxResults);
    return sorted;
  } catch (error) {
    logger.error('Error retrieving all videos for user', error);
    throw error;
  }
};

/**
 * Update video access count and last accessed timestamp
 */
export const updateVideoAccess = async (
  videoId: string, 
  service: 'youtube' | 'gcs'
): Promise<void> => {
  try {
    const collectionName = service === 'youtube' ? YOUTUBE_VIDEOS_COLLECTION : GCS_VIDEOS_COLLECTION;
    const docRef = doc(db, collectionName, videoId);
    
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
export const deactivateVideo = async (
  videoId: string, 
  service: 'youtube' | 'gcs'
): Promise<void> => {
  try {
    const collectionName = service === 'youtube' ? YOUTUBE_VIDEOS_COLLECTION : GCS_VIDEOS_COLLECTION;
    const docRef = doc(db, collectionName, videoId);
    
    await updateDoc(docRef, { isActive: false });
  } catch (error) {
    logger.error('Error deactivating video', error);
    throw error;
  }
};

/**
 * Delete a video record permanently
 */
export const deleteVideo = async (
  videoId: string, 
  service: 'youtube' | 'gcs'
): Promise<void> => {
  try {
    // First delete all comments associated with this video
    await deleteCommentsByVideoId(videoId);
    
    // Then delete the video record
    const collectionName = service === 'youtube' ? YOUTUBE_VIDEOS_COLLECTION : GCS_VIDEOS_COLLECTION;
    const docRef = doc(db, collectionName, videoId);
    
    await deleteDoc(docRef);
    
    logger.info(`Successfully deleted video ${videoId} and its comments`);
  } catch (error) {
    logger.error('Error deleting video', error);
    throw error;
  }
};

/**
 * Get public video by slug
 */
export const getPublicVideoBySlug = async (slug: string): Promise<VideoRecord | null> => {
  try {
    // Search in YouTube videos first
    const youtubeQuery = query(
      collection(db, YOUTUBE_VIDEOS_COLLECTION),
      where('publicSlug', '==', slug),
      where('isPublic', '==', true),
      where('isActive', '==', true),
      limit(1)
    );
    
    const youtubeSnapshot = await getDocs(youtubeQuery);
    if (!youtubeSnapshot.empty) {
      const doc = youtubeSnapshot.docs[0];
      const data = doc.data();
      return {
        ...data,
        uploadedAt: data.uploadedAt.toDate(),
        lastAccessed: data.lastAccessed ? data.lastAccessed.toDate() : undefined,
      } as YouTubeVideoRecord;
    }
    
    // Search in GCS videos
    const gcsQuery = query(
      collection(db, GCS_VIDEOS_COLLECTION),
      where('publicSlug', '==', slug),
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
    
    return null;
  } catch (error) {
    logger.error('Error retrieving public video by slug', error);
    throw error;
  }
};

/**
 * Update public video view count
 */
export const updateVideoViewCount = async (
  slug: string, 
  service: 'youtube' | 'gcs'
): Promise<void> => {
  try {
    const collectionName = service === 'youtube' ? YOUTUBE_VIDEOS_COLLECTION : GCS_VIDEOS_COLLECTION;
    const docsQuery = query(
      collection(db, collectionName),
      where('publicSlug', '==', slug),
      limit(1)
    );
    
    const snapshot = await getDocs(docsQuery);
    if (!snapshot.empty) {
      const docRef = doc(db, collectionName, snapshot.docs[0].id);
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
 * Toggle public access for a video
 */
export const toggleVideoPublicAccess = async (
  videoId: string, 
  service: 'youtube' | 'gcs',
  isPublic: boolean,
  publicSlug?: string
): Promise<void> => {
  try {
    const collectionName = service === 'youtube' ? YOUTUBE_VIDEOS_COLLECTION : GCS_VIDEOS_COLLECTION;
    const docRef = doc(db, collectionName, videoId);
    
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
