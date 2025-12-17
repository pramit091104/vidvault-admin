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

// Collections for different upload services
export const YOUTUBE_VIDEOS_COLLECTION = 'youtubeVideos';
export const GCS_VIDEOS_COLLECTION = 'gcsVideos';

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
}

export interface YouTubeVideoRecord extends BaseVideoRecord {
  service: 'youtube';
  youtubeVideoId: string;
  youtubeVideoUrl: string;
  privacyStatus: 'private' | 'unlisted' | 'public';
  thumbnailUrl?: string;
  uploadStatus: 'processing' | 'completed' | 'failed';
}

export interface GCSVideoRecord extends BaseVideoRecord {
  service: 'gcs';
  fileName: string;
  publicUrl: string;
  size: number;
  contentType: string;
  privacyStatus: 'private' | 'unlisted' | 'public';
  isPubliclyAccessible: boolean;
}

export type VideoRecord = YouTubeVideoRecord | GCSVideoRecord;

/**
 * Save YouTube video record to Firestore
 */
export const saveYouTubeVideo = async (
  videoData: Omit<YouTubeVideoRecord, 'uploadedAt' | 'service'> & { uploadedAt: Date }
): Promise<void> => {
  try {
    const docRef = doc(db, YOUTUBE_VIDEOS_COLLECTION, videoData.id);
    const firestoreData = {
      ...videoData,
      service: 'youtube',
      uploadedAt: Timestamp.fromDate(videoData.uploadedAt),
      lastAccessed: videoData.lastAccessed ? Timestamp.fromDate(videoData.lastAccessed) : null,
    };
    await setDoc(docRef, firestoreData);
  } catch (error) {
    console.error('Error saving YouTube video:', error);
    throw new Error('Failed to save YouTube video to Firestore');
  }
};

/**
 * Save GCS video record to Firestore
 */
export const saveGCSVideo = async (
  videoData: Omit<GCSVideoRecord, 'uploadedAt' | 'service'> & { uploadedAt: Date }
): Promise<void> => {
  try {
    const docRef = doc(db, GCS_VIDEOS_COLLECTION, videoData.id);
    const firestoreData = {
      ...videoData,
      service: 'gcs',
      uploadedAt: Timestamp.fromDate(videoData.uploadedAt),
      lastAccessed: videoData.lastAccessed ? Timestamp.fromDate(videoData.lastAccessed) : null,
    };
    await setDoc(docRef, firestoreData);
  } catch (error) {
    console.error('Error saving GCS video:', error);
    throw new Error('Failed to save GCS video to Firestore');
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
    console.error('Error retrieving YouTube video:', error);
    throw new Error('Failed to retrieve YouTube video from Firestore');
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
    console.error('Error retrieving GCS video:', error);
    throw new Error('Failed to retrieve GCS video from Firestore');
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
      youtubeVideos.push({
        ...data,
        uploadedAt: data.uploadedAt.toDate(),
        lastAccessed: data.lastAccessed ? data.lastAccessed.toDate() : undefined,
      } as YouTubeVideoRecord);
    });

    // Get GCS videos
    const gcsQuery = query(
      collection(db, GCS_VIDEOS_COLLECTION),
      where('userId', '==', userId),
      where('isActive', '==', true),
      orderBy('uploadedAt', 'desc'),
      limit(maxResults)
    );
    
    const gcsSnapshot = await getDocs(gcsQuery);
    const gcsVideos: GCSVideoRecord[] = [];
    
    gcsSnapshot.forEach((doc) => {
      const data = doc.data();
      gcsVideos.push({
        ...data,
        uploadedAt: data.uploadedAt.toDate(),
        lastAccessed: data.lastAccessed ? data.lastAccessed.toDate() : undefined,
      } as GCSVideoRecord);
    });

    // Combine and sort by upload date
    const allVideos = [...youtubeVideos, ...gcsVideos];
    return allVideos.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()).slice(0, maxResults);
  } catch (error) {
    console.error('Error retrieving all videos for user:', error);
    throw new Error('Failed to retrieve videos from Firestore');
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
    console.error('Error updating video access:', error);
    throw new Error('Failed to update video access in Firestore');
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
    console.error('Error deactivating video:', error);
    throw new Error('Failed to deactivate video in Firestore');
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
    const collectionName = service === 'youtube' ? YOUTUBE_VIDEOS_COLLECTION : GCS_VIDEOS_COLLECTION;
    const docRef = doc(db, collectionName, videoId);
    
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting video:', error);
    throw new Error('Failed to delete video from Firestore');
  }
};

// Helper function for incrementing access count
const increment = (n: number) => ({
  value: n,
  type: 'increment'
});
