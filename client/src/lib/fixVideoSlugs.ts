import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { generateVideoSlug, isValidSlug } from './slugGenerator';

const GCS_VIDEOS_COLLECTION = 'gcsClientCodes';

/**
 * Fix videos that have invalid public slugs (like "true", "false", etc.)
 */
export const fixInvalidVideoSlugs = async (): Promise<void> => {
  try {
    console.log('🔍 Checking for videos with invalid slugs...');
    
    // Get all public videos
    const videosQuery = query(
      collection(db, GCS_VIDEOS_COLLECTION),
      where('isPublic', '==', true)
    );
    
    const snapshot = await getDocs(videosQuery);
    const videosToFix: any[] = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const slug = data.publicSlug;
      
      // Check if slug is invalid (like "true", "false", or doesn't meet criteria)
      if (!slug || !isValidSlug(slug) || slug === 'true' || slug === 'false') {
        videosToFix.push({
          id: doc.id,
          data,
          currentSlug: slug
        });
      }
    });
    
    if (videosToFix.length === 0) {
      console.log('✅ No videos with invalid slugs found');
      return;
    }
    
    console.log(`🔧 Found ${videosToFix.length} videos with invalid slugs. Fixing...`);
    
    // Get all existing valid slugs to avoid duplicates
    const existingSlugs = snapshot.docs
      .map(doc => doc.data().publicSlug)
      .filter(slug => slug && isValidSlug(slug) && slug !== 'true' && slug !== 'false');
    
    // Fix each video
    for (const video of videosToFix) {
      try {
        const newSlug = generateVideoSlug(
          video.data.clientName || 'video',
          video.data.title || 'untitled',
          existingSlugs
        );
        
        // Update the video with the new slug
        const docRef = doc(db, GCS_VIDEOS_COLLECTION, video.id);
        await updateDoc(docRef, {
          publicSlug: newSlug
        });
        
        // Add to existing slugs to avoid duplicates
        existingSlugs.push(newSlug);
        
        console.log(`✅ Fixed video "${video.data.title}": "${video.currentSlug}" → "${newSlug}"`);
      } catch (error) {
        console.error(`❌ Failed to fix video ${video.id}:`, error);
      }
    }
    
    console.log('🎉 Slug fixing complete!');
  } catch (error) {
    console.error('❌ Error fixing video slugs:', error);
    throw error;
  }
};

/**
 * Check if a specific video has an invalid slug
 */
export const checkVideoSlug = async (videoId: string): Promise<{ isValid: boolean; currentSlug?: string; suggestedSlug?: string }> => {
  try {
    const docRef = doc(db, GCS_VIDEOS_COLLECTION, videoId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists()) {
      return { isValid: false };
    }
    
    const data = docSnap.data();
    const currentSlug = data.publicSlug;
    
    if (!currentSlug || !isValidSlug(currentSlug) || currentSlug === 'true' || currentSlug === 'false') {
      const suggestedSlug = generateVideoSlug(
        data.clientName || 'video',
        data.title || 'untitled'
      );
      
      return {
        isValid: false,
        currentSlug,
        suggestedSlug
      };
    }
    
    return { isValid: true, currentSlug };
  } catch (error) {
    console.error('Error checking video slug:', error);
    return { isValid: false };
  }
};