# Fix CORS Issue - Deployment Guide

## What Was the Problem?

Your GCS bucket has "public access prevention" enabled, which means:
- Direct signed URLs from GCS don't include CORS headers
- Browsers block video playback due to CORS policy
- The bucket cannot be made publicly readable

## The Solution

We've implemented a **video streaming proxy** that:
1. Streams videos from GCS through your backend server
2. Adds proper CORS headers to all responses
3. Supports range requests for video seeking
4. Works with your existing security setup

## Changes Made

### 1. New Streaming Endpoint
- **File**: `video-server/server.js`
- **Endpoint**: `GET /api/stream-video?path=<gcs-path>`
- **Features**:
  - Proxies video from GCS with CORS headers
  - Supports HTTP range requests (for video seeking)
  - Handles errors gracefully

### 2. Updated Signed URL Service
- **File**: `video-server/api/signed-url.js`
- **Change**: Now returns proxy URLs instead of direct GCS signed URLs
- **Format**: `https://your-backend.com/api/stream-video?path=drafts/...`

### 3. Environment Variable
- **Variable**: `BACKEND_URL`
- **Purpose**: Tells the signed-url service where your backend is deployed
- **Local**: `http://localhost:3001`
- **Production**: Your Render URL

## Deployment Steps

### Step 1: Update Render Environment Variables

1. Go to https://dashboard.render.com/
2. Select your video-server service
3. Click "Environment" in the left sidebar
4. Add a new environment variable:
   - **Key**: `BACKEND_URL`
   - **Value**: Your Render service URL (e.g., `https://your-app.onrender.com`)
   - Click "Save Changes"

### Step 2: Deploy to Render

Option A: **Automatic Deploy** (if connected to Git)
- Commit and push your changes
- Render will automatically deploy

Option B: **Manual Deploy**
- In Render dashboard, click "Manual Deploy"
- Select "Deploy latest commit"
- Wait for deployment to complete (2-5 minutes)

### Step 3: Verify Deployment

1. **Check Logs**
   - Go to "Logs" tab in Render
   - Look for: "GCS initialized successfully"
   - Look for: "Debug Server running on..."

2. **Test the Streaming Endpoint**
   ```bash
   curl -I "https://your-app.onrender.com/api/stream-video?path=drafts/test-video.mp4"
   ```
   - Should return 200 or 206 status
   - Should include CORS headers

### Step 4: Test Your Frontend

1. **Clear Browser Cache**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or use incognito mode

2. **Load a Video**
   - Navigate to a video watch page
   - Open browser console (F12)
   - Video should load and play without CORS errors

3. **Check Network Tab**
   - Look for requests to `/api/stream-video`
   - Should see 206 responses (partial content)
   - No CORS errors

## How It Works

### Before (Direct GCS URLs)
```
Browser → GCS Storage (blocked by CORS)
```

### After (Proxy Through Backend)
```
Browser → Your Backend → GCS Storage
         (adds CORS headers)
```

### URL Format Change

**Old (Direct GCS)**:
```
https://storage.googleapis.com/previu_videos/drafts/...?X-Goog-Algorithm=...
```

**New (Proxied)**:
```
https://your-backend.onrender.com/api/stream-video?path=drafts/...
```

## Benefits

1. **CORS Compliant**: All responses include proper CORS headers
2. **Secure**: Bucket remains private, access controlled by your backend
3. **Range Support**: Video seeking works properly
4. **No GCS Changes**: No need to modify bucket permissions

## Troubleshooting

### Videos Still Not Playing

1. **Check BACKEND_URL**
   - Make sure it's set correctly in Render
   - Should match your actual Render service URL
   - No trailing slash

2. **Check CORS Configuration**
   - Verify `ALLOWED_ORIGINS` includes your Vercel domain
   - Check server.js CORS middleware

3. **Check Logs**
   - Look for "Streaming video from:" messages
   - Check for any GCS errors

### Performance Concerns

The proxy adds minimal latency because:
- Streams data directly (no buffering)
- Uses Node.js streams (efficient)
- Supports range requests (only fetches needed bytes)

### Alternative: Make Bucket Public

If you want to avoid the proxy (not recommended):
1. Disable "public access prevention" in GCS console
2. Make bucket publicly readable
3. Revert to direct signed URLs

But this is **less secure** and not recommended.

## Files Modified

1. `video-server/server.js` - Added streaming endpoint
2. `video-server/api/signed-url.js` - Returns proxy URLs
3. `video-server/.env` - Added BACKEND_URL variable

## Next Steps

1. Deploy to Render with BACKEND_URL set
2. Test video playback on your live site
3. Monitor logs for any issues
4. Consider adding authentication to the streaming endpoint (optional)

## Questions?

If you encounter issues:
1. Check Render deployment logs
2. Check browser console for errors
3. Verify BACKEND_URL is set correctly
4. Test the streaming endpoint directly with curl
