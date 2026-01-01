# Uppy Resumable Upload Implementation Guide

## 🎯 Overview

This implementation provides a production-ready, resumable, chunked file upload system for large video files (100MB–2GB+) using **Uppy** and **Google Cloud Storage (GCS)** on Vercel.

## 🏗️ Architecture

### Upload Flow
```
Frontend (Uppy) → Backend API (Signed URL) → GCS (Direct Upload) → Firestore (Metadata)
```

### Key Features
- ✅ Resumable uploads with automatic retry
- ✅ Chunked upload (10MB chunks)
- ✅ Real-time progress tracking
- ✅ Pause/Resume functionality
- ✅ Network failure recovery
- ✅ No Vercel timeout issues (direct to GCS)
- ✅ Secure authentication (Firebase Auth)
- ✅ Automatic lifecycle management

## 📦 Components

### Backend APIs

#### 1. `/api/gcs/resumable-upload-url.js`
**Purpose**: Generate signed resumable upload URLs

**Request**:
```json
{
  "fileName": "video.mp4",
  "fileSize": 104857600,
  "contentType": "video/mp4",
  "metadata": {
    "title": "My Video",
    "description": "Description",
    "clientName": "Client Name"
  }
}
```

**Response**:
```json
{
  "success": true,
  "uploadUrl": "https://storage.googleapis.com/...",
  "gcsPath": "drafts/userId/timestamp-video.mp4",
  "expiresAt": "2026-01-01T12:00:00Z",
  "userId": "user123"
}
```

**Security**:
- Requires Firebase Auth token
- Validates file type (video only)
- Enforces 2GB size limit
- Generates unique file paths

#### 2. `/api/gcs/finalize-upload.js`
**Purpose**: Move file from drafts to final location and save metadata

**Request**:
```json
{
  "gcsPath": "drafts/userId/timestamp-video.mp4",
  "videoId": "uuid",
  "metadata": {
    "title": "My Video",
    "description": "Description",
    "clientName": "Client Name",
    "securityCode": "ABC123"
  }
}
```

**Response**:
```json
{
  "success": true,
  "videoId": "uuid",
  "gcsPath": "videos/userId/timestamp-video.mp4",
  "signedUrl": "https://storage.googleapis.com/...",
  "expiresAt": "2026-01-08T12:00:00Z"
}
```

#### 3. `/api/gcs/configure-lifecycle.js`
**Purpose**: Configure automatic deletion of draft files

**Lifecycle Rules**:
- `drafts/` folder: Auto-delete after 30 days
- `temp/` folder: Auto-delete after 1 day
- `videos/` folder: Keep permanently

### Frontend Components

#### 1. `UppyUploadService` (`src/lib/uppyUploadService.ts`)
Core upload service using Uppy library

**Features**:
- Resumable upload initialization
- Progress tracking
- Speed calculation
- Pause/Resume/Cancel
- Automatic retry (1s, 3s, 5s delays)
- Page unload prevention

**Usage**:
```typescript
const service = new UppyUploadService();

await service.startUpload({
  file: videoFile,
  metadata: {
    title: "My Video",
    description: "Description",
    clientName: "Client"
  },
  onProgress: (progress) => console.log(`${progress}%`),
  onUploadSpeed: (speed) => console.log(`${speed} bytes/s`),
  onSuccess: (result) => console.log('Done!', result),
  onError: (error) => console.error(error)
});
```

#### 2. `useUppyUpload` Hook (`src/hooks/useUppyUpload.ts`)
React hook for easy integration

**State**:
- `isUploading`: Upload in progress
- `uploadProgress`: 0-100%
- `uploadSpeed`: Bytes per second
- `currentChunk`: Current chunk number
- `totalChunks`: Total chunks
- `error`: Error message
- `result`: Upload result
- `isPaused`: Paused state

**Methods**:
- `startUpload(options)`: Start upload
- `pauseUpload()`: Pause upload
- `resumeUpload()`: Resume upload
- `cancelUpload()`: Cancel upload
- `reset()`: Reset state

#### 3. `UppyUploadSection` Component (`src/components/dashboard/UppyUploadSection.tsx`)
Complete upload UI with form and progress tracking

**Features**:
- File selection with validation
- Metadata input (title, description, client)
- Real-time progress display
- Upload speed and ETA
- Pause/Resume/Cancel controls
- Success state with reset

## 🔐 Security Implementation

### Authentication
- Firebase Auth token required for all API calls
- Token verification on backend using Firebase Admin SDK
- User ID extracted from token for file path generation

### File Validation
- **Type**: Only video MIME types allowed
- **Size**: Maximum 2GB enforced
- **Path**: Unique paths prevent overwrites

