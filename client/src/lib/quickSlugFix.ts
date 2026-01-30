import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { generateVideoSlug } from './slugGenerator';

const GCS_VIDEOS_COLLECTION = 'gcsClientCodes';

/**
 * Quick fix for the specific video with slug "true"
 * This can be called from browser console
 */
export const fixTrueSlug = async (): Promise<void> => {
  try {
    console.log('🔍 Looking for video with slug "true"...');
    
    // Find the video with publicSlug "true"
    const videosQuery = query(
      collection(db, GCS_VIDEOS_COLLECTION),
      where('publicSlug', '==', 'true'),
      where('isPublic', '==', true)
    );
    
    const snapshot = await getDocs(videosQuery);
    
    if (snapshot.empty) {
      console.log('❌ No video found with slug "true"');
      return;
    }
    
    const videoDoc = snapshot.docs[0];
    const videoData = videoDoc.data();
    
    console.log('📹 Found video:', {
      id: videoDoc.id,
      title: videoData.title,
      clientName: videoData.clientName,
      currentSlug: videoData.publicSlug
    });
    
    // Generate a proper slug
    const newSlug = generateVideoSlug(
      videoData.clientName || 'video',
      videoData.title || 'untitled'
    );
    
    // Update the video
    const docRef = doc(db, GCS_VIDEOS_COLLECTION, videoDoc.id);
    await updateDoc(docRef, {
      publicSlug: newSlug
    });
    
    console.log(`✅ Fixed! New URL: https://previu.online/watch/${newSlug}`);
    console.log(`📋 Old URL: https://previu.online/watch/true (no longer works)`);
    
    return newSlug;
  } catch (error) {
    console.error('❌ Error fixing slug:', error);
    throw error;
  }
};

// Make it available globally
if (typeof window !== 'undefined') {
  (window as any).fixTrueSlug = fixTrueSlug;
}