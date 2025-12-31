// Test endpoint for session storage
import { saveSession, getSession, updateSession, deleteSession, getSessionStats } from './lib/sessionStorage.js';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', ['POST', 'GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (req.method === 'GET') {
      // Return session statistics
      const stats = getSessionStats();
      return res.status(200).json({ 
        success: true, 
        stats,
        message: 'Session storage statistics'
      });
    }

    const { action, sessionId, data } = req.body;

    switch (action) {
      case 'save':
        const saved = await saveSession(sessionId, data);
        return res.status(200).json({ success: saved, action: 'save' });

      case 'get':
        const session = await getSession(sessionId);
        return res.status(200).json({ success: !!session, session, action: 'get' });

      case 'update':
        const updated = await updateSession(sessionId, data);
        return res.status(200).json({ success: updated, action: 'update' });

      case 'delete':
        const deleted = await deleteSession(sessionId);
        return res.status(200).json({ success: deleted, action: 'delete' });

      case 'stats':
        const sessionStats = getSessionStats();
        return res.status(200).json({ success: true, stats: sessionStats, action: 'stats' });

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Test session error:', error);
    res.status(500).json({ error: error.message });
  }
}