# Project Migration Guide: Moving to veedo-401e0

This guide helps you migrate from the `veedo-480512` GCS project to the `veedo-401e0` Firebase project for consistency.

## 🎯 Current Status

✅ **Updated Configuration Files:**
- `.env.vercel` - Updated to use `veedo-401e0` project ID
- `vercel.json` - Added missing API endpoints

❌ **Still Needed:**
- GCS service account credentials for `veedo-401e0`
- GCS bucket creation in `veedo-401e0` project
- Video file migration (optional)

## 🔧 Step-by-Step Migration

### Step 1: Create GCS Bucket in veedo-401e0

1. **Go to Google Cloud Console:**
   ```
   https://console.cloud.google.com/storage/browser?project=veedo-401e0
   ```

2. **Create a new bucket:**
   - Name: `previu_videos` (or your preferred name)
   - Location: Choose same region as your users
   - Storage class: Standard
   - Access control: Uniform (recommended)

### Step 2: Create Service Account

1. **Go to IAM & Admin > Service Accounts:**
   ```
   https://console.cloud.google.com/iam-admin/serviceaccounts?project=veedo-401e0
   ```

2. **Create Service Account:**
   - Name: `video-signer` (or your preferred name)
   - Description: "Service account for video signing and storage operations"

3. **Grant Roles:**
   - `Storage Object Admin` (for full file operations)
   - `Storage Admin` (for bucket configuration)

4. **Create and Download Key:**
   - Click on the service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - Choose JSON format
   - Download the key file

### Step 3: Update Environment Variables

1. **Copy the JSON content from the downloaded key file**

2. **Update `.env.vercel` with the new credentials:**
   ```bash
   # Replace the GCS_CREDENTIALS value with your new service account JSON
   GCS_CREDENTIALS={"type":"service_account","project_id":"veedo-401e0",...}
   ```

3. **Update Vercel Environment Variables:**
   - Go to Vercel Dashboard > Your Project > Settings > Environment Variables
   - Update these variables:
     - `GCS_PROJECT_ID=veedo-401e0`
     - `GCS_BUCKET_NAME=previu_videos`
     - `GCS_CREDENTIALS=<your-new-service-account-json>`

### Step 4: Configure CORS for New Bucket

Run this command after creating the bucket:

```bash
# Create cors.json file (already exists in your project)
gsutil cors set cors.json gs://previu_videos
```

Or use the automated script:
```bash
npm run fix:common
```

### Step 5: Migrate Existing Videos (Optional)

If you have videos in the old bucket that you want to keep:

1. **List videos in old bucket:**
   ```bash
   gsutil ls gs://previu_videos
   ```

2. **Copy videos to new bucket:**
   ```bash
   gsutil -m cp -r gs://old-bucket-name/* gs://previu_videos/
   ```

3. **Update database records** to point to new bucket (if needed)

## 🚀 Quick Setup Script

I'll create a script to help automate some of these steps:

### Step 6: Test the Migration

1. **Deploy the updated configuration:**
   ```bash
   npm run build
   # Deploy to Vercel
   ```

2. **Test the endpoints:**
   ```bash
   npm run debug:deployment
   ```

3. **Test video upload and playback**

## 🔍 Verification Checklist

- [ ] GCS bucket created in `veedo-401e0`
- [ ] Service account created with proper roles
- [ ] Environment variables updated in Vercel
- [ ] CORS configured for new bucket
- [ ] API endpoints working (no 405 errors)
- [ ] Video upload working
- [ ] Video playback working
- [ ] Video deletion working

## 🚨 Troubleshooting

### If you get "bucket not found" errors:
1. Verify bucket name matches `GCS_BUCKET_NAME`
2. Check service account has access to the bucket
3. Ensure project ID is correct in credentials

### If you get permission errors:
1. Verify service account has `Storage Object Admin` role
2. Check that the service account JSON is properly formatted
3. Ensure no extra spaces or line breaks in environment variables

### If CORS errors persist:
1. Run `npm run fix:common` to auto-configure CORS
2. Manually set CORS using `gsutil cors set cors.json gs://your-bucket`
3. Check that your domain is in the CORS origins list

## 📋 Environment Variables Summary

After migration, your environment should have:

```bash
# All using veedo-401e0 project
VITE_FIREBASE_PROJECT_ID=veedo-401e0
VITE_GCS_PROJECT_ID=veedo-401e0
GCS_PROJECT_ID=veedo-401e0

# Bucket name (update if different)
VITE_GCS_BUCKET_NAME=previu_videos
GCS_BUCKET_NAME=previu_videos

# New service account credentials
GCS_CREDENTIALS={"type":"service_account","project_id":"veedo-401e0",...}
```

## 🎉 Benefits After Migration

- ✅ Single project for all Google services
- ✅ Simplified billing and management
- ✅ Consistent permissions and access control
- ✅ No more project ID mismatches
- ✅ Easier debugging and monitoring

Let me know when you've completed these steps and I can help you test the migration!