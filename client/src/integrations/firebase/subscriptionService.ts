import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from './config';
import { getApiBaseUrl } from '../../config/environment';

export const SUBSCRIPTIONS_COLLECTION = 'subscriptions';

export interface SubscriptionRecord {
  userId: string;
  tier: 'free' | 'premium';
  videoUploadsUsed: number;
  maxVideoUploads: number;
  clientsUsed: number;
  maxClients: number;
  maxFileSize: number; // in MB
  subscriptionDate?: Date;
  expiryDate?: Date;
  paymentId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  status: 'active' | 'expired' | 'cancelled';
  createdAt?: Date;
  updatedAt?: Date;
}

// Create or update subscription record
export const saveSubscription = async (subscriptionData: Omit<SubscriptionRecord, 'createdAt' | 'updatedAt'>): Promise<void> => {
  try {
    const docRef = doc(db, SUBSCRIPTIONS_COLLECTION, subscriptionData.userId);
    const now = Timestamp.now();

    const firestoreData = {
      ...subscriptionData,
      subscriptionDate: subscriptionData.subscriptionDate ? Timestamp.fromDate(subscriptionData.subscriptionDate) : null,
      expiryDate: subscriptionData.expiryDate ? Timestamp.fromDate(subscriptionData.expiryDate) : null,
      updatedAt: now,
    };

    // Check if document exists
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      // Create new document
      await setDoc(docRef, {
        ...firestoreData,
        createdAt: now,
      });
    } else {
      // Update existing document
      await updateDoc(docRef, firestoreData);
    }
  } catch (error) {
    console.error('Error saving subscription:', error);
    throw new Error('Failed to save subscription');
  }
};

// Get subscription for a user (with caching)
export const getSubscription = async (userId: string): Promise<SubscriptionRecord | null> => {
  try {
    const { auth } = await import('./config');
    const token = await auth.currentUser?.getIdToken();

    const response = await fetch(`${getApiBaseUrl()}/api/subscription/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get subscription');
    }

    const data = await response.json();
    return data.subscription;
  } catch (error) {
    console.error('Error getting subscription:', error);

    // Fallback to direct Firestore query
    try {
      const docRef = doc(db, SUBSCRIPTIONS_COLLECTION, userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          ...data,
          subscriptionDate: data.subscriptionDate?.toDate(),
          expiryDate: data.expiryDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as SubscriptionRecord;
      }

      return null;
    } catch (fallbackError) {
      console.error('Fallback subscription query failed:', fallbackError);
      throw new Error('Failed to get subscription');
    }
  }
};

// Update subscription status
export const updateSubscriptionStatus = async (userId: string, status: 'active' | 'expired' | 'cancelled'): Promise<void> => {
  try {
    const docRef = doc(db, SUBSCRIPTIONS_COLLECTION, userId);
    await updateDoc(docRef, {
      status,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating subscription status:', error);
    throw new Error('Failed to update subscription status');
  }
};

// Increment video upload count
export const incrementVideoUploadCount = async (userId: string): Promise<void> => {
  try {
    const { auth } = await import('./config');
    const token = await auth.currentUser?.getIdToken();

    const response = await fetch(`${getApiBaseUrl()}/api/subscription/increment-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ userId })
    });

    if (!response.ok) {
      throw new Error('Failed to increment video upload count');
    }
  } catch (error) {
    console.error('Error incrementing video upload count:', error);
    throw new Error('Failed to increment video upload count');
  }
};

// Increment client count
export const incrementClientCount = async (userId: string): Promise<void> => {
  try {
    const { auth } = await import('./config');
    const token = await auth.currentUser?.getIdToken();

    const response = await fetch(`${getApiBaseUrl()}/api/subscription/increment-client`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ userId })
    });

    if (!response.ok) {
      throw new Error('Failed to increment client count');
    }
  } catch (error) {
    console.error('Error incrementing client count:', error);
    throw new Error('Failed to increment client count');
  }
};

// Reset monthly upload count (to be called by a scheduled function)
export const resetMonthlyUploadCount = async (userId: string): Promise<void> => {
  try {
    const docRef = doc(db, SUBSCRIPTIONS_COLLECTION, userId);
    await updateDoc(docRef, {
      videoUploadsUsed: 0,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error resetting upload count:', error);
    throw new Error('Failed to reset upload count');
  }
};