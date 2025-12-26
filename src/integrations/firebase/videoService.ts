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
import { increment } from 'firebase/firestore';

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
    console.log('getAllVideosForUser called with userId:', userId);
    
    // Get YouTube videos
    const youtubeQuery = query(
      collection(db, YOUTUBE_VIDEOS_COLLECTION),
      where('userId', '==', userId),
      where('isActive', '==', true),
      orderBy('uploadedAt', 'desc'),
      limit(maxResults)
    );
    
    console.log('Executing YouTube query...');
    const youtubeSnapshot = await getDocs(youtubeQuery);
    console.log('YouTube videos found:', youtubeSnapshot.size);
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
      
      console.log('Executing GCS query (with isActive)...');
      const gcsSnapshot = await getDocs(gcsQuery);
      console.log('GCS videos found (with isActive):', gcsSnapshot.size);
      
      gcsSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('GCS video doc:', doc.id, data);
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
    console.log('Total videos returned:', sorted.length);
    return sorted;
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
    console.error('Error retrieving public video by slug:', error);
    throw new Error('Failed to retrieve public video from Firestore');
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
    console.error('Error updating video view count:', error);
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
    console.error('Error toggling video public access:', error);
    throw new Error('Failed to update video public access in Firestore');
  }
};
