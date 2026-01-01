# Vercel Deployment Guide (Optimized for Hobby Plan)

This guide explains how to deploy the VidVault Admin application with backend restrictions to Vercel's **Hobby Plan** (12 serverless functions limit).

## ✅ Optimized Architecture

The application has been **optimized to use only 6 serverless functions** to stay well within Vercel's Hobby plan limit:

1. **`/api/subscription`** - Handles subscription status and client validation
2. **`/api/clients`** - Handles client creation and validation  
3. **`/api/upload`** - Handles file upload validation and processing
4. **`/api/storage`** - Handles storage operations (upload, delete, metadata, signed URLs)
5. **`/api/payment`** - Handles Razorpay payment operations
6. **`/api/test`** - Test endpoint

## 🚀 API Endpoint Mapping

### Consolidated Endpoints

**Subscription API (`/api/subscription/*`)**
- `GET /api/subscription/status` - Get user subscription status
- `GET /api/subscription/validate-client` - Validate client creation

**Clients API (`/api/clients/*`)**  
- `GET /api/clients/validate` - Validate client creation
- `POST /api/clients/create` - Create new client with validation

**Upload API (`/api/upload/*`)**
- `POST /api/upload/validate` - Validate file upload
- `POST /api/upload/simple` - Upload file with validation

**Storage API (`/api/storage/*`)**
- `POST /api/storage/upload` - General file upload
- `DELETE /api/storage/delete` - Delete files
- `GET /api/storage/metadata` - Get file metadata  
- `POST /api/storage/signed-url` - Generate signed URLs

**Payment API (`/api/payment/*`)**
- `POST /api/payment/create-order` - Create Razorpay order
- `POST /api/payment/verify-payment` - Verify payment signature

## 🚀 Deployment Steps

### 1. Environment Variables

Set these environment variables in your Vercel project settings:

#### Firebase Configuration (Frontend)
```
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

#### Google Cloud Storage (Backend)
```
GCS_PROJECT_ID=your_project_id
GCS_BUCKET_NAME=your_bucket_name
GCS_CREDENTIALS={"type":"service_account",...} # Full JSON service account key
```

#### Alternative Firebase Admin (if needed)
```
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...} # Same as GCS_CREDENTIALS
```

#### Razorpay (Optional)
```
VITE_RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

#### Upload Configuration
```
VITE_UPLOAD_SIMPLE_MAX_SIZE=104857600
VITE_UPLOAD_RESUMABLE_MAX_SIZE=2147483648
VITE_UPLOAD_CHUNK_SIZE=10485760
```

### 2. Deploy to Vercel

#### Option A: Vercel CLI
```bash
npm install -g vercel
vercel --prod
```

#### Option B: GitHub Integration
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push

### 3. Verify Deployment

After deployment, test these endpoints:

- `GET /api/subscription/status` - Should return auth required
- `GET /api/clients/validate` - Should return auth required  
- `POST /api/gcs/validate-upload` - Should return auth required
- `POST /api/gcs/simple-upload` - Should handle file uploads

## 🔧 Configuration Files

### vercel.json
The `vercel.json` file is already configured with:
- All API endpoints as serverless functions
- Proper routing for SPA (Single Page Application)
- Static build configuration

### package.json
Build script is configured for Vite:
```json
{
  "scripts": {
    "build": "vite build"
  }
}
```

## 🛡️ Security Considerations

### Environment Variables
- Never commit service account keys to git
- Use Vercel's environment variable encryption
- Set different keys for development/production

### CORS Configuration
The API endpoints are configured to allow:
- `https://your-vercel-domain.vercel.app`
- `http://localhost:8080` (development)
- `http://localhost:5173` (development)

Update CORS origins in your API endpoints if needed.

## 📊 Backend Restrictions

All restrictions are enforced server-side:

### Free Tier Limits
- 5 video uploads per month
- 50MB file size limit
- 5 clients maximum

### Premium Tier Limits  
- 50 video uploads per month
- 500MB file size limit
- 50 clients maximum

### Validation Flow
1. User authenticates with Firebase Auth
2. Frontend gets Firebase ID token
3. Backend validates token with Firebase Admin
4. Backend checks user subscription limits
5. Backend enforces restrictions before allowing operations

## 🔍 Troubleshooting

### Common Issues

#### 1. Firebase Admin Initialization Error
- Ensure `GCS_CREDENTIALS` contains valid service account JSON
- Check that the service account has Firestore permissions
- Verify project ID matches in all configurations

#### 2. CORS Errors
- Add your Vercel domain to CORS origins in API endpoints
- Check that credentials are included in frontend requests

#### 3. Upload Failures
- Verify GCS bucket permissions
- Check file size limits in both frontend and backend
- Ensure service account has Storage Admin role

#### 4. Authentication Issues
- Verify Firebase Auth domain matches your Vercel domain
- Check that Firebase ID tokens are being sent correctly
- Ensure Firebase Admin can verify tokens

### Debug Steps

1. **Check Vercel Function Logs**
   ```bash
   vercel logs your-deployment-url
   ```

2. **Test API Endpoints**
   ```bash
   curl -X GET "https://your-app.vercel.app/api/subscription/status"
   ```

3. **Verify Environment Variables**
   - Check Vercel dashboard settings
   - Ensure all required variables are set
   - Test with development values first

## 🚀 Performance Optimization

### Serverless Function Optimization
- Functions are optimized for cold starts
- Firebase Admin is initialized lazily
- Database connections are reused when possible

### Frontend Optimization
- Vite build with tree shaking
- Code splitting for better loading
- Static assets served from Vercel CDN

## 📈 Monitoring

### Vercel Analytics
- Enable Vercel Analytics for performance monitoring
- Monitor function execution times
- Track error rates

### Firebase Monitoring
- Use Firebase Console for authentication metrics
- Monitor Firestore usage and performance
- Set up alerts for quota limits

## 🔄 Updates and Maintenance

### Updating the Application
1. Push changes to your connected repository
2. Vercel automatically deploys
3. Test all functionality after deployment

### Environment Variable Updates
1. Update in Vercel dashboard
2. Redeploy if needed
3. Test with new configuration

## ✅ Deployment Checklist

- [ ] All environment variables set in Vercel
- [ ] Firebase service account has proper permissions
- [ ] GCS bucket configured with correct CORS
- [ ] Razorpay keys configured (if using payments)
- [ ] Test authentication flow
- [ ] Test file upload restrictions
- [ ] Test client creation restrictions
- [ ] Verify subscription status loading
- [ ] Check all API endpoints respond correctly
- [ ] Test both free and premium tier restrictions

Your application is now ready for production deployment on Vercel with full backend restriction enforcement!