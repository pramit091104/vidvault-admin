import { getSession } from '../lib/sessionStorage.js';

// Access global sessions
global.uploadSessions = global.uploadSessions || new Map();

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Get upload session from file storage
    const session = await getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    // Return list of uploaded chunk IDs
    res.status(200).json({
      sessionId: session.sessionId,
      uploadedChunks: session.uploadedChunks,
      totalChunks: session.totalChunks,
      uploadedCount: session.uploadedChunks.length,
      status: session.status || 'uploading'
    });

  } catch (error) {
    console.error('Error verifying chunks:', error);
    res.status(500).json({ error: error.message });
  }
}