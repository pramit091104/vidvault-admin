import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CreditCard, IndianRupee, CheckCircle, XCircle, Play, Clock } from "lucide-react";
import { toast } from "sonner";
import { createPaymentRecord, updatePaymentStatus } from "@/integrations/firebase/paymentService";
import { apiService } from "@/services/apiService";
import { loadRazorpay } from "@/lib/loadRazorpay";
import { useAuth } from "@/contexts/AuthContext";

interface VideoPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: {
    id: string;
    slug: string;
    title: string;
    clientName: string;
  };
  paymentAmount: number;
  onPaymentComplete: () => void;
}

export const VideoPaymentModal = ({ 
  isOpen, 
  onClose, 
  video, 
  paymentAmount, 
  onPaymentComplete 
}: VideoPaymentModalProps) => {
  const { currentUser } = useAuth();
  const [customAmount, setCustomAmount] = useState(paymentAmount.toString());
  const [isProcessing, setIsProcessing] = useState(false);
  const [anonymousId] = useState(() => {
    // Generate or retrieve anonymous ID for non-logged users
    const stored = localStorage.getItem('anonymous_user_id');
    if (stored) return stored;
    const newId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('anonymous_user_id', newId);
    return newId;
  });

  useEffect(() => {
    setCustomAmount(paymentAmount.toString());
  }, [paymentAmount]);

  const handlePayment = async () => {
    const amount = parseFloat(customAmount);
    
    if (amount <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    if (amount > 100000) {
      toast.error('Amount cannot exceed ₹1,00,000');
      return;
    }

    setIsProcessing(true);
    
    try {
      // Create payment record
      const paymentId = await createPaymentRecord({
        videoId: video.id,
        videoSlug: video.slug,
        userId: currentUser?.uid,
        anonymousId: currentUser ? undefined : anonymousId,
        type: 'video_completion',
        amount,
        currency: 'INR',
        status: 'pending',
        notes: {
          video_title: video.title,
          client_name: video.clientName,
          payment_trigger: 'video_completion'
        }
      });

      // Create order through our API
      const order = await apiService.createOrder({
        amount: amount * 100, // Convert to paise
        currency: 'INR',
        receipt: `video_${video.slug}_${paymentId}`,
        notes: {
          video_slug: video.slug,
          video_title: video.title,
          payment_id: paymentId,
          user_id: currentUser?.uid || anonymousId
        }
      });

      // Update payment record with order ID
      await updatePaymentStatus(paymentId, 'pending');
      
      // Load Razorpay and open checkout
      const Razorpay = await loadRazorpay();
      
      if (!Razorpay) {
        throw new Error('Failed to load Razorpay. Please check your internet connection.');
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'Video Payment',
        description: `Payment for "${video.title}"`,
        order_id: order.id,
        prefill: {
          name: currentUser?.displayName || 'Guest User',
          email: currentUser?.email || '',
        },
        theme: {
          color: '#000000'
        },
        handler: async function (response: any) {
          try {
            // Verify payment
            const verification = await apiService.verifyPayment({
              orderId: order.id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });

            if (verification.isValid) {
              // Update payment status to completed
              await updatePaymentStatus(paymentId, 'completed', {
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              });

              toast.success('Payment completed successfully!');
              onPaymentComplete();
              onClose();
            } else {
              throw new Error('Payment verification failed');
            }
          } catch (error) {
            console.error('Payment verification error:', error);
            await updatePaymentStatus(paymentId, 'failed');
            toast.error('Payment verification failed. Please contact support.');
          }
        },
        modal: {
          ondismiss: async function() {
            await updatePaymentStatus(paymentId, 'cancelled');
            toast.info('Payment cancelled');
          }
        }
      };

      const rzp = new Razorpay(options);
      rzp.open();

    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Failed to process payment');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Complete Your Payment
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Video Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium text-gray-900">{video.title}</h3>
            <p className="text-sm text-gray-600">by {video.clientName}</p>
            <Badge variant="outline" className="mt-2">
              <Clock className="h-3 w-3 mr-1" />
              Video Completed
            </Badge>
          </div>

          {/* Payment Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Payment Amount</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                id="amount"
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="pl-10"
                placeholder="Enter amount"
                min="1"
                max="100000"
                step="0.01"
              />
            </div>
            <p className="text-xs text-gray-500">
              Amount set by the creator: ₹{paymentAmount}
            </p>
          </div>

          {/* User Info */}
          <div className="text-sm text-gray-600">
            {currentUser ? (
              <p>Paying as: {currentUser.displayName || currentUser.email}</p>
            ) : (
              <p>Paying as guest user</p>
            )}
          </div>

          {/* Payment Button */}
          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePayment}
              disabled={isProcessing || parseFloat(customAmount) <= 0}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pay ₹{parseFloat(customAmount || '0').toFixed(2)}
                </>
              )}
            </Button>
          </div>

          {/* Security Note */}
          <div className="text-xs text-gray-500 text-center">
            <CheckCircle className="h-3 w-3 inline mr-1" />
            Secure payment powered by Razorpay
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};