### Access Control
- Files stored in `drafts/` initially (private)
- Moved to `videos/` after finalization
- Signed URLs with 7-day expiration
- User-specific folder structure

## 📊 Database Schema (Firestore)

### Collection: `gcsClientCodes`

```typescript
{
  id: string;                    // UUID
  title: string;                 // Video title
  description: string;           // Description
  clientName: string;            // Client name
  fileName: string;              // Original filename
  gcsPath: string;               // GCS file path
  publicUrl: string;             // Signed URL
  size: number;                  // File size in bytes
  contentType: string;           // MIME type
  userId: string;                // Firebase user ID
  securityCode: string;          // 6-char code
  isActive: boolean;             // Soft delete flag
  accessCount: number;           // Access counter
  privacyStatus: string;         // 'private' | 'unlisted' | 'public'
  isPubliclyAccessible: boolean; // Public flag
  service: 'gcs';                // Service identifier
  uploadedAt: Timestamp;         // Upload timestamp
  lastAccessed: Timestamp;       // Last access timestamp
}
```

## 🚀 Deployment Checklist

### 1. Environment Variables

Add to `.env` and Vercel:

```env
# GCS Configuration
GCS_PROJECT_ID=your-project-id
GCS_BUCKET_NAME=your-bucket-name
GCS_CREDENTIALS={"type":"service_account",...}

# Firebase Configuration
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
```

### 2. Install Dependencies

```bash
npm install @uppy/core @uppy/xhr-upload firebase-admin --legacy-peer-deps
```

### 3. Configure GCS Bucket

Run lifecycle configuration:
```bash
curl -X POST https://your-domain.com/api/gcs/configure-lifecycle
```

### 4. Set CORS Policy

Ensure GCS bucket allows browser uploads:
```json
[
  {
    "origin": ["https://your-domain.com"],
    "method": ["GET", "HEAD", "PUT", "POST", "OPTIONS"],
    "responseHeader": ["Content-Type", "Content-Length"],
    "maxAgeSeconds": 3600
  }
]
```

### 5. Deploy to Vercel

```bash
vercel --prod
```

## 📈 Performance Optimization

### Chunk Size
- Default: 10MB chunks
- Optimal for 100MB–2GB files
- Balances speed and reliability

### Retry Strategy
- Exponential backoff: 1s, 3s, 5s
- Maximum 3 retries per chunk
- Automatic resume on network recovery

### Bandwidth Calculation
- Moving average over last 10 samples
- Real-time speed display
- Accurate ETA estimation

## 🐛 Troubleshooting

### Upload Fails Immediately
- Check Firebase Auth token validity
- Verify GCS credentials in environment
- Ensure bucket exists and is accessible

### Upload Stalls at 0%
- Check CORS configuration on GCS bucket
- Verify signed URL generation
- Check browser console for errors

### Upload Fails After Pause/Resume
- Ensure resumable upload URL hasn't expired (1 hour)
- Check network connectivity
- Verify file hasn't been modified

### Metadata Not Saved
- Check Firestore permissions
- Verify Firebase Admin SDK initialization
- Check API logs for errors

## 🔄 Migration from Old System

### Step 1: Add Uppy Component
```tsx
import UppyUploadSection from '@/components/dashboard/UppyUploadSection';

// Replace old upload component
<UppyUploadSection />
```

### Step 2: Update Routes
Ensure new API routes are deployed:
- `/api/gcs/resumable-upload-url`
- `/api/gcs/finalize-upload`
- `/api/gcs/configure-lifecycle`

### Step 3: Test Upload Flow
1. Select large video file (>100MB)
2. Fill metadata
3. Start upload
4. Test pause/resume
5. Verify metadata in Firestore
6. Check file in GCS bucket

## 📚 Additional Resources

- [Uppy Documentation](https://uppy.io/docs/)
- [GCS Resumable Uploads](https://cloud.google.com/storage/docs/resumable-uploads)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)

## ✅ Success Criteria

After implementation, you should have:
- ✅ Reliable large video uploads (100MB–2GB+)
- ✅ Resume-on-failure support
- ✅ Zero Vercel timeout issues
- ✅ Professional-grade upload UX
- ✅ Scalable storage architecture
- ✅ Automatic lifecycle management
- ✅ Secure authentication and access control

## 🎉 Next Steps

1. **Test with large files**: Upload 500MB+ videos
2. **Monitor performance**: Track upload speeds and success rates
3. **Optimize chunk size**: Adjust based on user network speeds
4. **Add compression**: Integrate video compression before upload
5. **Implement analytics**: Track upload metrics and failures
