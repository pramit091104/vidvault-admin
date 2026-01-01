# Uppy Resumable Upload Testing Guide

## 🧪 Testing Checklist

### Pre-Testing Setup

1. **Environment Configuration**
   ```bash
   # Verify all environment variables are set
   npm run check-env
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure GCS Lifecycle**
   ```bash
   npm run setup:gcs-lifecycle
   ```

4. **Start Development Server**
   ```bash
   npm run dev:all
   ```

## 📋 Test Scenarios

### 1. Basic Upload Test (Small File)

**Objective**: Verify basic upload functionality

**Steps**:
1. Navigate to upload section
2. Select a small video file (<50MB)
3. Fill in metadata (title, description, client name)
4. Click "Start Upload"
5. Wait for completion

**Expected Results**:
- ✅ Upload progress shows 0-100%
- ✅ Upload speed is displayed
- ✅ ETA is calculated
- ✅ Success message appears
- ✅ Video appears in dashboard
- ✅ Metadata saved in Firestore
- ✅ File exists in GCS bucket

### 2. Large File Upload Test (100MB+)

**Objective**: Test chunked upload with large files

**Steps**:
1. Select a video file >100MB
2. Fill in metadata
3. Start upload
4. Monitor chunk progress

**Expected Results**:
- ✅ Upload starts successfully
- ✅ Chunks are uploaded sequentially
- ✅ Progress updates smoothly
- ✅ Upload completes without timeout
- ✅ File moved from drafts/ to videos/

### 3. Pause/Resume Test

**Objective**: Verify pause and resume functionality

**Steps**:
1. Start uploading a large file (>200MB)
2. Wait until 30% progress
3. Click "Pause" button
4. Wait 10 seconds
5. Click "Resume" button
6. Wait for completion

**Expected Results**:
- ✅ Upload pauses immediately
- ✅ Progress stops updating
- ✅ Resume continues from same point
- ✅ No data loss
- ✅ Upload completes successfully

### 4. Network Interruption Test

**Objective**: Test automatic retry on network failure

**Steps**:
1. Start uploading a large file
2. Wait until 40% progress
3. Disable network (airplane mode or disconnect WiFi)
4. Wait 5 seconds
5. Re-enable network

**Expected Results**:
- ✅ Upload shows error state
- ✅ Automatic retry after network recovery
- ✅ Upload resumes from last successful chunk
- ✅ Upload completes successfully

### 5. Cancel Upload Test

**Objective**: Verify cancel functionality

**Steps**:
1. Start uploading a file
2. Wait until 20% progress
3. Click "Cancel" button

**Expected Results**:
- ✅ Upload stops immediately
- ✅ Error message displayed
- ✅ Form resets
- ✅ Can start new upload

### 6. File Validation Test

**Objective**: Test file type and size validation

**Test Cases**:

**Invalid File Type**:
1. Try to upload a PDF file
2. Expected: Error message "Invalid file type"

**File Too Large**:
1. Try to upload a file >2GB
2. Expected: Error message "File size exceeds 2GB limit"

**Valid File**:
1. Upload a valid video file
2. Expected: Upload starts successfully

### 7. Authentication Test

**Objective**: Verify authentication requirements

**Steps**:
1. Sign out of the application
2. Try to access upload page
3. Try to upload a file

**Expected Results**:
- ✅ Redirected to login page
- ✅ Upload button disabled
- ✅ Error message about authentication

### 8. Concurrent Upload Test

**Objective**: Test multiple uploads (one at a time)

**Steps**:
1. Upload first video
2. Wait for completion
3. Immediately upload second video
4. Verify both videos in dashboard

**Expected Results**:
- ✅ First upload completes
- ✅ Second upload starts fresh
- ✅ Both videos saved correctly
- ✅ No data mixing

### 9. Metadata Persistence Test

**Objective**: Verify metadata is saved correctly

**Steps**:
1. Upload a video with specific metadata:
   - Title: "Test Video 123"
   - Description: "Test description"
   - Client: "Test Client"
2. Check Firestore database
3. Check video in dashboard

**Expected Results**:
- ✅ All metadata fields saved
- ✅ Correct user ID associated
- ✅ Timestamp recorded
- ✅ Security code generated
- ✅ GCS path correct

### 10. Signed URL Test

**Objective**: Verify signed URL generation and expiry

**Steps**:
1. Upload a video
2. Get the signed URL from Firestore
3. Try to access the URL in browser
4. Wait 7 days (or modify expiry for testing)
5. Try to access again

**Expected Results**:
- ✅ URL accessible immediately
- ✅ Video plays correctly
- ✅ URL expires after 7 days
- ✅ New signed URL can be generated

## 🔍 Debugging Tools

### 1. Browser Console
Monitor for errors and logs:
```javascript
// Check upload progress
console.log('Upload progress:', uploadProgress);

