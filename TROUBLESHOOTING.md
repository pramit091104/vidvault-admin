# Previu Troubleshooting Guide

This guide helps you diagnose and fix common issues with the Previu video platform.

## 🚨 Common Errors and Solutions

### 1. "ReferenceError: limit is not defined"

**Cause:** Missing Firebase Firestore import in client service.

**Solution:** ✅ **FIXED** - Added `limit` import to `src/integrations/firebase/clientService.ts`

### 2. "POST /api/signed-url 404 (Not Found)"

**Cause:** API endpoint not accessible or deployment configuration issue.

**Diagnosis:**
```bash
npm run debug:deployment
```

**Solutions:**
- **Local Development:** Ensure server is running on port 3001
- **Production:** Check Vercel deployment and environment variables
- **Vercel Functions:** Ensure `api/signed-url.js` is properly deployed

### 3. "Video not found in storage"

**Cause:** Mismatch between database filename and actual GCS file location.

**Diagnosis:**
```bash
npm run fix:common
```

**Solutions:**
- Check if video files exist in GCS bucket
- Verify filename format matches database records
- Common paths checked:
  - `videos/{filename}`
  - `uploads/{filename}`
  - `{filename}` (root)
  - With/without `.mp4` extension

### 4. "403 Forbidden" on Google Cloud Storage

**Cause:** CORS configuration or bucket permissions issue.

**Solutions:**

#### Fix CORS Configuration:
```bash
npm run fix:common
```

#### Manual CORS Fix:
```bash
gsutil cors set cors.json gs://your-bucket-name
```

#### Check Bucket Permissions:
- Ensure service account has `Storage Object Viewer` role
- Verify bucket is not set to "public access prevention"

### 5. "Error loading payment amount"

**Cause:** Client record not found or Firebase query issue.

**Solutions:**
- Verify client exists in Firestore `clients` collection
- Check client name matches exactly (case-sensitive)
- Ensure Firebase rules allow read access

## 🔧 Diagnostic Tools

### Environment Check
```bash
npm run check-env
```
Verifies all required environment variables are set.

### Deployment Diagnostics
```bash
npm run debug:deployment
```
Comprehensive check of:
- Environment variables
- GCS access and permissions
- API endpoint availability
- CORS configuration

### Quick Fix Common Issues
```bash
npm run fix:common
```
Automatically fixes:
- CORS configuration
- File path analysis
- Access permission testing

## 📋 Environment Variables Checklist

### Required for Backend:
- `GCS_PROJECT_ID` - Google Cloud project ID
- `GCS_BUCKET_NAME` - Storage bucket name
- `GCS_CREDENTIALS` - Service account JSON (as string)
- `RAZORPAY_KEY_ID` - Razorpay API key
- `RAZORPAY_KEY_SECRET` - Razorpay secret key

### Required for Frontend:
- `VITE_RAZORPAY_KEY_ID` - Razorpay public key
- `VITE_FIREBASE_API_KEY` - Firebase API key
- `VITE_FIREBASE_PROJECT_ID` - Firebase project ID
- `VITE_GCS_PROJECT_ID` - GCS project ID
- `VITE_GCS_BUCKET_NAME` - GCS bucket name

## 🔍 Debugging Steps

### 1. Check Browser Console
Look for specific error messages and stack traces.

### 2. Verify Network Requests
- Open Developer Tools → Network tab
- Check if API requests are reaching the server
- Look for 404, 403, or 500 status codes

### 3. Check Server Logs
- **Local:** Check terminal running `npm run server`
- **Vercel:** Check function logs in Vercel dashboard

### 4. Test GCS Access
```javascript
// Test in browser console
fetch('/api/signed-url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    videoId: 'your-video-id', 
    service: 'gcs' 
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

## 🚀 Deployment Checklist

### Vercel Deployment:
1. ✅ Environment variables set in Vercel dashboard
2. ✅ `vercel.json` includes all API routes
3. ✅ Build completes without errors
4. ✅ API functions deploy successfully

### GCS Configuration:
1. ✅ Bucket exists and accessible
2. ✅ Service account has proper permissions
3. ✅ CORS policy configured
4. ✅ Files uploaded to correct paths

### Firebase Setup:
1. ✅ Project configured and accessible
2. ✅ Firestore rules allow required access
3. ✅ Authentication configured
4. ✅ Collections exist with proper structure

## 📞 Getting Help

If issues persist after following this guide:

1. **Run diagnostics:** `npm run debug:deployment`
2. **Check logs:** Browser console + server logs
3. **Verify environment:** All required variables set
4. **Test manually:** Use diagnostic scripts

### Common File Paths to Check:
- Video files: `uploads/`, `videos/`, or root
- Database records: Check `fileName` field matches actual file
- Signed URLs: Should include `googleapis.com` domain

### Performance Tips:
- Videos > 50MB may need compression
- Use chunked upload for large files
- Monitor GCS bandwidth usage
- Cache signed URLs appropriately (1-hour expiry)

## 🔄 Recovery Procedures

### Reset Upload Session:
```javascript
// Clear stuck upload sessions
localStorage.clear();
// Or specifically:
Object.keys(localStorage)
  .filter(key => key.startsWith('upload_state_'))
  .forEach(key => localStorage.removeItem(key));
```

### Regenerate Signed URLs:
If videos stop playing, the signed URLs may have expired. The system should automatically regenerate them, but you can force refresh by reloading the page.

### Database Cleanup:
If you have orphaned records (database entries without corresponding files), use the diagnostic tools to identify and clean them up.