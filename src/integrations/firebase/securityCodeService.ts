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
import { VideoSecurityCode, createSecurityCodeRecord } from '@/lib/securityCode';

const COLLECTION_NAME = 'videoSecurityCodes';

/**
 * Saves a security code record to Firestore using the security code as document ID
 * @param securityCodeData - Security code data to save
 * @returns Promise that resolves when the record is saved
 */
export const saveSecurityCode = async (
  securityCodeData: Omit<VideoSecurityCode, 'uploadedAt'> & { uploadedAt: Date }
): Promise<void> => {
  try {
    // Use securityCode as document ID
    const docId = securityCodeData.securityCode;
    const docRef = doc(db, COLLECTION_NAME, docId);

    // Build the data object, excluding undefined values
    const firestoreData: any = {
      videoId: securityCodeData.videoId,
      securityCode: securityCodeData.securityCode,
      title: securityCodeData.title,
      clientName: securityCodeData.clientName,
      uploadedAt: Timestamp.fromDate(securityCodeData.uploadedAt),
      isActive: securityCodeData.isActive,
      accessCount: securityCodeData.accessCount,
    };

    // Only include optional fields if they have values
    if (securityCodeData.youtubeVideoId !== undefined) {
      firestoreData.youtubeVideoId = securityCodeData.youtubeVideoId;
    }
    if (securityCodeData.youtubeVideoUrl !== undefined) {
      firestoreData.youtubeVideoUrl = securityCodeData.youtubeVideoUrl;
    }
    if (securityCodeData.userId !== undefined) {
      firestoreData.userId = securityCodeData.userId;
    }
    if (securityCodeData.lastAccessed !== undefined) {
      firestoreData.lastAccessed = Timestamp.fromDate(securityCodeData.lastAccessed);
    }

    await setDoc(docRef, firestoreData);
  } catch (error) {
    console.error('Error saving security code:', error);
    throw new Error('Failed to save security code to Firestore');
  }
};

/**
 * Retrieves a security code record by client name
 * @param clientName - The client name to search for
 * @returns Promise that resolves to the security code record or null
 */
export const getSecurityCodeByClientName = async (clientName: string): Promise<VideoSecurityCode | null> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('clientName', '==', clientName),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      const data = docSnap.data();
      return {
        ...data,
        uploadedAt: data.uploadedAt.toDate(),
        lastAccessed: data.lastAccessed ? data.lastAccessed.toDate() : undefined,
      } as VideoSecurityCode;
    }
    return null;
  } catch (error) {
    console.error('Error retrieving security code by client name:', error);
    throw new Error('Failed to retrieve security code from Firestore');
  }
};

/**
 * Retrieves a security code record by the security code itself
 * @param securityCode - The security code to search for
 * @returns Promise that resolves to the security code record or null
 */
export const getSecurityCodeByCode = async (securityCode: string): Promise<VideoSecurityCode | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, securityCode);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();

      // Update access count and last accessed timestamp
      await updateDoc(docRef, {
        accessCount: (data.accessCount || 0) + 1,
        lastAccessed: Timestamp.now(),
      });

      return {
        ...data,
        uploadedAt: data.uploadedAt.toDate(),
        lastAccessed: data.lastAccessed ? data.lastAccessed.toDate() : undefined,
      } as VideoSecurityCode;
    }
    return null;
  } catch (error) {
    console.error('Error retrieving security code by code:', error);
    throw new Error('Failed to retrieve security code from Firestore');
  }
};

/**
 * Creates and saves a new security code for a video
 * @param service - 'youtube' or 'gcs'
 * @param title - Video title
 * @param clientName - Client name
 * @param youtubeVideoId - YouTube video ID (optional)
 * @param youtubeVideoUrl - YouTube video URL (optional)
 * @param userId - User ID who uploaded the video (optional)
 * @returns Promise that resolves to the created security code record
 */
