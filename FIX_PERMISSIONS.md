# Fix Service Account Permissions

Your service account `previu@veedo-401e0.iam.gserviceaccount.com` needs additional permissions.

## 🔧 Quick Fix

### Option 1: Using Google Cloud Console (Recommended)

1. **Go to IAM & Admin:**
   ```
   https://console.cloud.google.com/iam-admin/iam?project=veedo-401e0
   ```

2. **Find your service account:**
   - Look for `previu@veedo-401e0.iam.gserviceaccount.com`

3. **Edit permissions (click the pencil icon):**
   - Add these roles:
     - `Storage Admin` (full storage access)
     - `Storage Object Admin` (file operations)
     - `Storage Object Creator` (upload files)
     - `Storage Object Viewer` (read files)

### Option 2: Using gcloud CLI

```bash
# Grant Storage Admin role
gcloud projects add-iam-policy-binding veedo-401e0 \
    --member="serviceAccount:previu@veedo-401e0.iam.gserviceaccount.com" \
    --role="roles/storage.admin"

# Grant Storage Object Admin role
gcloud projects add-iam-policy-binding veedo-401e0 \
    --member="serviceAccount:previu@veedo-401e0.iam.gserviceaccount.com" \
    --role="roles/storage.objectAdmin"
```

## 🪣 Create the Bucket

After fixing permissions, create the bucket:

1. **Go to Cloud Storage:**
   ```
   https://console.cloud.google.com/storage/browser?project=veedo-401e0
   ```

2. **Create bucket:**
   - Name: `previu_videos`
   - Location: Choose your preferred region
   - Storage class: Standard
   - Access control: Uniform

## 🧪 Test After Fixing

After granting permissions and creating the bucket:

```bash
npm run setup:project
```

This should now work without permission errors.

## 🚀 Alternative: Use Firebase Storage

If you prefer to avoid GCS permission complexity, you can use Firebase Storage instead (it's part of the same project):

1. **Enable Firebase Storage** in your Firebase console
2. **Use the Firebase Storage bucket:** `veedo-401e0.firebasestorage.app`
3. **Update your environment variables:**
   ```
   GCS_BUCKET_NAME=veedo-401e0.firebasestorage.app
   ```

Firebase Storage uses the same underlying GCS but with simpler permissions through Firebase Auth.

## 📋 Current Status

✅ **Service account created:** `previu@veedo-401e0.iam.gserviceaccount.com`
✅ **Credentials configured:** Project ID matches (`veedo-401e0`)
❌ **Permissions missing:** Need Storage Admin roles
❌ **Bucket missing:** Need to create `previu_videos`

After fixing these two items, everything should work perfectly!