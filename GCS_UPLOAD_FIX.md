# GCS Upload Error Fix - Invalid JWT Signature

## Problem Summary

You were experiencing two main issues:
1. **Invalid JWT Signature error** - Files failing to upload with error: `invalid_grant: Invalid JWT Signature`
2. **Slow upload times** - Files taking too long to upload

## Root Cause

The "Invalid JWT Signature" error was caused by **improperly formatted private keys** in the Google Cloud Service Account credentials. When the private key contains literal `\n` strings instead of actual newline characters, the JWT signing process fails.

### Why This Happens

When you encode credentials as base64 or store them in environment variables, the newline characters in the private key can get escaped as the literal string `\n` instead of actual newline characters (`\n`). This breaks the RSA signature validation.

## Files Fixed

The following files have been updated with the proper credential handling:

### ✅ Already Had the Fix
- `api/upload.js` (lines 19-22)
- `api/gcs/upload-handler.js` (lines 29-31)
- `api/signed-url.js` (lines 14-16)
- `api/gcs/resumable-upload-url.js` (lines 34-36)
- `api/gcs/finalize-upload.js` (lines 30-32)
- `api/gcs/delete.js` (lines 13-16)

### 🔧 Just Fixed
- `api/gcs/upload.js` - **Primary upload endpoint**
- `api/storage.js` - **Storage operations**
- `api/gcs/metadata.js` - **File metadata**
- `api/gcs/configure-lifecycle.js` - **Lifecycle rules**

## The Fix

Each file now includes this critical code block:

```javascript
let credentials;
if (process.env.GCS_CREDENTIALS) {
  credentials = JSON.parse(process.env.GCS_CREDENTIALS);
} else if (process.env.GCS_CREDENTIALS_BASE64) {
  const decoded = Buffer.from(process.env.GCS_CREDENTIALS_BASE64, 'base64').toString('utf-8');
  credentials = JSON.parse(decoded);
}

// Fix private_key newlines if they are escaped as literal '\n' strings
if (credentials && credentials.private_key) {
  credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
}

if (credentials) {
  const storage = new Storage({
    projectId: process.env.GCS_PROJECT_ID,
    credentials
  });
  bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
}
```

## What Changed

1. **Base64 Support**: Added support for both `GCS_CREDENTIALS` and `GCS_CREDENTIALS_BASE64` environment variables
2. **Newline Fix**: Replaces escaped `\\n` strings with actual newline characters in the private key
3. **Consistent Pattern**: All GCS initialization code now follows the same pattern

## About Slow Upload Times

The slow upload times are likely due to:

1. **Network Speed**: Upload speed depends on your internet connection
2. **File Size**: Larger files naturally take longer
3. **Server Location**: Distance between your location and the GCS bucket region
4. **Retry Logic**: The code retries failed uploads 3 times, which can add time

### Recommendations for Faster Uploads

1. **Use Resumable Uploads**: For files over 4MB, the system automatically uses resumable uploads which are more reliable
2. **Check Network**: Ensure you have a stable, fast internet connection
3. **Optimize File Size**: Compress videos before uploading if possible
4. **Regional Bucket**: Ensure your GCS bucket is in a region close to your users

## Testing the Fix

1. **Restart your development server** to pick up the code changes:
   ```bash
   # Stop the current server (Ctrl+C)
   # Then restart it
   npm run dev
   ```

2. **Try uploading a file** through your application

3. **Check the console logs** - You should see:
   - `✅ GCS initialized for upload API` (or similar)
   - No more "Invalid JWT Signature" errors

## If Issues Persist

If you still see errors after this fix:

1. **Verify Environment Variables**:
   ```bash
   # Check if GCS_CREDENTIALS_BASE64 is set
   echo $env:GCS_CREDENTIALS_BASE64
   ```

2. **Check Credentials Format**: Ensure your base64-encoded credentials are valid JSON

3. **Review Server Logs**: Look for initialization errors when the server starts

4. **Test Credentials**: Try decoding and parsing manually:
   ```javascript
   const decoded = Buffer.from(process.env.GCS_CREDENTIALS_BASE64, 'base64').toString('utf-8');
   const creds = JSON.parse(decoded);
   console.log('Project ID:', creds.project_id);
   console.log('Client Email:', creds.client_email);
   ```

## Next Steps

1. Restart your development server
2. Test file uploads
3. Monitor the console for any remaining errors
4. If uploads are still slow but working, consider the optimization recommendations above