export const createAndSaveSecurityCode = async (
  service: 'youtube' | 'gcs',
  title: string,
  clientName: string,
  youtubeVideoId?: string,
  youtubeVideoUrl?: string,
  userId?: string
): Promise<VideoSecurityCode> => {
  try {
    const securityCodeRecord = createSecurityCodeRecord(
      service,
      title,
      clientName,
      youtubeVideoId,
      youtubeVideoUrl,
      userId
    );
    
    await saveSecurityCode(securityCodeRecord);
    return securityCodeRecord;
  } catch (error) {
    console.error('Error creating and saving security code:', error);
    throw new Error('Failed to create and save security code');
  }
};

/**
 * Retrieves a security code record by YouTube video ID
 * @param youtubeVideoId - The YouTube video ID to search for
 * @returns Promise that resolves to the security code record or null
 */
export const getSecurityCodeByYoutubeVideoId = async (youtubeVideoId: string): Promise<VideoSecurityCode | null> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('youtubeVideoId', '==', youtubeVideoId),
      where('isActive', '==', true),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      
      return {
        ...data,
        uploadedAt: data.uploadedAt.toDate(),
        lastAccessed: data.lastAccessed ? data.lastAccessed.toDate() : undefined,
      } as VideoSecurityCode;
    }
    return null;
  } catch (error) {
    console.error('Error retrieving security code by YouTube video ID:', error);
    throw new Error('Failed to retrieve security code from Firestore');
  }
};

/**
 * Retrieves all security codes for a specific user
 * @param userId - The user ID to search for
 * @param maxResults - Maximum number of results to return (default: 50)
 * @returns Promise that resolves to an array of security code records
 */
export const getSecurityCodesByUser = async (
  userId: string, 
  maxResults: number = 50
): Promise<VideoSecurityCode[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      orderBy('uploadedAt', 'desc'),
      limit(maxResults)
    );
    
    const querySnapshot = await getDocs(q);
    const securityCodes: VideoSecurityCode[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      securityCodes.push({
        ...data,
        uploadedAt: data.uploadedAt.toDate(),
        lastAccessed: data.lastAccessed ? data.lastAccessed.toDate() : undefined,
      } as VideoSecurityCode);
    });
    
    return securityCodes;
  } catch (error) {
    console.error('Error retrieving security codes by user:', error);
    throw new Error('Failed to retrieve security codes from Firestore');
  }
};

/**
 * Updates a security code record by client name
 * @param clientName - The client name of the record to update
 * @param updates - The fields to update
 * @returns Promise that resolves when the record is updated
 */
export const updateSecurityCode = async (
  securityCode: string,
  updates: Partial<Omit<VideoSecurityCode, 'uploadedAt' | 'clientName'>>
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, securityCode);
    const firestoreUpdates: any = {
      ...updates,
    };
    if (updates.lastAccessed) {
      firestoreUpdates.lastAccessed = Timestamp.fromDate(updates.lastAccessed as Date);
    }
    await updateDoc(docRef, firestoreUpdates);
  } catch (error) {
    console.error('Error updating security code:', error);
    throw new Error('Failed to update security code in Firestore');
  }
};

/**
 * Deactivates a security code by client name (soft delete)
 * @param clientName - The client name of the record to deactivate
 * @returns Promise that resolves when the record is deactivated
 */
export const deactivateSecurityCode = async (securityCode: string): Promise<void> => {
  try {
    await updateSecurityCode(securityCode, { isActive: false });
  } catch (error) {
    console.error('Error deactivating security code:', error);
    throw new Error('Failed to deactivate security code');
  }
};

/**
 * Permanently deletes a security code record by client name
 * @param clientName - The client name of the record to delete
 * @returns Promise that resolves when the record is deleted
 */
export const deleteSecurityCode = async (securityCode: string): Promise<void> => {
  try {
    // Validate securityCode parameter
    if (!securityCode || typeof securityCode !== 'string' || securityCode.trim() === '') {
      throw new Error('Invalid security code provided for deletion');
    }

    // Sanitize securityCode for Firestore document ID
    const sanitizedCode = securityCode.trim();

    // Additional validation for Firestore document ID constraints
    if (sanitizedCode.includes('/') || sanitizedCode.includes('\\') || sanitizedCode.includes('.')) {
      throw new Error('Security code contains invalid characters for document ID');
    }

    const docRef = doc(db, COLLECTION_NAME, sanitizedCode);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting security code:', error);
    throw new Error('Failed to delete security code from Firestore');
  }
};
