# Deployment Checklist - Chunked Upload Fix

## Changes Made to Fix 500 Error

### 1. Fixed Session Storage
- Simplified `api/lib/sessionStorage.js` to use in-memory storage
- Removed file system operations that don't work well in serverless

### 2. Added Better Error Handling
- Enhanced logging in `api/gcs/init-chunked-upload.js`
- Added detailed GCS initialization logging
- Better error messages with stack traces in development

### 3. Fixed UUID Generation
- Replaced `crypto.randomUUID()` with `uuid` package for compatibility
- Added proper import for `uuid` package

### 4. Added Test Endpoint
- Created `/api/test` endpoint to verify environment variables
- Helps debug configuration issues

## Deployment Steps

1. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

2. **Test the endpoints**:
   ```bash
   # Test basic functionality
   curl https://previu.online/api/test
   
   # Test chunked upload initialization
   curl -X POST https://previu.online/api/gcs/init-chunked-upload \
     -H "Content-Type: application/json" \
     -d '{"fileName":"test.mp4","totalSize":1000000,"chunkSize":5242880}'
   ```

3. **Check Vercel Function Logs**:
   - Go to Vercel Dashboard
   - Navigate to your project
   - Check "Functions" tab for logs
   - Look for console.log output from the functions

## Environment Variables to Verify in Vercel

Make sure these are set in your Vercel project settings:

```
GCS_PROJECT_ID=veedo-401e0
GCS_BUCKET_NAME=previu_videos
GCS_CREDENTIALS={"type":"service_account",...}
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
```

## Troubleshooting

### If you still get 500 errors:

1. **Check the test endpoint first**:
   ```
   https://previu.online/api/test
   ```
   This will show if environment variables are properly set.

2. **Check Vercel function logs**:
   - Look for console.log output
   - Check for GCS initialization messages
   - Look for any error stack traces

3. **Common issues**:
   - Environment variables not set in Vercel dashboard
   - GCS credentials malformed
   - Node.js version compatibility issues

### Expected Success Indicators:

✅ `/api/test` returns 200 with environment info
✅ GCS initialization logs show "✅ GCS initialized successfully"
✅ `/api/gcs/init-chunked-upload` returns sessionId
✅ No 500 errors in function logs

## Session Storage Limitation

**Note**: The current session storage uses in-memory storage, which means:
- Sessions only persist within the same serverless function instance
- For production with high traffic, consider upgrading to Redis or database
- For moderate usage, this should work fine

## Next Steps After Successful Deployment

1. Test file upload in your application
2. Monitor Vercel function logs for any issues
3. Consider implementing Redis for session storage if needed
4. Add monitoring and alerting for production use