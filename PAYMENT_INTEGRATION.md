# Payment Integration on Watch Page

## Overview
This implementation adds payment functionality to the watch page that triggers when a user finishes watching a video. The payment amount is configurable by the video creator through their dashboard.

## Features

### 1. Video Completion Detection
- Monitors video playback progress using `timeupdate` and `ended` events
- Triggers payment modal when video reaches within 5 seconds of completion
- Prevents multiple payment prompts for the same video session

### 2. Payment Modal Integration
- Custom `VideoPaymentModal` component specifically designed for watch page
- Supports both authenticated and anonymous users
- Uses Razorpay for secure payment processing
- Displays video information and creator details

### 3. Payment Amount Configuration
- Video creators can set payment amounts in the **Dashboard > Clients** section
- Uses the `finalPayment` amount from the client record as the default
- Falls back to ₹100 if no amount is configured
- Users can modify the amount before payment (within limits)

### 4. Payment Tracking
- Stores payment records in Firebase `payments` collection
- Prevents duplicate payments for the same video
- Supports both user ID and anonymous ID tracking
- Links payments to specific videos and clients

## How It Works

### For Video Creators:
1. Go to **Dashboard > Clients**
2. Edit a client record by clicking the edit button
3. Set the `Final Payment` amount (this will be used for video completion payments)
4. Save the changes
5. When users watch videos associated with this client, they'll be prompted to pay the set amount

### For Video Viewers:
1. Watch any public video to completion
2. Payment modal automatically appears when video ends
3. Choose to pay the suggested amount or modify it
4. Complete payment through Razorpay
5. Payment is recorded and won't be prompted again for the same video

## Technical Implementation

### Files Created/Modified:

1. **`src/integrations/firebase/paymentService.ts`**
   - Firebase service for payment record management
   - Functions for creating, updating, and querying payments
   - Payment status tracking and duplicate prevention

2. **`src/components/payment/VideoPaymentModal.tsx`**
   - Specialized payment modal for video completion
   - Integrates with existing Razorpay infrastructure
   - Handles both authenticated and anonymous users

3. **`src/pages/Watch.tsx`** (Modified)
   - Added video completion detection logic
   - Integrated payment modal trigger
   - Added payment status checking
   - Client payment amount loading

4. **`src/integrations/firebase/clientService.ts`** (Modified)
   - Added `getClientByName` function for payment amount lookup

### Database Collections:

#### `payments` Collection:
```typescript
{
  id: string;
  clientId?: string;
  clientName?: string;
  videoId?: string;
  videoSlug?: string;
  userId?: string;           // For authenticated users
  anonymousId?: string;      // For guest users
  type: 'video_completion';
  amount: number;
  currency: 'INR';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  notes?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}
```

## Configuration

### Environment Variables Required:
- `VITE_RAZORPAY_KEY_ID` - Frontend Razorpay key
- `RAZORPAY_KEY_SECRET` - Backend Razorpay secret

### Default Settings:
- Default payment amount: ₹100 (if not configured)
- Payment trigger: 5 seconds before video end + video end event
- Maximum payment amount: ₹1,00,000
- Minimum payment amount: ₹1

## Usage Examples

### Setting Payment Amount:
1. Navigate to Dashboard > Clients
2. Find the client associated with your videos
3. Click edit button (pencil icon)
4. Set "Final Payment" to desired amount (e.g., ₹500)
5. Click save button (checkmark icon)

### Testing Payment Flow:
1. Upload a video and make it public
2. Set a payment amount for the associated client
3. Open the public video link in incognito mode
4. Watch the video to completion
5. Payment modal should appear automatically

## Security Features

- Payment verification through server-side signature validation
- Anonymous user tracking without personal data storage
- Secure Razorpay integration with proper error handling
- Duplicate payment prevention
- Input validation and sanitization

## Future Enhancements

Potential improvements that could be added:
- Multiple payment tiers (basic, premium, etc.)
- Subscription-based payments
- Payment analytics dashboard
- Bulk payment processing
- Payment reminders
- Refund functionality
- Payment receipts via email