# Fixing Connection Between Vercel (Frontend) and Railway (Backend)

The "Unexpected token <" error occurs because your Frontend (Vercel) is trying to call the API on itself instead of your Backend (Railway). Since the Frontend is a Single Page App, it returns the HTML of your app (starting with `<!doctype...`) instead of the JSON response from the API.

**Root Cause**: The `VITE_API_BASE_URL` environment variable is not set in production, causing API requests to use relative paths that hit the Vercel frontend instead of the Railway backend.

## Quick Fix Summary

1. **Vercel**: Set `VITE_API_BASE_URL` to `https://vidvault-admin-production.up.railway.app`
2. **Railway**: Verify `ALLOWED_ORIGINS` includes your Vercel URL
3. **Redeploy** both services

---

## Step 1: Configure Frontend (Vercel)

You need to set the `VITE_API_BASE_URL` environment variable so the frontend knows the full URL of your backend.

### Instructions:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project (previu or vidvault-admin)
3. Navigate to **Settings** → **Environment Variables**
4. Add a new variable:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://vidvault-admin-production.up.railway.app`
   - **Environments**: Check all three boxes (Production, Preview, Development)
5. Click **Save**
6. Go to **Deployments** tab
7. Click the **⋯** menu on the latest deployment → **Redeploy** → **Redeploy**

> **Important**: The redeploy is necessary for the environment variable to take effect.

---

## Step 2: Configure Backend (Railway)

You need to set the `ALLOWED_ORIGINS` environment variable so the backend accepts requests from your Vercel domain (CORS).

### Instructions:

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Select your project
3. Select your **Backend Service** (video-server)
4. Navigate to the **Variables** tab
5. Look for `ALLOWED_ORIGINS` variable:
   - If it exists, click **Edit**
   - If it doesn't exist, click **+ New Variable**
6. Set the value to:
   ```
   https://your-vercel-app.vercel.app,http://localhost:5173
   ```
   Replace `your-vercel-app.vercel.app` with your actual Vercel deployment URL
7. Click **Save** or **Add**
8. Railway will automatically redeploy your service

> **Note**: The value is a comma-separated list. Include both your production Vercel URL and localhost for local development.

---

## Step 3: Verify the Fix

### Test Production:

1. Open your deployed Vercel app in a browser
2. Open Browser DevTools (Press **F12**)
3. Go to the **Console** tab
4. Sign in to your application
5. Watch the **Network** tab for API requests

**Expected Results**:
- ✅ API requests should go to `https://vidvault-admin-production.up.railway.app/api/...`
- ✅ Responses should be JSON (not HTML)
- ✅ No "Unexpected token <" errors
- ✅ Subscription status loads successfully

**If you see CORS errors**:
- Double-check that `ALLOWED_ORIGINS` in Railway exactly matches your Vercel URL
- Ensure there's no trailing slash in the URL
- Make sure it includes `https://`

### Test Local Development:

1. Open terminal in the `client` directory
2. Run `npm run dev`
3. Open `http://localhost:5173`
4. Verify API calls go to `http://localhost:3001/api/...`

---

## Troubleshooting

### Still seeing "Unexpected token <"?
- Verify `VITE_API_BASE_URL` is set in Vercel
- Check that you redeployed after adding the variable
- Clear browser cache and hard refresh (Ctrl+Shift+R)

### CORS errors?
- Verify `ALLOWED_ORIGINS` includes your exact Vercel URL
- Check for typos (https vs http, trailing slashes)
- Ensure Railway service redeployed after variable change

### API returns 401 Unauthorized?
- This is expected if not signed in - the fix is working!
- Sign in with your Firebase account to get authenticated

### How to find your Vercel URL?
- Go to Vercel Dashboard → Your Project → Deployments
- Copy the URL from your latest production deployment

### How to find your Railway URL?
- Go to Railway Dashboard → Your Project → Backend Service
- Look for the public URL in the service settings
- Or check the **Deployments** tab for the domain

