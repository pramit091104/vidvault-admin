# Fixing Connection Between Vercel (Frontend) and Railway (Backend)

The "Unexpected token <" error occurs because your Frontend (Vercel) is trying to call the API on itself instead of your Backend (Railway). Since the Frontend is a Single Page App, it returns the HTML of your app (starting with `<!doctype...`) instead of the JSON response from the API.

To fix this, you must tell the Frontend where the Backend lives, and tell the Backend to allow the Frontend to talk to it.

## 1. Configure Frontend (Vercel)

You need to set the `VITE_API_BASE_URL` environment variable so the frontend knows the full URL of your backend.

1.  Go to your **Vercel Project Dashboard**.
2.  Navigate to **Settings** > **Environment Variables**.
3.  Add a new variable:
    *   **Key**: `VITE_API_BASE_URL`
    *   **Value**: `https://<your-project-name>.up.railway.app` (Replace with your actual Railway Backend URL)
    *   **Environments**: Production, Preview, Development (optional)
4.  **Redeploy** your application (or trigger a new build) for changes to take effect.

## 2. Configure Backend (Railway)

You need to set the `ALLOWED_ORIGINS` environment variable so the backend accepts requests from your Vercel domain (CORS).

1.  Go to your **Railway Project Dashboard**.
2.  Select your **Backend Service**.
3.  Navigate to the **Variables** tab.
4.  Add or Update `ALLOWED_ORIGINS`:
    *   **Key**: `ALLOWED_ORIGINS`
    *   **Value**: `https://<your-project-name>.vercel.app,http://localhost:5173` (Comma-separated list. Replace with your actual Vercel Frontend URL)
5.  Railway will automatically redeploy your service when you save the variable.

## 3. Verify

1.  Open your deployed Vercel app.
2.  Open the browser console (F12).
3.  If configured correctly, you should no longer see "Unexpected token <".
4.  If you see "CORS error", check step 2 again and ensure the Vercel URL exactly matches what is in `ALLOWED_ORIGINS` (including https:// and no trailing slash).
