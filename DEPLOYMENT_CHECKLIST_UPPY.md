# Uppy Resumable Upload - Deployment Checklist

## 📋 Pre-Deployment Checklist

### 1. Environment Setup ✅

- [x] Install dependencies: `npm install`
- [x] Verify `.env` file has all required variables
- [x] Test GCS credentials
- [x] Test Firebase Admin SDK credentials
- [x] Run lifecycle setup: `npm run setup:gcs-lifecycle`

### 2. Local Testing ✅

- [ ] Start development server: `npm run dev:all`
- [ ] Test file selection and validation
- [ ] Test upload with small file (<50MB)
- [ ] Test upload with large file (>100MB)
- [ ] Test pause/resume functionality
- [ ] Test cancel functionality
- [ ] Test network interruption recovery
- [ ] Verify metadata saved in Firestore
- [ ] Verify file in GCS bucket
- [ ] Test signed URL generation

### 3. Code Review ✅

- [x] Backend APIs implemented
- [x] Frontend components implemented
- [x] Error handling in place
- [x] Security validations added
- [x] Documentation complete

## 🚀 Deployment Steps

### Step 1: Vercel Configuration

#### Environment Variables

Add these to Vercel dashboard (Settings → Environment Variables):

```env
# GCS Configuration
GCS_PROJECT_ID=veedo-401e0
GCS_BUCKET_NAME=previu_videos
GCS_CREDENTIALS={"type":"service_account",...}

# Firebase Configuration (if not already set)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

**Checklist:**
- [ ] All environment variables added
- [ ] Variables set for Production environment
- [ ] Variables set for Preview environment (optional)
- [ ] Sensitive data properly escaped (especially private_key)

### Step 2: GCS Bucket Configuration

#### CORS Configuration

Ensure your GCS bucket has CORS configured:

```json
[
  {
    "origin": ["https://previu.online", "https://*.vercel.app"],
    "method": ["GET", "HEAD", "PUT", "POST", "OPTIONS"],
    "responseHeader": ["Content-Type", "Content-Length", "Accept-Ranges", "Range"],
    "maxAgeSeconds": 3600
  }
]
```

**Checklist:**
- [ ] CORS policy configured
- [ ] Production domain added to origins
- [ ] Preview domains added (if needed)
- [ ] Test CORS with browser

#### Lifecycle Rules

Run the setup script or verify manually:

```bash
npm run setup:gcs-lifecycle
```

**Checklist:**
- [ ] Lifecycle rules configured
- [ ] Drafts auto-delete after 30 days
- [ ] Temp files auto-delete after 1 day
- [ ] Verified in GCS console

### Step 3: Firebase Configuration

#### Firestore Security Rules

Ensure Firestore has proper security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /gcsClientCodes/{videoId} {
      // Allow read if user owns the video or has security code
      allow read: if request.auth != null && 
        (resource.data.userId == request.auth.uid || 
         request.resource.data.securityCode == request.query.code);
      
      // Allow write only if user is authenticated
      allow create: if request.auth != null && 
        request.resource.data.userId == request.auth.uid;
      
      // Allow update only if user owns the video
      allow update: if request.auth != null && 
        resource.data.userId == request.auth.uid;
      
      // Allow delete only if user owns the video
      allow delete: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
  }
}
```

**Checklist:**
- [ ] Security rules configured
- [ ] Test read access
- [ ] Test write access
- [ ] Test unauthorized access (should fail)

#### Firebase Admin SDK

Verify Firebase Admin SDK is properly initialized:

**Checklist:**
- [ ] Service account credentials in environment
- [ ] Admin SDK initialized in API routes
- [ ] Token verification working
- [ ] Test with valid token
- [ ] Test with invalid token (should fail)

### Step 4: Deploy to Vercel

#### Deploy to Staging (Optional)

```bash
vercel
```

**Checklist:**
- [ ] Deployment successful
- [ ] API routes accessible
- [ ] Test upload on staging
- [ ] Check logs for errors
- [ ] Verify Firestore writes
- [ ] Verify GCS uploads

#### Deploy to Production

```bash
vercel --prod
```

**Checklist:**
- [ ] Production deployment successful
- [ ] API routes accessible
- [ ] Custom domain working (if configured)
- [ ] SSL certificate valid
- [ ] Test upload on production
- [ ] Monitor logs for errors

### Step 5: Post-Deployment Testing

#### Functional Testing

- [ ] **File Selection**
  - [ ] Select video file
  - [ ] Validate file type
  - [ ] Validate file size
  - [ ] Show file info

- [ ] **Upload Process**
  - [ ] Start upload
  - [ ] Progress updates
  - [ ] Speed calculation
  - [ ] ETA display
  - [ ] Chunk progress

- [ ] **Upload Controls**
  - [ ] Pause upload
  - [ ] Resume upload
  - [ ] Cancel upload
  - [ ] Prevent page unload

