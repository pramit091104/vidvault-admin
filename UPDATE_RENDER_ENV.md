# Update Render Environment Variables

## The Problem
Your backend is deployed on Render, so changing the local `.env` file doesn't affect the deployed server. You need to update the environment variables in Render's dashboard.

## Steps to Fix

### 1. Get the Correct Credentials

The correct `GCS_CREDENTIALS` value is in `video-server/.env`. Here's what you need:

```json
{"type": "service_account","project_id": "veedo-401e0","private_key_id": "7d034b84f0d9c63c230d1262193f15ba93d5e60f","private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDJrd/7hnzWrap2\n1B8xmuNJA56T5Qn2mh+S4yrAnsSQZCQdERWsjV0XD2Nm9IwKwNTahx6+qZUBtWx9\ndS8FnHOZ+DOVOCkTcq3I8nCdgRXwcxGTpRkSSm4Tb4aR+ppiWswD+Q7RCeW+3GBB\nEvB1RCMObGnBQpTYpOfmhTH7xB0RA2ptIHkGB8oJiDXVPHkHTX20DAI7d2SUPEiC\ngUT6bp0aLpjJpktR6pEeOg7fjozY4hystkX44NzJywA9l2uOjItOkWywKCzJqVhK\n2pG6tUJDdp0gCMuOCwNAP73fo3f8jRM3SE5AjOacrFBkmDEmaFik+wDJLuIOOYY9\ntIG2BLfjAgMBAAECggEAQSk3CYbZ1ejVf0Ao9feDwOb0+PbTAcSpN+XCvepuOvLI\nAkYvWQlxjs5PgQe5KY5FF3f5tIOJG7y42U4fy7HRXelmDSvQhbKTOK4wOYtoAcDD\n6I66q4C10PzDH243LFkGuq/hHCQVAVYlmVDbtR+3LeVUQ/dVrSuWq5HUZPJnq8N6\nYQ67svaL70r4B8GiEhZ1GWrNGLpJaagGec/G5kC1E1nshEwZjyV9xRVQQteE7o01\ntzen7Hyn2fZwGjEuLyv5Sj9+vv3X/CtzoHi+vv/nz/53TPwfupAekmjUj7Wb9xS1\n67Q7M3faZV3QcNIChxDX5iVE/GPS5dQQzjqfhkc8oQKBgQDpXt8PR724RY4LlAhG\nSXorAAOzK93UVKh8ggNKfLP+BKfsnsIRmWlQqUl1FWIC0Ni28EKHwCFN8DlhNXau\ntyH1hSkb3wsKnEHUztOEoekOxK19B2dsv7rV+n+C5YyR1PRx+J1tFijEcADBA1qB\nLf5nUl7tKGMhXrnkakzj5GIegwKBgQDdPE4WGiuj227ZEUoI7O8SzAUu8xMrTzwR\n9Os9S0zdQydeWPWHLCOjyyJ0rwEbyamhEZqIO2OUQjwQwUC3nUR74Arm+yTGUTjG\nrPgvERzU7B5KN+oHW0jazl6GePdOQ/mzWDY8eqNRSuxBjgdt4qvn/UUwsMmJZvDX\nZi2qfYvDIQKBgDvzh1Ihl/dyxt7qlIWZ8qyBQHIS3tXhObdinv3Ps12aTJlY33ot\n8wQpuRk++QLILCQy7KR7ExM2l0cFuQuBOFQedUUXs3pyUecdivETtw94LyljcYpa\nZuD5jTBPUCFWl8V/nNGdU7PDIi5zchilfCmG26QJMA4ui4rGVCJnVV2JAoGAZ8l3\ntIS4flleCjVDLybADWhq8hiUoJe+TYpBpXKi75YmbOt829oIKjoMwwKqmXekvWw9\nu7VoxM/Bz/ZpPvpne1mio7OkD+lgokvY7nOvu++9UgIjJypa5lM0Iw+yrSPUi59R\nalP6NBPa+/H+aD2TefTmNa5qDayeRd6og7f8DiECgYEAtxsgtFgZDaely0VLraN5\ntYq1TpZbfD2cN1n3p5vs3JqxKFZFexRxlgSTMVexAgPeiOnvjdCvdCh1IMyDn9gp\nCiF7gH2il/WRAXvEFM3SkcMSFl3CXOhMKHyq/DQDWyDnH3Wy8ls4i7gEBtrr9QoQ\nBGvuvsCRbOQjtM0C6sBcRxQ=\n-----END PRIVATE KEY-----\n","client_email": "previu@veedo-401e0.iam.gserviceaccount.com","client_id": "106276358745416209993","auth_uri": "https://accounts.google.com/o/oauth2/auth","token_uri": "https://oauth2.googleapis.com/token","auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/previu%40veedo-401e0.iam.gserviceaccount.com","universe_domain": "googleapis.com"}
```