// Check upload speed
console.log('Upload speed:', uploadSpeed);

// Check chunk progress
console.log('Chunks:', currentChunk, '/', totalChunks);
```

### 2. Network Tab
Monitor API calls:
- `/api/gcs/resumable-upload-url` - Should return 200
- GCS upload URL - Should show PUT requests
- `/api/gcs/finalize-upload` - Should return 200

### 3. Firestore Console
Verify data:
- Collection: `gcsClientCodes`
- Check document fields
- Verify timestamps

### 4. GCS Console
Check files:
- Navigate to bucket
- Check `drafts/` folder during upload
- Check `videos/` folder after completion
- Verify file sizes

## 📊 Performance Benchmarks

### Expected Upload Speeds

| File Size | Expected Time (10 Mbps) | Expected Time (50 Mbps) |
|-----------|-------------------------|-------------------------|
| 50 MB     | ~40 seconds             | ~8 seconds              |
| 100 MB    | ~80 seconds             | ~16 seconds             |
| 500 MB    | ~7 minutes              | ~80 seconds             |
| 1 GB      | ~14 minutes             | ~3 minutes              |
| 2 GB      | ~28 minutes             | ~5 minutes              |

### Chunk Upload Performance

- **Chunk Size**: 10MB
- **Chunks per 100MB**: 10 chunks
- **Retry Delays**: 1s, 3s, 5s
- **Max Retries**: 3 per chunk

## 🐛 Common Issues and Solutions

### Issue 1: Upload Stuck at 0%
**Symptoms**: Progress bar doesn't move

**Solutions**:
1. Check browser console for errors
2. Verify Firebase Auth token
3. Check GCS CORS configuration
4. Verify signed URL generation

### Issue 2: Upload Fails After Pause
**Symptoms**: Resume doesn't work

**Solutions**:
1. Check if resumable URL expired (1 hour)
2. Verify network connectivity
3. Check if file was modified
4. Try starting fresh upload

### Issue 3: Metadata Not Saved
**Symptoms**: Video uploaded but not in dashboard

**Solutions**:
1. Check Firestore permissions
2. Verify Firebase Admin SDK initialization
3. Check API logs for errors
4. Verify user authentication

### Issue 4: File Not Found in GCS
**Symptoms**: Upload completes but file missing

**Solutions**:
1. Check GCS bucket name
2. Verify credentials
3. Check file path in Firestore
4. Look in both drafts/ and videos/ folders

### Issue 5: Slow Upload Speed
**Symptoms**: Upload takes too long

**Solutions**:
1. Check network speed
2. Verify GCS region (use closest)
3. Check chunk size (increase if stable network)
4. Monitor concurrent uploads

## ✅ Test Results Template

```markdown
## Test Results - [Date]

### Environment
- Browser: Chrome 120
- OS: Windows 11
- Network: WiFi (50 Mbps)

### Test 1: Basic Upload
- Status: ✅ PASS
- File Size: 45 MB
- Upload Time: 12 seconds
- Notes: Smooth upload, no issues

### Test 2: Large File Upload
- Status: ✅ PASS
- File Size: 250 MB
- Upload Time: 1 minute 20 seconds
- Notes: Chunked upload worked perfectly

### Test 3: Pause/Resume
- Status: ✅ PASS
- Pause at: 35%
- Resume successful: Yes
- Notes: Resumed from exact point

[Continue for all tests...]

### Overall Result
- Total Tests: 10
- Passed: 10
- Failed: 0
- Success Rate: 100%
```

## 🚀 Production Readiness Checklist

Before deploying to production:

- [ ] All tests pass
- [ ] Environment variables configured
- [ ] GCS lifecycle rules applied
- [ ] CORS policy configured
- [ ] Firebase Auth working
- [ ] Firestore permissions set
- [ ] Error handling tested
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Monitoring setup (optional)

## 📞 Support

If you encounter issues:
1. Check this testing guide
2. Review `UPPY_RESUMABLE_UPLOAD_GUIDE.md`
3. Check browser console logs
4. Review API logs in Vercel
5. Check GCS bucket logs
