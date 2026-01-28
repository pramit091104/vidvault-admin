import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  Timestamp 
} from 'firebase/firestore';
import { db, auth } from './config';
import { User } from 'firebase/auth';

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  name?: string;
  photoURL?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  subscriptionTier?: string;
  subscriptionStatus?: string;
}

const USERS_COLLECTION = 'users';

/**
 * Get user profile by ID
 */
export const getUserById = async (userId: string): Promise<UserProfile | null> => {
  try {
    const docRef = doc(db, USERS_COLLECTION, userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        lastLoginAt: data.lastLoginAt?.toDate(),
      } as UserProfile;
    }
    
    // If user profile doesn't exist in Firestore, try to get from Firebase Auth
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid === userId) {
      return {
        id: currentUser.uid,
        email: currentUser.email || '',
        displayName: currentUser.displayName || undefined,
        name: currentUser.displayName || undefined,
        photoURL: currentUser.photoURL || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
};

/**
 * Create or update user profile
 */
export const createOrUpdateUserProfile = async (user: User): Promise<void> => {
  try {
    const docRef = doc(db, USERS_COLLECTION, user.uid);
    const now = Timestamp.now();
    
    // Check if user profile already exists
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      // Update existing profile
      await updateDoc(docRef, {
        email: user.email,
        displayName: user.displayName,
        name: user.displayName,
        photoURL: user.photoURL,
        updatedAt: now,
        lastLoginAt: now,
      });
    } else {
      // Create new profile
      await setDoc(docRef, {
        id: user.uid,
        email: user.email,
        displayName: user.displayName,
        name: user.displayName,
        photoURL: user.photoURL,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      });
    }
  } catch (error) {
    console.error('Error creating/updating user profile:', error);
    throw error;
  }
};

/**
 * Update user subscription information
 */
export const updateUserSubscription = async (
  userId: string, 
  subscriptionTier: string, 
  subscriptionStatus: string
): Promise<void> => {
  try {
    const docRef = doc(db, USERS_COLLECTION, userId);
    
    await updateDoc(docRef, {
      subscriptionTier,
      subscriptionStatus,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating user subscription:', error);
    throw error;
  }
};

/**
 * Get current user profile
 */
export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return null;
  }
  
  return await getUserById(currentUser.uid);
};