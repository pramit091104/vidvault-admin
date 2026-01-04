import { getUserIdFromToken } from './lib/subscriptionValidator.js';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin if not already initialized
let db;

function initializeFirebaseAdmin() {
  try {
    if (getApps().length === 0) {
      let credentials;
      
      if (process.env.GCS_CREDENTIALS) {
        credentials = JSON.parse(process.env.GCS_CREDENTIALS);
      } else if (process.env.GCS_CREDENTIALS_BASE64) {
        const decoded = Buffer.from(process.env.GCS_CREDENTIALS_BASE64, 'base64').toString('utf-8');
        credentials = JSON.parse(decoded);
      } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      }

      if (credentials) {
        initializeApp({
          credential: cert(credentials),
          projectId: process.env.GCS_PROJECT_ID || process.env.FIREBASE_PROJECT_ID
        });
      } else {
        throw new Error('Firebase credentials not found');
      }
    }
    
    if (!db) {
      db = getFirestore();
    }
    
    return db;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    throw error;
  }
}

// Initialize on module load
try {
  initializeFirebaseAdmin();
} catch (error) {
  console.warn('Firebase Admin initialization deferred due to:', error.message);
}

const PAYMENTS_COLLECTION = 'payments';

export default async function handler(req, res) {
  // Set CORS headers
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user ID from Authorization header
    const userId = await getUserIdFromToken(req.headers.authorization);
    if (!userId) {
      return res.status(401).json({ 
        error: 'Authentication required. Please sign in.',
        code: 'AUTH_REQUIRED'
      });
    }

    // Ensure Firebase Admin is initialized
    if (!db) {
      initializeFirebaseAdmin();
    }

    // Get user's payment statistics
    const paymentsRef = db.collection(PAYMENTS_COLLECTION);
    const userPaymentsQuery = paymentsRef.where('userId', '==', userId);
    const snapshot = await userPaymentsQuery.get();

    const payments = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      payments.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        completedAt: data.completedAt?.toDate?.() || data.completedAt
      });
    });

    // Calculate statistics
    const totalPayments = payments.length;
    const completedPayments = payments.filter(p => p.status === 'completed');
    const totalPaid = completedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const pendingPayments = payments.filter(p => p.status === 'pending').length;
    const failedPayments = payments.filter(p => p.status === 'failed').length;

    // Get recent payments (last 5)
    const recentPayments = payments
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(payment => ({
        id: payment.id,
        type: payment.type,
        amount: payment.amount,
        status: payment.status,
        createdAt: payment.createdAt,
        clientName: payment.clientName,
        notes: payment.notes
      }));

    // Calculate monthly spending (current month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyPayments = completedPayments.filter(p => 
      new Date(p.completedAt || p.createdAt) >= startOfMonth
    );
    const monthlySpending = monthlyPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const stats = {
      totalPayments,
      completedPayments: completedPayments.length,
      totalPaid,
      pendingPayments,
      failedPayments,
      monthlySpending,
      recentPayments,
      currency: 'INR'
    };

    res.status(200).json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Payment stats API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
}