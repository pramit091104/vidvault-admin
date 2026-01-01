# Uppy Resumable Upload - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies (1 min)

```bash
npm install
```

### Step 2: Configure Environment (2 min)

Ensure your `.env` file has these variables:

```env
# GCS Configuration
GCS_PROJECT_ID=your-project-id
GCS_BUCKET_NAME=your-bucket-name
GCS_CREDENTIALS={"type":"service_account",...}

# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
```

### Step 3: Setup GCS Lifecycle (1 min)

```bash
npm run setup:gcs-lifecycle
```

### Step 4: Start Development Server (1 min)

```bash
npm run dev:all
```

### Step 5: Test Upload

1. Navigate to `http://localhost:5173`
2. Sign in with your account
3. Go to upload section
4. Select a video file
5. Fill in metadata
6. Click "Start Upload"

## 🎯 What You Get

### ✅ Features Implemented

1. **Resumable Uploads**
   - Automatic retry on failure
   - Pause/Resume functionality
   - Network interruption recovery

2. **Chunked Upload**
   - 10MB chunks for optimal performance
   - Progress tracking per chunk
   - Parallel chunk upload support

3. **Real-time Progress**
   - Upload percentage (0-100%)
   - Upload speed (MB/s)
   - Time remaining (ETA)
   - Current chunk / Total chunks

4. **Security**
   - Firebase Authentication required
   - Signed URLs with expiration
   - File type validation (video only)
   - Size limit enforcement (2GB)

5. **Reliability**
   - Automatic retry (3 attempts)
   - Exponential backoff (1s, 3s, 5s)
   - Page unload prevention
   - Error recovery

6. **Storage Management**
   - Auto-delete drafts after 30 days
   - Auto-delete temp files after 1 day
   - Permanent storage for final videos

## 📁 File Structure

```
├── api/
│   └── gcs/
│       ├── resumable-upload-url.js    # Generate signed URLs
│       ├── finalize-upload.js         # Move & save metadata
│       └── configure-lifecycle.js     # Lifecycle rules
├── src/
│   ├── lib/
│   │   └── uppyUploadService.ts       # Core upload service
│   ├── hooks/
│   │   └── useUppyUpload.ts           # React hook
│   └── components/
│       └── dashboard/
│           └── UppyUploadSection.tsx  # Upload UI
└── scripts/
    └── setup-gcs-lifecycle.js         # Setup script
```

## 🔧 Configuration Options

### Chunk Size
Default: 10MB (optimal for most cases)

To change:
```typescript
// In uppyUploadService.ts
const chunkSize = 10 * 1024 * 1024; // 10MB
```

### Retry Configuration
Default: 3 retries with delays [1s, 3s, 5s]

To change:
```typescript
// In uppyUploadService.ts
retryDelays: [1000, 3000, 5000]
```

### File Size Limit
Default: 2GB

To change:
```typescript
// In resumable-upload-url.js
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;
```

### Signed URL Expiry
Default: 7 days

To change:
```javascript
// In finalize-upload.js
const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
```

## 🎨 UI Components

### Upload Form
```tsx
<UppyUploadSection />
```

Features:
- File selection
- Metadata input (title, description, client)
- Upload button

### Progress Display
- Progress bar (0-100%)
- Upload speed (MB/s)
- Time remaining
- Chunk progress (current/total)

### Controls
- Pause button
- Resume button
- Cancel button

## 📊 Usage Example

```tsx
import { useUppyUpload } from '@/hooks/useUppyUpload';

function MyUploadComponent() {
  const {
    isUploading,
    uploadProgress,
    uploadSpeed,
    startUpload,
    pauseUpload,
    resumeUpload
  } = useUppyUpload();

  const handleUpload = async () => {
    await startUpload({
      file: myFile,
      metadata: {
        title: "My Video",
        description: "Description",
        clientName: "Client"
      },
      onProgress: (progress) => {
        console.log(`${progress}%`);
      },
      onSuccess: (result) => {
        console.log('Upload complete!', result);
      }
    });
  };

  return (
    <div>
      <button onClick={handleUpload}>Upload</button>
      {isUploading && (
        <div>
          <p>Progress: {uploadProgress}%</p>
          <p>Speed: {uploadSpeed} bytes/s</p>
          <button onClick={pauseUpload}>Pause</button>
          <button onClick={resumeUpload}>Resume</button>
        </div>
      )}
    </div>
  );
}
```

## 🔍 Monitoring

### Browser Console
```javascript
// Check upload state
console.log('Uploading:', isUploading);
console.log('Progress:', uploadProgress);
console.log('Speed:', uploadSpeed);
```

### Network Tab
Monitor these requests:
- `POST /api/gcs/resumable-upload-url` - Get upload URL
- `PUT https://storage.googleapis.com/...` - Upload chunks
- `POST /api/gcs/finalize-upload` - Finalize upload

### Firestore
Check collection: `gcsClientCodes`
- Verify metadata saved
- Check GCS path
- Verify signed URL

### GCS Bucket
Check folders:
- `drafts/` - Files during upload
- `videos/` - Final files
- `temp/` - Temporary files

## 🐛 Troubleshooting

### Upload doesn't start
1. Check Firebase Auth (user signed in?)
2. Check browser console for errors
3. Verify environment variables

### Upload fails at 50%
1. Check network connection
2. Verify GCS credentials
3. Check CORS configuration

### Metadata not saved
1. Check Firestore permissions
2. Verify Firebase Admin SDK
3. Check API logs

## 📚 Next Steps

1. **Test with large files** (>500MB)
2. **Test pause/resume** functionality
3. **Test network interruption** recovery
4. **Monitor performance** metrics
5. **Deploy to production**

## 🎉 Success!

You now have a production-ready resumable upload system!

Key achievements:
- ✅ No Vercel timeout issues
- ✅ Handles 100MB–2GB+ files
- ✅ Automatic retry and recovery
- ✅ Professional UX
- ✅ Secure and scalable

## 📖 Additional Resources

- [Full Implementation Guide](./UPPY_RESUMABLE_UPLOAD_GUIDE.md)
- [Testing Guide](./UPPY_UPLOAD_TESTING.md)
- [Uppy Documentation](https://uppy.io/docs/)
- [GCS Documentation](https://cloud.google.com/storage/docs)

## 💡 Tips

1. **Test with real files**: Use actual video files from your users
2. **Monitor upload speeds**: Track performance over time
3. **Adjust chunk size**: Optimize based on user network speeds
4. **Set up alerts**: Monitor failed uploads
5. **Collect feedback**: Ask users about their experience

## 🆘 Need Help?

1. Check the [Testing Guide](./UPPY_UPLOAD_TESTING.md)
2. Review [Implementation Guide](./UPPY_RESUMABLE_UPLOAD_GUIDE.md)
3. Check browser console logs
4. Review Vercel function logs
5. Check GCS bucket logs
