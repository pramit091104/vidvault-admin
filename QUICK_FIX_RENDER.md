# 🚀 Quick Fix for Render Deployment

## The Issue
Your backend is on Render with **wrong GCS credentials**. That's why you're getting "invalid_grant" errors.

## Quick Fix (5 minutes)

### Step 1: Get the Correct Credentials ✅
The credentials are ready! Open the file: **`RENDER_GCS_CREDENTIALS.txt`**

Or copy from the output above (the long JSON string between the dashed lines).

### Step 2: Update Render 🔧

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com/
   - Log in

2. **Find Your Service**
   - Look for your video-server service
   - Click on it

3. **Update Environment Variables**
   - Click **"Environment"** in the left sidebar
   - Find **`GCS_CREDENTIALS`**
   - Click **Edit** (pencil icon)
   - **Delete the old value**
   - **Paste the new value** from `RENDER_GCS_CREDENTIALS.txt`
   - Click **"Save Changes"**

4. **Delete Old Variable (if exists)**
   - Look for **`GCS_CREDENTIALS_BASE64`**
   - If you see it, click the **trash icon** to delete it
   - This had the wrong credentials

5. **Verify Other Variables**
   Make sure these are correct:
   - `GCS_PROJECT_ID` = `veedo-401e0`
   - `GCS_BUCKET_NAME` = `previu_videos`

### Step 3: Wait for Redeploy ⏳

- Render will automatically redeploy (takes 2-5 minutes)
- Watch the **"Logs"** tab
- Look for: **"GCS initialized successfully"** ✅
- Should NOT see: "invalid_grant" ❌

### Step 4: Test 🧪

1. **Clear browser cache**: `Ctrl+Shift+R`
2. **Go to a watch page**
3. **Open console** (F12)
4. **Check**: No more "invalid_grant" errors! 🎉

## What Was Wrong?

Your Render deployment had credentials for the **wrong project**:
- ❌ Old: `veedo-480512` (wrong project)
- ✅ New: `veedo-401e0` (correct project)

## Still Having Issues?

### Check Render Logs
1. Go to your service in Render
2. Click "Logs" tab
3. Look for errors during startup
4. Should see "GCS initialized successfully"

### Verify Environment Variable
1. Go to "Environment" tab
2. Make sure `GCS_CREDENTIALS` is saved correctly
3. Make sure `GCS_CREDENTIALS_BASE64` is deleted
4. No extra spaces or quotes

### Check Frontend
Make sure your frontend (Vercel) has the correct Render URL:
- Variable: `VITE_API_BASE_URL`
- Value: Your Render service URL (e.g., `https://your-service.onrender.com`)

## Need the Credentials Again?

Run this command:
```bash
node get-render-credentials.js
```

Or open: `RENDER_GCS_CREDENTIALS.txt`

---

**That's it!** Once Render redeploys with the correct credentials, your watch page will work perfectly. 🎉
