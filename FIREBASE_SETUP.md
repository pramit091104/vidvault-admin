# Firebase Google Authentication Setup Guide

This guide will walk you through setting up Firebase Google Authentication for your application.

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard:
   - Enter a project name (e.g., "Magnova Media Admin")
   - Enable/disable Google Analytics (optional)
   - Click "Create project"

## Step 2: Enable Google Authentication

1. In your Firebase project, go to **Authentication** in the left sidebar
2. Click **Get started** (if you haven't enabled it yet)
3. Go to the **Sign-in method** tab
4. Click on **Google** from the list of providers
5. Toggle **Enable** to ON
6. Enter a **Project support email** (your email address)
7. Click **Save**

## Step 3: Get Your Firebase Configuration

1. In Firebase Console, click the gear icon ⚙️ next to "Project Overview"
2. Select **Project settings**
3. Scroll down to the **Your apps** section
4. Click the **Web** icon (`</>`) to add a web app
5. Register your app:
   - Enter an app nickname (e.g., "Magnova Admin")
   - Check "Also set up Firebase Hosting" (optional)
   - Click **Register app**
6. Copy the Firebase configuration object that looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

## Step 4: Configure Environment Variables

1. Create or update your `.env` file in the root of your project
2. Add the following environment variables:

```env
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

**Important:** Replace the placeholder values with your actual Firebase configuration values.

## Step 5: Configure Authorized Domains

1. In Firebase Console, go to **Authentication** > **Settings**
2. Scroll to **Authorized domains**
3. Add your development domain (e.g., `localhost`) if not already listed
4. For production, add your actual domain

## Step 6: Install Dependencies

Run the following command to install Firebase:

```bash
npm install
```

This will install the `firebase` package that was added to your `package.json`.

## Step 7: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `/auth` in your browser
3. Click "Sign in with Google"
4. You should be redirected to Google's sign-in page
5. After signing in, you'll be redirected to the dashboard

## Troubleshooting

### Error: "Firebase: Error (auth/unauthorized-domain)"
- **Solution:** Make sure your domain is added to the authorized domains in Firebase Console (Authentication > Settings > Authorized domains)

### Error: "Firebase: Error (auth/popup-closed-by-user)"
- **Solution:** This happens when the user closes the popup. This is normal behavior, no action needed.

### Error: "Firebase: Error (auth/operation-not-allowed)"
- **Solution:** Make sure Google sign-in is enabled in Firebase Console (Authentication > Sign-in method > Google)

### Environment variables not loading
- **Solution:** 
  - Make sure your `.env` file is in the root directory
  - Restart your development server after adding/changing environment variables
  - Make sure variable names start with `VITE_` (required for Vite)

## Security Notes

1. **Never commit your `.env` file** - It should already be in `.gitignore`
2. The Firebase API key in your frontend is safe to expose (it's public by design)
3. Firebase Security Rules protect your backend resources
4. For production, configure Firebase Security Rules appropriately

## Next Steps

- Set up Firebase Security Rules for Firestore (if you plan to use it)
- Configure user roles/permissions if needed
- Add additional authentication methods if required
- Set up Firebase Hosting for deployment

## Support

If you encounter any issues, check:
- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- [Firebase Console](https://console.firebase.google.com/)
