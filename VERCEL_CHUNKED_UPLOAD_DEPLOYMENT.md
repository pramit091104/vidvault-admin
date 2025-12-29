# Vercel Chunked Upload Deployment Guide - FIXED

## What's Been Fixed

✅ **405 Method Not Allowed Error**: Fixed by creating individual API files for Vercel
✅ **GCS Initialization**: Proper credential parsing order implemented
✅ **API Routing**: Updated `vercel.json` with all chunked upload endpoints
✅ **Environment Variables**: Configured in `.env.vercel`
✅ **404 Not Found Error**: Fixed serverless function session sharing issue

## Critical Fix: Session Storage

**Problem**: Vercel serverless functions don't share memory, so sessions created in one function weren't available in others.

**Solution**: Implemented file-based session storage using `/tmp` directory:
- `api/lib/sessionStorage.js` - Handles session persistence
- Sessions stored as JSON files in `/tmp/upload-sessions/`
- Automatic session expiration and cleanup

## New API Endpoints Created

- `/api/gcs/init-chunked-upload` - Initialize upload session
- `/api/gcs/upload-chunk` - Upload individual chunks  
- `/api/gcs/upload-status/:sessionId` - Get upload progress/status
- `/api/gcs/verify-chunks/:sessionId` - Verify uploaded chunks for resumption
- `/api/lib/sessionStorage.js` - Session persistence layer

## Deployment Steps

1. **Set Environment Variables in Vercel Dashboard**:
   ```bash
   GCS_PROJECT_ID=veedo-401e0
   GCS_BUCKET_NAME=previu_videos
   GCS_CREDENTIALS={"type":"service_account",...} # Full JSON from .env.vercel
   RAZORPAY_KEY_ID=your_key_id
   RAZORPAY_KEY_SECRET=your_key_secret
   ```

2. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

## Limitations & Considerations

### Memory Storage
- Upload sessions are stored in memory (`global.uploadSessions`)
- Works for small-scale usage but has limitations:
  - Sessions don't persist between function instances
  - Memory is cleared on cold starts
  - Not suitable for high-traffic production

### Recommended Production Improvements

1. **Use Redis for Session Storage**:
   ```javascript
   // Replace global.uploadSessions with Redis
   import Redis from 'ioredis';
   const redis = new Redis(process.env.REDIS_URL);
   ```

2. **Add Session Persistence**:
   - Store session data in database
   - Use Vercel KV or external Redis
   - Implement proper session cleanup

3. **Error Handling**:
   - Add retry logic for failed chunks
   - Implement proper timeout handling
   - Add monitoring and logging

### File Size Limits

- **Vercel Function Payload**: 4.5MB per request
- **Chunk Size**: Recommended 5MB (adjust if needed)
- **Total File Size**: No hard limit, but consider timeout constraints

### Performance Optimization

- Consider using Vercel Edge Functions for better performance
- Implement proper caching strategies
- Add compression for metadata

## Testing After Deployment

1. **Test Upload Initialization**:
   ```bash
   curl -X POST https://your-domain.vercel.app/api/gcs/init-chunked-upload \
     -H "Content-Type: application/json" \
     -d '{"fileName":"test.mp4","totalSize":1000000,"chunkSize":5242880}'
   ```

2. **Monitor Function Logs**:
   - Check Vercel dashboard for function logs
   - Look for GCS initialization messages
   - Verify no timeout errors

## Troubleshooting

### Common Issues:

1. **Storage Unavailable (503)**:
   - Check GCS_CREDENTIALS in Vercel environment variables
   - Verify service account permissions
   - Check function logs for initialization errors

2. **Session Not Found (404)**:
   - Sessions might be lost due to cold starts
   - Consider implementing session persistence

3. **Timeout Errors**:
   - Reduce chunk size
   - Optimize file assembly process
   - Consider streaming uploads

### Debug Commands:

```bash
# Check environment variables
vercel env ls

# View function logs
vercel logs

# Test specific function
vercel dev
```

## Success Indicators

✅ No 405 Method Not Allowed errors
✅ Successful session initialization
✅ Chunk uploads complete without errors
✅ File assembly works correctly
✅ Signed URLs generated properly

Your chunked upload system should now work correctly on Vercel!