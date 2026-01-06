# Email Notification Deployment Fix

## Issue
Email sending feature works locally but fails when deployed to Vercel.

## Root Causes Identified & Fixed

### 1. Missing Vercel Configuration ✅ FIXED
**Problem**: The email notification API endpoint (`api/notifications/comment.js`) was not configured in `vercel.json`.

**Solution**: Added the missing configuration with timeout:
```json
{
  "builds": [
    {
      "src": "api/notifications/comment.js",
      "use": "@vercel/node",
      "config": {
        "maxDuration": 30
      }
    }
  ],
  "routes": [
    {
      "src": "/api/notifications/comment",
      "dest": "/api/notifications/comment.js"
    }
  ]
}
```

### 2. Enhanced Email Transport Configuration ✅ FIXED
**Problem**: Basic nodemailer configuration might not be reliable in serverless environment.

**Solution**: Enhanced transporter with connection pooling and rate limiting:
```javascript
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  // Enhanced reliability options
  pool: true,
  maxConnections: 1,
  rateDelta: 20000,
  rateLimit: 5,
});
```

## Environment Variables Required

Make sure these are set in your Vercel project settings:

### Required Email Variables:
- `GMAIL_USER` - Your Gmail address (e.g., previu.online@gmail.com)
- `GMAIL_APP_PASSWORD` - Gmail App Password (NOT your regular password)

### How to Get Gmail App Password:
1. Go to Google Account settings
2. Enable 2-Factor Authentication
3. Go to Security → App passwords
4. Generate a new app password for "Mail"
5. Use this 16-character password as `GMAIL_APP_PASSWORD`

## Deployment Steps

### 1. Update Vercel Environment Variables
```bash
# In Vercel Dashboard or CLI
vercel env add GMAIL_USER
vercel env add GMAIL_APP_PASSWORD
```

### 2. Deploy the Updated Configuration
```bash
# Deploy with the updated vercel.json
vercel --prod
```

### 3. Test the Email Function
```bash
# Test the API endpoint directly
curl -X POST https://your-domain.vercel.app/api/notifications/comment \
  -H "Content-Type: application/json" \
  -d '{
    "videoId": "test-video-id",
    "commentText": "Test comment",
    "commenterName": "Test User"
  }'
```

## Files Modified

1. `vercel.json` - Added API configuration with 30-second timeout
2. `api/notifications/comment.js` - Enhanced transporter configuration
3. `EMAIL_DEPLOYMENT_FIX.md` - This documentation

## Verification Checklist

- [x] `vercel.json` includes email API configuration with timeout
- [ ] Environment variables set in Vercel dashboard
- [ ] Gmail App Password generated and configured
- [ ] Test email sent successfully in production

The email feature should now work correctly in production!