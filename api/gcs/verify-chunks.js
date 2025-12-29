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

    // Get upload session
    const session = global.uploadSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    // Check if session is expired
    if (new Date() > session.expiresAt) {
      global.uploadSessions.delete(sessionId);
      return res.status(410).json({ error: 'Upload session expired' });
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