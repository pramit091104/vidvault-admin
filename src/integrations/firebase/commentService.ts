import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from './config';

export interface DBComment {
  id: string;
  videoTitle: string;
  timestamp?: string;
  message: string;
  date: string; // ISO date string
  createdAt: string; // ISO date string
}

export interface ClientComments {
  code: string;
  clientName: string;
  comments: DBComment[];
}

/**
 * Fetches comments for a specific client and security code
 */
export const getClientComments = async (
  clientName: string,
  securityCode: string
): Promise<ClientComments | null> => {
  try {
    // Create document ID in format "clientname_code"
    const documentId = `${clientName}_${securityCode}`;
    const docRef = doc(db, 'comments', documentId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data() as Omit<ClientComments, 'id'>;
    
    // Verify security code matches (optional but good for security)
    if (data.code !== securityCode) {
      throw new Error('Invalid security code');
    }

    return {
      ...data,
      comments: data.comments || []
    };
  } catch (error) {
    console.error('Error fetching comments:', error);
    throw new Error('Failed to fetch comments');
  }
};

/**
 * Adds a new comment for a client
 */
export const addClientComment = async (
  clientName: string,
  securityCode: string,
  videoTitle: string,
  message: string,
  timestamp?: string
): Promise<DBComment> => {
  try {
    // Create document ID in format "clientname_code"
    const documentId = `${clientName}_${securityCode}`;
    const docRef = doc(db, 'comments', documentId);
    const now = new Date().toISOString();
    
    const newComment = {
      id: Date.now().toString(),
      videoTitle,
      timestamp,
      message,
      date: now,
      createdAt: now
    };

    await updateDoc(docRef, {
      clientName,
      comments: arrayUnion(newComment)
    });

    return newComment;
  } catch (error) {
    console.error('Error adding comment:', error);
    throw new Error('Failed to add comment');
  }
};

/**
 * Gets comments for a specific video from client's comments
 */
export const getVideoCommentsFromClient = async (
  clientName: string,
  securityCode: string,
  videoTitle: string
): Promise<DBComment[]> => {
  try {
    const clientData = await getClientComments(clientName, securityCode);
    if (!clientData) {
      return [];
    }

    // Filter comments by video title
    return clientData.comments.filter(comment => 
      comment.videoTitle === videoTitle
    );
  } catch (error) {
    console.error('Error fetching video comments:', error);
    throw new Error('Failed to fetch video comments');
  }
};