**IMPORTANT**: Copy the entire JSON string above (it's all one line).

### 2. Update Render Environment Variables

1. **Go to Render Dashboard**
   - Visit https://dashboard.render.com/
   - Log in to your account

2. **Select Your Service**
   - Find your video-server service
   - Click on it to open the service details

3. **Go to Environment Tab**
   - Click on "Environment" in the left sidebar
   - You'll see a list of environment variables

4. **Update GCS_CREDENTIALS**
   - Find the `GCS_CREDENTIALS` variable
   - Click "Edit" or the pencil icon
   - **Delete the old value completely**
   - **Paste the new value** (the JSON string from above)
   - Click "Save Changes"

5. **Check for GCS_CREDENTIALS_BASE64**
   - If you see a variable called `GCS_CREDENTIALS_BASE64`, **DELETE IT**
   - This was the old/wrong credentials that was causing the error
   - Click the trash/delete icon next to it

6. **Verify Other Variables**
   Make sure these are also set correctly:
   - `GCS_PROJECT_ID` = `veedo-401e0`
   - `GCS_BUCKET_NAME` = `previu_videos`

### 3. Redeploy Your Service

After updating the environment variables:

1. **Trigger a Redeploy**
   - Render should automatically redeploy when you save environment variables
   - If not, click "Manual Deploy" → "Deploy latest commit"

2. **Wait for Deployment**
   - Watch the deployment logs
   - Look for "GCS initialized successfully" message
   - Deployment usually takes 2-5 minutes

3. **Check Deployment Logs**
   - Go to "Logs" tab
   - Look for any errors
   - You should see "GCS initialized successfully"
   - You should NOT see "invalid_grant" errors

### 4. Test Your Application

Once deployment is complete:

1. **Clear Browser Cache**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

2. **Test Watch Page**
   - Navigate to a video watch page
   - Open browser console (F12)
   - You should NOT see "invalid_grant" errors
   - Video should load and play correctly

## What Was Wrong

The issue was that Render had the wrong `GCS_CREDENTIALS` or `GCS_CREDENTIALS_BASE64` environment variable set. It was pointing to:
- ❌ Wrong project: `veedo-480512`
- ❌ Wrong service account: `video-signer@veedo-480512.iam.gserviceaccount.com`

The correct credentials are:
- ✅ Correct project: `veedo-401e0`
- ✅ Correct service account: `previu@veedo-401e0.iam.gserviceaccount.com`

## Troubleshooting

### If you still see errors after redeploying:

1. **Check Render Logs**
   - Look for "GCS initialized successfully"
   - Look for any credential-related errors

2. **Verify Environment Variables**
   - Make sure `GCS_CREDENTIALS` is set correctly
   - Make sure `GCS_CREDENTIALS_BASE64` is deleted (if it exists)
   - Make sure there are no extra spaces or line breaks

3. **Check Your Frontend**
   - Make sure your frontend is pointing to the correct Render URL
   - Check `VITE_API_BASE_URL` in your Vercel/frontend deployment

4. **Contact Support**
   - If issues persist, check Render's status page
   - Contact Render support if needed

## Alternative: Use GCS_CREDENTIALS_BASE64

If you prefer to use base64-encoded credentials (sometimes easier for Render):

1. **Encode the credentials**
   ```bash
   # On Windows PowerShell:
   [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes('{"type": "service_account",...}'))
   ```

2. **Set in Render**
   - Delete `GCS_CREDENTIALS` variable
   - Add `GCS_CREDENTIALS_BASE64` variable
   - Paste the base64-encoded string

3. **Redeploy**

## Need Help?

If you're stuck:
1. Check the Render deployment logs for specific errors
2. Verify the environment variable is saved correctly
3. Make sure the JSON is valid (no extra quotes or escaping)
4. Try redeploying manually if auto-deploy didn't trigger
