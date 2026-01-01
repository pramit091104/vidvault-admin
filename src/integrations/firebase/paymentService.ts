import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  orderBy,
  Timestamp,
  addDoc
} from 'firebase/firestore';
import { db } from './config';

export const PAYMENTS_COLLECTION = 'payments';

export interface PaymentRecord {
  id?: string;
  clientId?: string;
  clientName?: string;
  videoId?: string;
  videoSlug?: string;
  userId?: string;
  anonymousId?: string;
  type: 'pre' | 'post' | 'final' | 'video_completion';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  notes?: Record<string, string>;
  createdAt?: Date;
  updatedAt?: Date;
  completedAt?: Date;
}

// Create a new payment record
export const createPaymentRecord = async (paymentData: Omit<PaymentRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, PAYMENTS_COLLECTION), {
      ...paymentData,
      currency: paymentData.currency || 'INR',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating payment record:', error);
    throw new Error('Failed to create payment record');
  }
};

// Update payment status
export const updatePaymentStatus = async (
  paymentId: string, 
  status: PaymentRecord['status'],
  razorpayData?: {
    paymentId: string;
    signature: string;
  }
): Promise<void> => {
  try {
    const updateData: any = {
      status,
      updatedAt: Timestamp.now(),
    };

    if (status === 'completed') {
      updateData.completedAt = Timestamp.now();
    }

    if (razorpayData) {
      updateData.razorpayPaymentId = razorpayData.paymentId;
      updateData.razorpaySignature = razorpayData.signature;
    }

    await updateDoc(doc(db, PAYMENTS_COLLECTION, paymentId), updateData);
  } catch (error) {
    console.error('Error updating payment status:', error);
    throw new Error('Failed to update payment status');
  }
};

// Get payment by ID
export const getPaymentById = async (paymentId: string): Promise<PaymentRecord | null> => {
  try {
    const docSnap = await getDoc(doc(db, PAYMENTS_COLLECTION, paymentId));
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate(),
        updatedAt: docSnap.data().updatedAt?.toDate(),
        completedAt: docSnap.data().completedAt?.toDate(),
      } as PaymentRecord;
    }
    return null;
  } catch (error) {
    console.error('Error getting payment:', error);
    throw new Error('Failed to get payment');
  }
};

// Get payments for a user
export const getUserPayments = async (userId: string): Promise<PaymentRecord[]> => {
  try {
    const q = query(
      collection(db, PAYMENTS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      completedAt: doc.data().completedAt?.toDate(),
    })) as PaymentRecord[];
  } catch (error) {
    console.error('Error getting user payments:', error);
    throw new Error('Failed to get user payments');
  }
};

// Get payments for a video
export const getVideoPayments = async (videoSlug: string): Promise<PaymentRecord[]> => {
  try {
    const q = query(
      collection(db, PAYMENTS_COLLECTION),
      where('videoSlug', '==', videoSlug),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      completedAt: doc.data().completedAt?.toDate(),
    })) as PaymentRecord[];
  } catch (error) {
    console.error('Error getting video payments:', error);
    throw new Error('Failed to get video payments');
  }
};