- [ ] **Upload Completion**
  - [ ] Success message
  - [ ] Metadata saved
  - [ ] File in GCS
  - [ ] Signed URL generated
  - [ ] Video playable

#### Error Testing

- [ ] **Invalid File Type**
  - [ ] Upload non-video file
  - [ ] Verify error message

- [ ] **File Too Large**
  - [ ] Upload file >2GB
  - [ ] Verify error message

- [ ] **Network Interruption**
  - [ ] Start upload
  - [ ] Disconnect network
  - [ ] Reconnect network
  - [ ] Verify auto-resume

- [ ] **Authentication**
  - [ ] Upload without auth
  - [ ] Verify error message

#### Performance Testing

- [ ] **Small File (<50MB)**
  - [ ] Upload time acceptable
  - [ ] No errors
  - [ ] Smooth progress

- [ ] **Medium File (100-500MB)**
  - [ ] Upload time acceptable
  - [ ] Chunking works
  - [ ] No timeouts

- [ ] **Large File (>500MB)**
  - [ ] Upload completes
  - [ ] No Vercel timeouts
  - [ ] Pause/resume works

### Step 6: Monitoring Setup

#### Vercel Logs

- [ ] Access Vercel dashboard
- [ ] Check function logs
- [ ] Monitor error rates
- [ ] Set up alerts (optional)

#### GCS Monitoring

- [ ] Check bucket storage usage
- [ ] Monitor upload activity
- [ ] Verify lifecycle rules active
- [ ] Check access logs

#### Firestore Monitoring

- [ ] Check document writes
- [ ] Monitor read/write counts
- [ ] Verify data integrity
- [ ] Check security rule violations

### Step 7: Documentation

- [ ] Update README with deployment info
- [ ] Document any custom configurations
- [ ] Share access credentials with team
- [ ] Create runbook for common issues

## 🔍 Verification Checklist

### API Endpoints

Test each endpoint:

```bash
# Test resumable upload URL generation
curl -X POST https://your-domain.com/api/gcs/resumable-upload-url \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.mp4","fileSize":1000000,"contentType":"video/mp4"}'

# Expected: 200 OK with uploadUrl and gcsPath
```

**Checklist:**
- [ ] `/api/gcs/resumable-upload-url` returns 200
- [ ] `/api/gcs/finalize-upload` returns 200
- [ ] `/api/gcs/configure-lifecycle` returns 200
- [ ] All endpoints require auth (except lifecycle)
- [ ] Error responses are proper

### Frontend Components

- [ ] `UppyUploadSection` renders correctly
- [ ] File input works
- [ ] Metadata inputs work
- [ ] Upload button enabled when ready
- [ ] Progress display updates
- [ ] Controls work (pause/resume/cancel)
- [ ] Success state displays
- [ ] Error states display

### Database

- [ ] Firestore collection exists: `gcsClientCodes`
- [ ] Documents have correct schema
- [ ] Timestamps are correct
- [ ] User IDs are correct
- [ ] Security codes generated
- [ ] GCS paths are correct

### Storage

- [ ] GCS bucket accessible
- [ ] Files uploaded to correct paths
- [ ] Drafts folder exists
- [ ] Videos folder exists
- [ ] Lifecycle rules active
- [ ] CORS configured

## 🚨 Rollback Plan

If issues occur after deployment:

### Immediate Actions

1. **Revert Vercel Deployment**
   ```bash
   vercel rollback
   ```

2. **Disable New Upload Component**
   - Comment out `UppyUploadSection` import
   - Use old upload component
   - Redeploy

3. **Check Logs**
   - Vercel function logs
   - Browser console
   - GCS access logs
   - Firestore logs

### Common Issues & Fixes

**Issue: Uploads fail immediately**
- Check Firebase Auth token
- Verify GCS credentials
- Check CORS configuration

**Issue: Uploads timeout**
- Verify direct upload to GCS
- Check signed URL generation
- Monitor Vercel function duration

**Issue: Metadata not saved**
- Check Firestore permissions
- Verify Firebase Admin SDK
- Check API logs

## ✅ Final Checklist

Before marking deployment as complete:

- [ ] All tests pass
- [ ] No critical errors in logs
- [ ] Performance meets expectations
- [ ] Security validations working
- [ ] Documentation updated
- [ ] Team notified
- [ ] Monitoring active
- [ ] Rollback plan ready

## 🎉 Deployment Complete!

Once all items are checked:

1. Mark deployment as successful
2. Monitor for 24 hours
3. Collect user feedback
4. Plan optimizations

---

**Deployment Date**: _____________  
**Deployed By**: _____________  
**Status**: ⬜ In Progress | ⬜ Complete | ⬜ Rolled Back  
**Notes**: _____________
