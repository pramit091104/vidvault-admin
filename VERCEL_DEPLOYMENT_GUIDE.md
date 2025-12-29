# Vercel Deployment Guide

This guide explains how to deploy your video platform to Vercel with proper serverless function support.

## Prerequisites

1. Vercel CLI installed: `npm i -g vercel`
2. Vercel account connected to your GitHub repository

## Environment Variables Setup

You need to configure the following environment variables in your Vercel dashboard:

### Frontend Variables (VITE_*)
```
VITE_FIREBASE_API_KEY=AIzaSyAycvL6OUa2gIHHABBdDr6eknJGxeddeqk
VITE_FIREBASE_AUTH_DOMAIN=previu.online
VITE_FIREBASE_PROJECT_ID=veedo-401e0
VITE_FIREBASE_STORAGE_BUCKET=veedo-401e0.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=403109439314
VITE_FIREBASE_APP_ID=1:403109439314:web:9fe6a35d401573cb453c8b
VITE_YOUTUBE_CLIENT_ID=644814913298-kb585bnqb79ovi5nsbfcfkeqn9590hu9.apps.googleusercontent.com
VITE_YOUTUBE_API_KEY=AIzaSyAoG51W0aMVKIPbX5BFfH0xT-vMpkyPT08
VITE_GCS_PROJECT_ID=veedo-480512
VITE_GCS_BUCKET_NAME=previu_videos
VITE_RAZORPAY_KEY_ID=rzp_test_Rx5tnJCOUHefCi
```

### Backend Variables (for serverless functions)
```
RAZORPAY_KEY_ID=rzp_test_Rx5tnJCOUHefCi
RAZORPAY_KEY_SECRET=gJfWtk2zshP9dKcZQocNPg6T
GCS_PROJECT_ID=veedo-480512
GCS_BUCKET_NAME=previu_videos
GCS_CREDENTIALS={"type":"service_account","project_id":"veedo-480512",...}
```

## Serverless Functions

The following serverless functions have been created in the `/api` directory:

### GCS Functions
- `/api/gcs/upload.js` - Handle video uploads to Google Cloud Storage
- `/api/gcs/delete.js` - Handle video deletions from GCS
- `/api/gcs/metadata.js` - Get file metadata from GCS

### Razorpay Functions
- `/api/razorpay/create-order.js` - Create payment orders
- `/api/razorpay/verify-payment.js` - Verify payment completion

### Signed URL Function
- `/api/signed-url.js` - Generate signed URLs for private video access

## Deployment Steps

1. **Set Environment Variables**
   ```bash
   # Set each environment variable in Vercel dashboard or via CLI
   vercel env add GCS_PROJECT_ID
   vercel env add GCS_BUCKET_NAME
   vercel env add GCS_CREDENTIALS
   # ... repeat for all variables
   ```

2. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

3. **Verify Deployment**
   - Check that all serverless functions are deployed
   - Test API endpoints: `/api/gcs/metadata`, `/api/signed-url`
   - Verify environment variables are loaded correctly

## Troubleshooting

### Common Issues

1. **405 Method Not Allowed**
   - Ensure serverless functions export default handler
   - Check that HTTP methods are properly handled

2. **Storage Unavailable**
   - Verify GCS_CREDENTIALS environment variable is properly formatted
   - Check GCS_PROJECT_ID and GCS_BUCKET_NAME are correct

3. **CORS Issues**
   - Ensure GCS bucket CORS is configured for your domain
   - Check that serverless functions include proper CORS headers

### Testing Serverless Functions

You can test the functions locally:

```bash
# Install Vercel CLI
npm i -g vercel

# Run development server
vercel dev

# Test endpoints
curl -X POST http://localhost:3000/api/signed-url \
  -H "Content-Type: application/json" \
  -d '{"videoId":"test","service":"gcs"}'
```

## Production Checklist

- [ ] All environment variables configured in Vercel
- [ ] GCS bucket CORS configured for production domain
- [ ] Serverless functions deployed and accessible
- [ ] Video upload/delete functionality working
- [ ] Payment integration working
- [ ] Signed URL generation working

## Notes

- The frontend automatically detects the environment and uses relative URLs in production
- Serverless functions handle all backend operations
- No separate server deployment needed