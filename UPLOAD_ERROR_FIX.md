# Upload Error Fix: Invalid JWT Signature

## 🔴 Error
```
POST https://vidvault-admin.onrender.com/api/upload/simple 500 (Internal Server Error)
Error uploading file: Error: invalid_grant: Invalid JWT Signature.
```

## 🔍 Root Cause

The error "Invalid JWT Signature" occurs when Google Cloud Storage credentials have **escaped newline characters** (`\\n`) instead of actual newlines (`\n`) in the `private_key` field.

When environment variables are stored in platforms like Render, Railway, or Vercel, the private key's newlines can be escaped as literal `\\n` strings instead of actual line breaks, causing JWT signature verification to fail.

## ✅ Fix Applied

### File: `video-server/api/upload.js`

Added private key newline fix to the GCS initialization:

```javascript
if (process.env.GCS_BUCKET_NAME && process.env.GCS_PROJECT_ID) {
  try {
    let credentials;
    if (process.env.GCS_CREDENTIALS) {
      credentials = JSON.parse(process.env.GCS_CREDENTIALS);
    } else if (process.env.GCS_CREDENTIALS_BASE64) {
      const decoded = Buffer.from(process.env.GCS_CREDENTIALS_BASE64, 'base64').toString('utf-8');
      credentials = JSON.parse(decoded);
    }

    // ✅ FIX: Replace escaped newlines with actual newlines
    if (credentials && credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    if (credentials) {
      const storage = new Storage({ 
        projectId: process.env.GCS_PROJECT_ID, 
        credentials 
      });
      bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
      console.log('✅ GCS initialized for upload API');
    }
  } catch (error) {
    console.error('❌ Failed to initialize GCS:', error.message);
  }
}
```

## 📋 Files Already Fixed

The following files already have this fix in place:
- ✅ `server.js` (line 184)
- ✅ `api/gcs/resumable-upload-url.js` (line 34-36)
- ✅ `api/gcs/delete.js` (line 13-16)
- ✅ `api/upload.js` (JUST FIXED)

## 🚀 Deployment Steps

### For Render.com

1. **Go to your Render dashboard**
2. **Navigate to your video-server service**
3. **Go to Environment tab**
4. **Ensure `GCS_CREDENTIALS_BASE64` is set** (recommended) OR `GCS_CREDENTIALS`
5. **Redeploy the service** to apply the code fix

### Environment Variable Format

**Option 1: Base64 Encoded (Recommended)**
```bash
GCS_CREDENTIALS_BASE64=<your_base64_encoded_service_account_json>
```

**Option 2: Direct JSON**
```bash
GCS_CREDENTIALS={"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n..."}
```

> **Note:** With the fix in place, both formats will work correctly. The code automatically converts `\\n` to actual newlines.

## 🧪 Testing

After redeploying:

1. Try uploading a small file (< 4MB) via the simple upload endpoint
2. Check the server logs for:
   - ✅ `GCS initialized for upload API`
   - ✅ `📤 Uploading file: ...`
   - ✅ `✅ File uploaded to: ...`

## 🔧 Additional Checks

If the error persists after redeployment:

1. **Verify GCS credentials are set** in Render environment variables
2. **Check the service account has proper permissions**:
   - Storage Object Creator
   - Storage Object Viewer
3. **Verify the bucket name matches**: `previu_videos`
4. **Check Render logs** for initialization errors

## 📝 Summary

The fix ensures that regardless of how the credentials are stored in environment variables, the private key will have proper newline formatting for JWT signature generation. This is a common issue when deploying to cloud platforms that escape special characters in environment variables.
