import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp, collection, addDoc, query, where, getDocs, orderBy, limit, QueryConstraint } from 'firebase/firestore';
import { db } from './config';

// Simple cache for storing comment queries
const commentCache = new Map<string, { data: TimestampedComment[], timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds cache TTL

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

/**
 * Interface for timestamped video comments
 */
export interface TimestampedComment {
  id: string;
  videoId: string;
  videoTitle: string;
  timestamp: number; // in seconds
  comment: string;
  userId: string;
  userName: string;
  userEmail: string;
  createdAt: string; // ISO date string
}

/**
 * Adds a timestamped comment to a video
 */
export const addTimestampedComment = async (
  commentData: Omit<TimestampedComment, 'id' | 'createdAt'>
): Promise<TimestampedComment> => {
  try {
    const commentsRef = collection(db, 'timestampedComments');
    const now = new Date().toISOString();
    
    const newComment = {
      ...commentData,
      createdAt: now,
    };

    const docRef = await addDoc(commentsRef, newComment);
    
    return {
      ...newComment,
      id: docRef.id,
    };
  } catch (error) {
    console.error('Error adding timestamped comment:', error);
    throw new Error('Failed to add comment');
  }
};

/**
 * Clear cache for a specific video
 */
export const clearVideoCommentsCache = (videoId: string): void => {
  commentCache.delete(videoId);
};

/**
 * Clear all comments cache
 */
export const clearAllCommentsCache = (): void => {
  commentCache.clear();
};

/**
 * Gets all timestamped comments for a specific video with optional caching
 */
export const getVideoTimestampedComments = async (
  videoId: string,
  useCache: boolean = true
): Promise<TimestampedComment[]> => {
  try {
    if (!videoId) {
      console.error('[commentService] No videoId provided');
      throw new Error('Video ID is required');
    }

    // Check cache first
    if (useCache && commentCache.has(videoId)) {
      const cached = commentCache.get(videoId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[commentService] Returning cached comments for videoId: "${videoId}"`);
        return cached.data;
      } else {
        commentCache.delete(videoId);
      }
    }

    console.log(`[commentService] Querying timestampedComments collection for videoId: "${videoId}"`);
    
    const commentsRef = collection(db, 'timestampedComments');
    const constraints: QueryConstraint[] = [
      where('videoId', '==', videoId),
      orderBy('createdAt', 'desc')
    ];
    
    const q = query(commentsRef, ...constraints);
    const querySnapshot = await getDocs(q);
    
    console.log(`[commentService] Query returned ${querySnapshot.size} documents`);
    
    if (querySnapshot.empty) {
      console.warn(`[commentService] No comments found for videoId: "${videoId}"`);
    }
    
    const comments = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
      } as TimestampedComment;
    });
    
    // Sort by timestamp in ascending order for display
    comments.sort((a, b) => a.timestamp - b.timestamp);
    
    // Cache the results
    if (useCache) {
      commentCache.set(videoId, { data: comments, timestamp: Date.now() });
    }
    
    console.log(`[commentService] Returning ${comments.length} sorted comments`);
    return comments;
  } catch (error) {
    console.error('[commentService] Error fetching timestamped comments:', error);
    throw new Error(`Failed to fetch comments: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Gets all timestamped comments for a specific user across all videos
 */
export const getUserTimestampedComments = async (
  userId: string
): Promise<TimestampedComment[]> => {
  try {
    const commentsRef = collection(db, 'timestampedComments');
    const q = query(commentsRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    const comments = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as TimestampedComment));
    
    return comments;
  } catch (error) {
    console.error('Error fetching user comments:', error);
    throw new Error('Failed to fetch user comments');
  }
};

/**
 * Gets all timestamped comments for a specific video grouped by user
 */
export const getVideoCommentsGroupedByUser = async (
  videoId: string
): Promise<Record<string, TimestampedComment[]>> => {
  try {
    const comments = await getVideoTimestampedComments(videoId, true);
    
    // Group comments by userId
    const grouped = comments.reduce((acc, comment) => {
      if (!acc[comment.userId]) {
        acc[comment.userId] = [];
      }
      acc[comment.userId].push(comment);
      return acc;
    }, {} as Record<string, TimestampedComment[]>);
    
    return grouped;
  } catch (error) {
    console.error('Error grouping video comments by user:', error);
    throw new Error('Failed to group comments');
  }
};

/**
 * Gets all timestamped comments for a specific video grouped by userName
 */
export const getVideoCommentsGroupedByUserName = async (
  videoId: string
): Promise<Record<string, TimestampedComment[]>> => {
  try {
    const comments = await getVideoTimestampedComments(videoId, true);
    
    // Group comments by userName
    const grouped = comments.reduce((acc, comment) => {
      const userName = comment.userName || 'Anonymous';
      if (!acc[userName]) {
        acc[userName] = [];
      }
      acc[userName].push(comment);
      return acc;
    }, {} as Record<string, TimestampedComment[]>);
    
    return grouped;
  } catch (error) {
    console.error('Error grouping video comments by userName:', error);
    throw new Error('Failed to group comments');
  }
};

/**
 * Gets the comment count for a specific video
 */
export const getVideoCommentCount = async (
  videoId: string
): Promise<number> => {
  try {
    const commentsRef = collection(db, 'timestampedComments');
    const q = query(commentsRef, where('videoId', '==', videoId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('Error fetching comment count:', error);
    throw new Error('Failed to fetch comment count');
  }
};
