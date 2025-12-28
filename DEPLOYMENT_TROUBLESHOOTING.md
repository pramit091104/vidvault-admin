# Deployment Troubleshooting Guide

## Issue: 404 Error on Payment API Endpoints After Deployment

### Problem Description
After deploying to Vercel, the payment API endpoints (`/api/razorpay/create-order` and `/api/razorpay/verify-payment`) are returning 404 errors, causing payment functionality to fail.

### Root Cause Analysis
The issue is likely one of the following:

1. **Vercel Routing Configuration**: The `vercel.json` routing rules may not be correctly mapping requests to the serverless functions
2. **CORS Configuration**: The deployed domain may not be included in the allowed origins list
3. **Environment Variables**: Required Razorpay environment variables may not be set in the Vercel deployment
4. **Build Configuration**: The serverless functions may not be building correctly

### Troubleshooting Steps

#### Step 1: Test API Endpoint Availability
First, test if the API endpoints are accessible at all:

```bash
# Test the test endpoint (should return 200)
curl -X GET https://your-deployment-url.vercel.app/api/test

# Test the Razorpay create-order endpoint (should return 405 for GET, but not 404)
curl -X GET https://your-deployment-url.vercel.app/api/razorpay/create-order
```

#### Step 2: Check Vercel Function Logs
1. Go to your Vercel dashboard
2. Navigate to your project
3. Click on "Functions" tab
4. Check the logs for any errors during function execution

#### Step 3: Verify Environment Variables
Ensure these environment variables are set in Vercel:

**Required Variables:**
- `RAZORPAY_KEY_ID` - Your Razorpay key ID
- `RAZORPAY_KEY_SECRET` - Your Razorpay key secret
- `VITE_RAZORPAY_KEY_ID` - Frontend Razorpay key (for checkout)

**To set environment variables in Vercel:**
1. Go to Project Settings
2. Navigate to "Environment Variables"
3. Add the required variables for Production, Preview, and Development

#### Step 4: Test CORS Configuration
The serverless functions now include flexible CORS configuration that should allow:
- `https://previu.online`
- `https://www.previu.online`
- Any `*.vercel.app` domain (for preview deployments)
- Local development domains

#### Step 5: Verify Vercel Configuration
The `vercel.json` file has been updated to properly route requests:

```json
{
  "routes": [
    {
      "src": "/api/razorpay/create-order",
      "dest": "/api/razorpay/create-order.js"
    },
    {
      "src": "/api/razorpay/verify-payment", 
      "dest": "/api/razorpay/verify-payment.js"
    }
  ]
}
```

### Quick Fixes Applied

1. **Updated Vercel Configuration**: Fixed routing to properly map API endpoints to serverless functions
2. **Enhanced CORS**: Added support for all Vercel deployment domains (`*.vercel.app`)
3. **Added Logging**: Enhanced error logging to help debug issues
4. **Created Test Endpoint**: Added `/api/test` endpoint to verify basic functionality

### Testing the Fix

After redeployment, test the following:

1. **Test Endpoint**: `GET /api/test` should return success response
2. **Create Order**: `POST /api/razorpay/create-order` with valid payload should work
3. **Verify Payment**: `POST /api/razorpay/verify-payment` with valid payload should work

### Sample Test Requests

```javascript
// Test create order
fetch('/api/razorpay/create-order', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: 10000, // 100 INR in paise
    currency: 'INR',
    receipt: 'test_receipt_123'
  })
});

// Test verify payment
fetch('/api/razorpay/verify-payment', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    orderId: 'order_test123',
    paymentId: 'pay_test123', 
    signature: 'test_signature'
  })
});
```

### If Issues Persist

1. **Check Vercel Function Logs**: Look for specific error messages
2. **Verify Environment Variables**: Ensure all required variables are set
3. **Test Locally**: Ensure the serverless functions work in local development
4. **Contact Support**: If all else fails, check Vercel documentation or contact support

### Environment Variable Checklist

- [ ] `RAZORPAY_KEY_ID` is set and not a placeholder value
- [ ] `RAZORPAY_KEY_SECRET` is set and not a placeholder value  
- [ ] `VITE_RAZORPAY_KEY_ID` is set for frontend
- [ ] Variables are set for Production environment in Vercel
- [ ] Variables are not using example/placeholder values

### Success Indicators

✅ `/api/test` returns 200 with success message
✅ `/api/razorpay/create-order` accepts POST requests (not 404)
✅ `/api/razorpay/verify-payment` accepts POST requests (not 404)
✅ Payment flow works end-to-end in production
✅ No CORS errors in browser console
✅ Vercel function logs show successful execution