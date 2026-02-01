# 🚀 Deploy GCS Upload Fix to Render.com

## ✅ What Was Fixed

The "Invalid JWT Signature" error has been fixed in these files:
- `video-server/api/gcs/upload.js` ⭐ **Main upload endpoint**
- `video-server/api/storage.js`
- `video-server/api/gcs/metadata.js`
- `video-server/api/gcs/configure-lifecycle.js`

## 📋 Deployment Steps

### Step 1: Commit the Changes

```bash
# Add the fixed files
git add video-server/api/gcs/upload.js
git add video-server/api/storage.js
git add video-server/api/gcs/metadata.js
git add video-server/api/gcs/configure-lifecycle.js
git add GCS_UPLOAD_FIX.md

# Commit with a clear message
git commit -m "Fix: Invalid JWT Signature error in GCS upload endpoints

- Fixed private key newline handling in all GCS API files
- Added support for GCS_CREDENTIALS_BASE64 environment variable
- Ensures proper JWT signature validation for file uploads"

# Push to GitHub (Render will auto-deploy)
git push origin main
```

### Step 2: Monitor Render Deployment

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Find your service**: `vidvault-admin` (or your backend service name)
3. **Watch the deployment**:
   - You should see a new deployment start automatically after the push
   - Wait for it to show "Live" status (usually takes 2-5 minutes)
4. **Check the logs** for these success messages:
   ```
   ✅ GCS initialized for upload API
   ✅ GCS initialized for storage API
   ✅ GCS initialized for metadata API
   ✅ GCS initialized for lifecycle configuration
   ```

### Step 3: Verify Environment Variables on Render

**IMPORTANT**: Make sure these environment variables are set in your Render service:

1. Go to your service → **Environment** tab
2. Verify these variables exist:
   - `GCS_CREDENTIALS_BASE64` - Your base64-encoded service account JSON
   - `GCS_PROJECT_ID` - Your GCS project ID (e.g., `veedo-480512`)
   - `GCS_BUCKET_NAME` - Your bucket name

> **Note**: Based on your `.env.local`, you're using `GCS_CREDENTIALS_BASE64`, which is correct!

### Step 4: Test the Upload

After deployment completes:

1. **Open your deployed frontend** (likely on Vercel)
2. **Try uploading a video file**
3. **Check the browser console** - You should NO LONGER see:
   - ❌ `invalid_grant: Invalid JWT Signature`
   - ❌ `500 Internal Server Error`
4. **Upload should succeed** ✅

## 🔍 Troubleshooting

### If deployment fails:

1. **Check Render build logs** for errors
2. **Verify git push was successful**: `git log --oneline -1`
3. **Manually trigger deploy** from Render dashboard if auto-deploy didn't work

### If upload still fails after deployment:

1. **Check Render logs** for runtime errors:
   - Go to Render dashboard → Your service → Logs
   - Look for "❌ Failed to initialize GCS" errors
   
2. **Verify environment variables**:
   - Make sure `GCS_CREDENTIALS_BASE64` is set correctly
   - The value should be a long base64 string (starts with `eyJ...`)

3. **Test credential decoding**:
   ```javascript
   // In Render shell or logs, you should see valid JSON when decoded
   const decoded = Buffer.from(process.env.GCS_CREDENTIALS_BASE64, 'base64').toString('utf-8');
   console.log(JSON.parse(decoded).client_email); // Should show your service account email
   ```

### If you see "Storage unavailable" error:

This means GCS initialization failed. Check:
- Environment variables are set correctly on Render
- The base64 string is not truncated or corrupted
- The service account has proper permissions

## 📊 Expected Timeline

- **Git push**: Instant
- **Render detects push**: ~10-30 seconds
- **Build time**: ~1-3 minutes
- **Deploy time**: ~30 seconds
- **Total**: ~2-5 minutes from push to live

## ✅ Success Checklist

- [ ] Code changes committed to git
- [ ] Changes pushed to GitHub (`git push origin main`)
- [ ] Render deployment started automatically
- [ ] Render deployment shows "Live" status
- [ ] Render logs show "✅ GCS initialized" messages
- [ ] Test upload succeeds without JWT errors
- [ ] No more 500 errors in browser console

## 🎯 Quick Commands

```bash
# Check what branch you're on
git branch --show-current

# Check what will be committed
git status

# Commit and push (all in one)
git add video-server/api/gcs/*.js video-server/api/storage.js GCS_UPLOAD_FIX.md
git commit -m "Fix: Invalid JWT Signature error in GCS upload endpoints"
git push origin main

# Check if push was successful
git log --oneline -1
```

## 📞 Need Help?

If uploads still fail after deployment:
1. Share the Render deployment logs
2. Share the browser console errors
3. Verify the exact error message from the network tab
