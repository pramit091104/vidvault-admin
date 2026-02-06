# How to Restart Your Server with Fixed Credentials

## The Problem
Your server is still using old/cached credentials. The fix has been applied to the `.env` files, but you need to restart the server for it to take effect.

## Quick Fix - Restart Your Server

### Option 1: If server is running in a terminal
1. Find the terminal window where the server is running
2. Press `Ctrl+C` to stop it
3. Run: `cd video-server`
4. Run: `npm start`

### Option 2: If server is running as a service/background process
1. Stop the server process (check Task Manager or your process manager)
2. Open a new terminal
3. Run: `cd video-server`
4. Run: `npm start`

### Option 3: Use the provided batch file
1. Double-click `start-server-fixed.bat` in the project root
2. This will show you which credentials are being used and start the server

## Verify the Fix

After restarting, you should see in the server logs:
```
GCS initialized successfully
```

If you see any errors about "invalid_grant", the server is still using wrong credentials.

## What Was Fixed

1. ✅ Fixed `video-server/.env` - Corrected the GCS_CREDENTIALS private key
2. ✅ Disabled `video-server/.env.local` - Renamed to `.env.local.backup` (it had wrong credentials)
3. ✅ Server now uses correct credentials:
   - Project: `veedo-401e0`
   - Service Account: `previu@veedo-401e0.iam.gserviceaccount.com`
   - Private Key ID: `7d034b84f0d9c63c230d1262193f15ba93d5e60f`

## Important Notes

### Client .env File Issue
The `client/.env` file has an **invalid service account key** (Private Key ID: `08da75fb6f4242ced9965c2aab9667fe763c18cc`). This key has been deleted or is invalid.

**However**, the client shouldn't be using GCS credentials directly - it should call the server API which then uses its own credentials. So this shouldn't affect your local development.

### If You're Still Getting Errors

If you restart the server and still get "invalid_grant" errors:

1. **Check which port the server is running on**
   - Should be port 3001
   - Check the terminal output when you start the server

2. **Check if the client is connecting to the right server**
   - In development, it should connect to `http://localhost:3001`
   - Check browser Network tab to see where requests are going

3. **Clear browser cache**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or clear cache in browser settings

4. **Check server logs**
   - Look for "GCS initialized successfully" message
   - Look for any error messages about credentials

## Testing

Once the server is restarted:
1. Open your app in the browser
2. Navigate to a watch page
3. Open browser console (F12)
4. You should NOT see "invalid_grant" errors
5. Video should load and play correctly

## Need More Help?

If you're still having issues after restarting:
1. Check the server terminal for error messages
2. Check the browser console for error messages
3. Verify the server is running on port 3001
4. Verify the client is making requests to `http://localhost:3001`
