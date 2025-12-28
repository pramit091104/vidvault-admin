import { collection, doc, setDoc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from './config';

export interface PaymentRecord {
  id: string;
  clientId: string;
  clientName: string;
  type: 'pre' | 'post' | 'final';
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
  notes?: Record<string, string>;
}

export const createPaymentRecord = async (payment: Omit<PaymentRecord, 'id' | 'createdAt'>): Promise<string> => {
  const paymentRef = doc(collection(db, 'payments'));
  const paymentData: PaymentRecord = {
    ...payment,
    id: paymentRef.id,
    createdAt: Timestamp.now()
  };
  
  await setDoc(paymentRef, paymentData);
  return paymentRef.id;
};

export const updatePaymentStatus = async (
  paymentId: string, 
  status: PaymentRecord['status'],
  additionalData?: Partial<PaymentRecord>
): Promise<void> => {
  const paymentRef = doc(db, 'payments', paymentId);
  const updateData: Partial<PaymentRecord> = {
    status,
    ...additionalData
  };
  
  if (status === 'completed') {
    updateData.completedAt = Timestamp.now();
  }
  
  await setDoc(paymentRef, updateData, { merge: true });
};

export const getClientPayments = async (clientId: string): Promise<PaymentRecord[]> => {
  const paymentsQuery = query(
    collection(db, 'payments'),
    where('clientId', '==', clientId),
    orderBy('createdAt', 'desc')
  );
  
  const querySnapshot = await getDocs(paymentsQuery);
  return querySnapshot.docs.map(doc => doc.data() as PaymentRecord);
};

export const getAllPayments = async (userId?: string): Promise<PaymentRecord[]> => {
  let paymentsQuery = query(
    collection(db, 'payments'),
    orderBy('createdAt', 'desc')
  );
  
  const querySnapshot = await getDocs(paymentsQuery);
  return querySnapshot.docs.map(doc => doc.data() as PaymentRecord);
};
