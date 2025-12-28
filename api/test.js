// Simple test endpoint to verify Vercel deployment is working

export default async function handler(req, res) {
  console.log('🔍 Test Handler - Request received:', {
    method: req.method,
    origin: req.headers.origin,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  // Enable CORS
  const origin = req.headers.origin;
  const isVercelDomain = origin && origin.match(/^https:\/\/.*\.vercel\.app$/);
  const allowedOrigins = [
    'https://previu.online',
    'https://www.previu.online',
    'http://localhost:8080',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  
  if (allowedOrigins.includes(origin) || isVercelDomain) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Return test response
  res.status(200).json({
    success: true,
    message: 'API endpoint is working correctly',
    timestamp: new Date().toISOString(),
    method: req.method,
    origin: req.headers.origin,
    environment: process.env.NODE_ENV || 'unknown'
  });
}