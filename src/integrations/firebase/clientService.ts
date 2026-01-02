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
  Timestamp,
  addDoc
} from 'firebase/firestore';
import { db } from './config';
import { auth } from './config';

export const CLIENTS_COLLECTION = 'clients';

export interface ClientRecord {
  id?: string;
  clientName: string;
  work: string;
  status: "Done" | "Not paid yet" | "In progress" | "Not started";
  prePayment: number;
  paidPayment: number;
  finalPayment: number;
  duration: string;
  userId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Create a new client (frontend only - validation should be done separately)
export const createClient = async (clientData: Omit<ClientRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Validate that the client data belongs to the authenticated user
    if (clientData.userId && clientData.userId !== user.uid) {
      throw new Error('User ID mismatch - cannot create client for another user');
    }

    // Create directly in Firestore (validation should be done before calling this function)
    const docRef = await addDoc(collection(db, CLIENTS_COLLECTION), {
      ...clientData,
      userId: user.uid, // Ensure userId is set to authenticated user
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating client:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to create client');
  }
};

// Get all clients for a user
export const getClients = async (userId?: string): Promise<ClientRecord[]> => {
  try {
    let q;
    if (userId) {
      q = query(collection(db, CLIENTS_COLLECTION), where('userId', '==', userId), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, CLIENTS_COLLECTION), orderBy('createdAt', 'desc'));
    }
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data() as Omit<ClientRecord, 'id'> & {
        createdAt?: any;
        updatedAt?: any;
      };
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      } as ClientRecord;
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    throw new Error('Failed to fetch clients');
  }
};

// Get a single client by ID
export const getClient = async (clientId: string): Promise<ClientRecord | null> => {
  try {
    const docRef = doc(db, CLIENTS_COLLECTION, clientId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate(),
        updatedAt: docSnap.data().updatedAt?.toDate(),
      } as ClientRecord;
    }
    return null;
  } catch (error) {
    console.error('Error fetching client:', error);
    throw new Error('Failed to fetch client');
  }
};

// Update a client
export const updateClient = async (clientId: string, clientData: Partial<ClientRecord>): Promise<void> => {
  try {
    const docRef = doc(db, CLIENTS_COLLECTION, clientId);
    await updateDoc(docRef, {
      ...clientData,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating client:', error);
    throw new Error('Failed to update client');
  }
};

// Delete a client
export const deleteClient = async (clientId: string): Promise<void> => {
  try {
    const docRef = doc(db, CLIENTS_COLLECTION, clientId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting client:', error);
    throw new Error('Failed to delete client');
  }
};

// Get client by name (for payment integration)
export const getClientByName = async (clientName: string, userId?: string): Promise<ClientRecord | null> => {
  try {
    // Validate input
    if (!clientName || clientName.trim().length === 0) {
      console.warn('getClientByName called with empty clientName');
      return null;
    }

    let q;
    if (userId) {
      q = query(
        collection(db, CLIENTS_COLLECTION), 
        where('clientName', '==', clientName.trim()),
        where('userId', '==', userId),
        limit(1)
      );
    } else {
      q = query(
        collection(db, CLIENTS_COLLECTION), 
        where('clientName', '==', clientName.trim()),
        limit(1)
      );
    }
    
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data() as Omit<ClientRecord, 'id'> & {
        createdAt?: any;
        updatedAt?: any;
      };
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      } as ClientRecord;
    }
    
    console.log(`No client found with name: "${clientName}"`);
    return null;
  } catch (error) {
    console.error('Error fetching client by name:', error);
    throw new Error(`Failed to fetch client by name: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
