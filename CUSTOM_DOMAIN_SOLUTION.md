# Using previu.online with Firebase Auth

You can keep `previu.online` as your main domain! Here are two solutions:

## Solution 1: Firebase Hosting + Custom Domain (Recommended)

### Step 1: Deploy Frontend to Firebase Hosting
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase Hosting
firebase init hosting

# Build and deploy
npm run build
firebase deploy --only hosting
```

### Step 2: Set Custom Domain in Firebase
1. Go to Firebase Console → Hosting
2. Click "Add custom domain"
3. Enter `previu.online`
4. Follow DNS setup instructions
5. Firebase will provide SSL certificate automatically

### Step 3: Proxy API Routes to Vercel
Update `firebase.json`:
```json
{
  "hosting": {
    "public": "dist",
    "rewrites": [
      {
        "source": "/api/**",
        "function": "https://your-vercel-api-domain.vercel.app/api/**"
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### Benefits:
- ✅ Keep `previu.online` domain
- ✅ Firebase Auth works perfectly (has all handler files)
- ✅ API routes proxied to Vercel
- ✅ Free SSL certificate
- ✅ Global CDN

## Solution 2: Keep Vercel + Fix Auth Domain (Quick Fix)

### Current Setup:
- Frontend: Vercel (`previu.online`)
- API: Vercel serverless functions
- Auth Domain: Must be Firebase domain for auth to work

### Environment Variables:
```bash
# This MUST be Firebase domain (for auth handlers)
VITE_FIREBASE_AUTH_DOMAIN=veedo-401e0.firebaseapp.com

# Your app still runs on previu.online
# Only auth popups/redirects use Firebase domain
```

### How it works:
1. User visits `https://previu.online` (your site)
2. Clicks "Sign in with Google"
3. Popup opens to `https://veedo-401e0.firebaseapp.com` (Firebase auth)
4. After auth, popup closes and user is back on `previu.online`

### Benefits:
- ✅ Quick fix (just change one environment variable)
- ✅ Keep current Vercel setup
- ✅ Users stay on `previu.online` 99% of the time
- ✅ Only auth popup uses Firebase domain

## Recommendation

**Use Solution 2 for now** (quick fix), then **migrate to Solution 1** later for the best experience.

The auth domain is just for Firebase's internal auth infrastructure - users will still primarily interact with `previu.online`.