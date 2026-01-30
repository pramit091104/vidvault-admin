export default async function handler(req, res) {
  // CORS headers

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { videoId, violationType, timestamp, userAgent } = req.body;
    
    // Log the violation (in production, save to database)
    console.warn('🚨 Content Protection Violation:', {
      videoId,
      violationType,
      timestamp,
      userAgent,
      ip: req.ip || req.connection.remoteAddress,
      referrer: req.headers.referer
    });

    // TODO: Save to database for monitoring and analytics
    // await saveViolationToDatabase({ videoId, violationType, timestamp, userAgent, ip, referrer });

    res.json({ success: true, message: 'Violation logged' });

  } catch (error) {
    console.error('Log violation error:', error);
    res.status(500).json({ error: 'Failed to log violation' });
  }
}