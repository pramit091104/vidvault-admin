import nodemailer from 'nodemailer';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (only once)
if (getApps().length === 0) {
  try {
    const credentials = process.env.GCS_CREDENTIALS ? JSON.parse(process.env.GCS_CREDENTIALS) : null;
    if (credentials) {
      initializeApp({
        credential: cert(credentials),
        projectId: process.env.GCS_PROJECT_ID
      });
    }
  } catch (error) {
    console.warn('Firebase Admin initialization skipped:', error.message);
  }
}

const db = getFirestore();

export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if user is authenticated (optional for anonymous comments)
    const authHeader = req.headers.authorization;
    let decodedToken = null;
    let isAuthenticated = false;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      try {
        decodedToken = await getAuth().verifyIdToken(idToken);
        isAuthenticated = true;
      } catch (authError) {
        console.warn('Auth verification failed (allowing anonymous):', authError.message);
        // Continue as anonymous user
      }
    }

    const { 
      videoId, 
      commentText, 
      commenterName, 
      commenterEmail,
      isAnonymous = false
    } = req.body;

    // Validation
    if (!videoId || !commentText) {
      return res.status(400).json({ 
        error: 'Missing required fields: videoId, commentText' 
      });
    }

    // Send email notifications for both authenticated and anonymous users

    // Get video details from Firestore
    const videoDoc = await db.collection('gcsClientCodes').doc(videoId).get();
    
    if (!videoDoc.exists) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const videoData = videoDoc.data();
    
    // Get video owner's email
    if (!videoData.userId) {
      return res.status(400).json({ error: 'Video owner not found' });
    }

    // Get owner's user data
    let ownerEmail = null;
    let ownerName = null;
    
    try {
      const ownerUser = await getAuth().getUser(videoData.userId);
      ownerEmail = ownerUser.email;
      ownerName = ownerUser.displayName;
    } catch (userError) {
      console.error('Error getting owner user data:', userError);
      return res.status(400).json({ error: 'Could not get video owner information' });
    }

    if (!ownerEmail) {
      return res.status(400).json({ error: 'Video owner email not found' });
    }

    // Don't send email if commenter is the video owner (only check for authenticated users)
    if (decodedToken && decodedToken.email === ownerEmail) {
      return res.status(200).json({ 
        success: true, 
        message: 'No email sent - commenter is video owner' 
      });
    }

    // Prepare email data (works for both authenticated and anonymous users)
    const emailData = {
      videoTitle: videoData.title,
      videoId: videoId,
      commenterName: commenterName || decodedToken?.name || 'Anonymous User',
      commenterEmail: commenterEmail || decodedToken?.email || null, // null for anonymous users
      commentText: commentText,
      commentTimestamp: new Date().toLocaleString(),
      videoUrl: `${req.headers.origin || 'https://previu.online'}/watch/${videoId}`,
      ownerEmail: ownerEmail,
      ownerName: ownerName || 'there',
      isAnonymousComment: !decodedToken && (!commenterEmail || commenterEmail === '')
    };

    // Send email notification using message queue
    const emailSent = await queueCommentNotification(emailData);

    if (emailSent) {
      res.status(200).json({ 
        success: true, 
        message: 'Comment notification queued successfully' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to queue email notification' 
      });
    }

  } catch (error) {
    console.error('Comment notification error:', error);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

async function queueCommentNotification(data) {
  try {
    // Import message queue dynamically
    const { queueEmail } = await import('../../middleware/messageQueue.js');
    
    const htmlTemplate = generateCommentEmailTemplate(data);
    const textTemplate = generatePlainTextEmail(data);
    
    const jobId = await queueEmail(
      data.ownerEmail,
      `New comment on your video: ${data.videoTitle}`,
      htmlTemplate,
      textTemplate,
      { priority: 1 } // High priority for notifications
    );
    
    console.log(`✅ Comment notification queued with job ID: ${jobId}`);
    return true;
  } catch (error) {
    console.error('Error queueing comment notification:', error);
    return false;
  }
}

async function sendCommentNotification(data) {
  try {
    // Check if Gmail credentials are configured
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.error('Gmail credentials not configured');
      console.error('GMAIL_USER:', process.env.GMAIL_USER ? 'Set' : 'Missing');
      console.error('GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? 'Set' : 'Missing');
      return false;
    }

    // Initialize Gmail transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
      // Add additional options for better reliability
      pool: true,
      maxConnections: 1,
      rateDelta: 20000,
      rateLimit: 5,
    });

    // Test connection first
    try {
      await transporter.verify();
      console.log('Gmail connection verified successfully');
    } catch (verifyError) {
      console.error('Gmail connection failed:', verifyError.message);
      return false;
    }

    const htmlTemplate = generateCommentEmailTemplate(data);

    const mailOptions = {
      from: `"Previu" <${process.env.GMAIL_USER}>`,
      to: data.ownerEmail,
      subject: `New comment on your video: ${data.videoTitle}`,
      html: htmlTemplate,
      text: generatePlainTextEmail(data),
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    
    // Close the transporter
    transporter.close();
    
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response
    });
    return false;
  }
}

function generateCommentEmailTemplate(data) {
  // Handle anonymous users properly
  const commenterInfo = data.isAnonymousComment 
    ? 'Anonymous viewer' 
    : (data.commenterName || data.commenterEmail || 'Unknown user');
    
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Comment Notification</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px 20px; border-radius: 0 0 8px 8px; }
        .comment-box { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 4px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
        .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .anonymous-badge { background: #f0f0f0; color: #666; padding: 2px 8px; border-radius: 12px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Previu</div>
          <h1>New Comment on Your Video</h1>
        </div>
        
        <div class="content">
          <p>Hello ${data.ownerName},</p>
          
          <p>Someone has left a comment on your video <strong>"${data.videoTitle}"</strong>.</p>
          
          <div class="comment-box">
            <h3>💬 Comment Details:</h3>
            <p><strong>Comment:</strong> "${data.commentText}"</p>
            <p><strong>From:</strong> ${commenterInfo}${data.isAnonymousComment ? ' <span class="anonymous-badge">Anonymous</span>' : ''}</p>
            <p><strong>Time:</strong> ${data.commentTimestamp}</p>
          </div>
          
          <p>You can view the full video and respond to comments by clicking the button below:</p>
          
          <a href="${data.videoUrl}" class="button">View Video & Comments</a>
          
          <p>Thank you for using Previu for your video sharing needs!</p>
        </div>
        
        <div class="footer">
          <p>This email was sent by Previu - Professional Video Sharing Platform</p>
          <p>If you no longer wish to receive these notifications, please contact support.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generatePlainTextEmail(data) {
  // Handle anonymous users properly
  const commenterInfo = data.isAnonymousComment 
    ? 'Anonymous viewer' 
    : (data.commenterName || data.commenterEmail || 'Unknown user');
    
  return `
New Comment on Your Video - Previu

Hello ${data.ownerName},

Someone has left a comment on your video "${data.videoTitle}".

Comment Details:
- Comment: "${data.commentText}"
- From: ${commenterInfo}${data.isAnonymousComment ? ' (Anonymous)' : ''}
- Time: ${data.commentTimestamp}

View your video and respond to comments: ${data.videoUrl}

Thank you for using Previu!

---
This email was sent by Previu - Professional Video Sharing Platform
  `.trim();
}