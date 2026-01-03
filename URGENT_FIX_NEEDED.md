# 🚨 URGENT: Fix Required in Vercel Dashboard

## The Problem
Your Vercel environment variable `VITE_FIREBASE_AUTH_DOMAIN` is set to `previu.online` but it should be `veedo-401e0.firebaseapp.com`.

This is causing Firebase to look for auth handlers on your custom domain instead of Firebase's domain, resulting in:
```
404 Error: User attempted to access non-existent route: /__/auth/handler
```

## The Fix (Takes 2 minutes)

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Select your `previu` project**
3. **Go to Settings → Environment Variables**
4. **Find `VITE_FIREBASE_AUTH_DOMAIN`**
5. **Change the value**:
   - ❌ FROM: `previu.online`
   - ✅ TO: `veedo-401e0.firebaseapp.com`
6. **Click Save**
7. **Redeploy** (go to Deployments tab and click "Redeploy" on latest deployment)

## Why This Happens
- Firebase Auth needs to use Firebase's own domain for authentication handlers
- Your custom domain (`previu.online`) doesn't have these handler files
- Firebase's domain (`veedo-401e0.firebaseapp.com`) has all the required auth infrastructure

## After the Fix
- ✅ No more `/__/auth/handler` 404 errors
- ✅ Google Sign-in will work with popup
- ✅ All authentication features will work normally

This is the final step to fix the Firebase Auth issues!