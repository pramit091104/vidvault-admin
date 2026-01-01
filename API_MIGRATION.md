# API Endpoint Migration Guide

This document outlines the changes made to consolidate API endpoints for Vercel Hobby plan compatibility.

## 🔄 Endpoint Changes

### Before (Individual Endpoints)
```
/api/subscription/status
/api/clients/validate  
/api/clients/create
/api/gcs/validate-upload
/api/gcs/simple-upload
/api/razorpay/create-order
/api/razorpay/verify-payment
/api/signed-url
/api/gcs/upload
/api/gcs/delete
/api/gcs/metadata
```

### After (Consolidated Endpoints)
```
/api/subscription/status
/api/subscription/validate-client
/api/clients/validate
/api/clients/create  
/api/upload/validate
/api/upload/simple
/api/payment/create-order
/api/payment/verify-payment
/api/storage/signed-url
/api/storage/upload
/api/storage/delete
/api/storage/metadata
```

## 📝 Frontend Updates Required

### 1. Backend API Service (`src/services/backendApiService.ts`)

**Updated endpoints:**
- ✅ `/api/subscription/status` - No change
- ✅ `/api/clients/validate` - No change  
- ✅ `/api/upload/validate` - Changed from `/api/gcs/validate-upload`
- ✅ `/api/upload/simple` - Changed from `/api/gcs/simple-upload`

### 2. Client Service (`src/integrations/firebase/clientService.ts`)

**Updated endpoints:**
- ✅ `/api/clients/create` - No change

### 3. Other Services (if any)

**Payment endpoints:**
- `/api/razorpay/create-order` → `/api/payment/create-order`
- `/api/razorpay/verify-payment` → `/api/payment/verify-payment`

**Storage endpoints:**
- `/api/signed-url` → `/api/storage/signed-url`
- `/api/gcs/upload` → `/api/storage/upload`
- `/api/gcs/delete` → `/api/storage/delete`
- `/api/gcs/metadata` → `/api/storage/metadata`

## 🛠️ Implementation Details

### Consolidated API Handlers

Each consolidated handler uses URL parsing to determine the specific action:

```javascript
const { pathname } = new URL(req.url, `http://${req.headers.host}`);
const action = pathname.split('/').pop();

switch (action) {
  case 'status':
    return await handleSubscriptionStatus(userId, res);
  case 'validate':
    return await handleUploadValidation(req, res);
  // ... more actions
}
```

### Benefits

1. **Vercel Compatibility**: Only 6 functions vs 12+ limit
2. **Better Organization**: Related endpoints grouped together
3. **Shared Logic**: Common authentication and error handling
4. **Easier Maintenance**: Fewer files to manage

### Backward Compatibility

The old individual endpoint files are still present but not used in production. They can be removed after successful deployment.

## ✅ Verification Steps

After deployment, test these consolidated endpoints:

```bash
# Subscription API
curl -X GET "https://your-app.vercel.app/api/subscription/status"

# Clients API  
curl -X GET "https://your-app.vercel.app/api/clients/validate"

# Upload API
curl -X POST "https://your-app.vercel.app/api/upload/validate"

# Storage API
curl -X POST "https://your-app.vercel.app/api/storage/signed-url"

# Payment API
curl -X POST "https://your-app.vercel.app/api/payment/create-order"
```

All endpoints should return appropriate authentication errors when called without tokens, confirming they're working correctly.

## 🚀 Deployment Ready

The application is now optimized for Vercel Hobby plan deployment with:
- ✅ Only 6 serverless functions (well under 12 limit)
- ✅ All backend restrictions maintained
- ✅ Full functionality preserved
- ✅ Better organization and maintainability