import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Crown, IndianRupee, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createPaymentRecord, updatePaymentStatus } from "@/integrations/firebase/paymentService";
import { saveSubscription } from "@/integrations/firebase/subscriptionService";
import { apiService } from "@/services/apiService";
import { loadRazorpay } from "@/lib/loadRazorpay";
import { useAuth } from "@/contexts/AuthContext";

interface PremiumPaymentModalProps {
  children: React.ReactNode;
}

export const PremiumPaymentModal = ({ children }: PremiumPaymentModalProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { currentUser, upgradeSubscription } = useAuth();

  const handlePayment = async () => {
    if (!currentUser) {
      toast.error('Please sign in to upgrade');
      return;
    }

    setIsProcessing(true);
    
    try {
      // Create payment record
      const paymentId = await createPaymentRecord({
        userId: currentUser.uid,
        type: 'video_completion',
        amount: 149,
        status: 'pending',
        notes: {
          subscription_type: 'premium',
          user_email: currentUser.email || '',
          user_name: currentUser.displayName || ''
        }
      });

      // Create order through our API
      const order = await apiService.createOrder({
        amount: 149 * 100, // Convert to paise
        currency: 'INR',
        receipt: `premium_${paymentId}`,
        notes: {
          subscription_type: 'premium',
          user_id: currentUser.uid,
          payment_id: paymentId
        }
      });

      // Load Razorpay
      const razorpay = await loadRazorpay();
      if (!razorpay) {
        throw new Error('Failed to load payment gateway');
      }

      // Configure payment options
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'Previu',
        description: 'Premium Subscription - ₹149/month',
        order_id: order.id,
        handler: async (response: any) => {
          try {
            // Verify payment
            const verification = await apiService.verifyPayment({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature
            });

            if (verification.isValid) {
              // Update payment status
              await updatePaymentStatus(paymentId, {
                status: 'completed',
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                completedAt: new Date()
              });

              // Save premium subscription to Firestore
              await saveSubscription({
                userId: currentUser.uid,
                tier: 'premium',
                videoUploadsUsed: 0, // Reset upload count for new premium subscription
                maxVideoUploads: 50,
                clientsUsed: 0, // Reset client count for new premium subscription
                maxClients: 50,
                maxFileSize: 500,
                subscriptionDate: new Date(),
                expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                paymentId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                status: 'active'
              });

              // Upgrade user subscription in context
              await upgradeSubscription();
              
              toast.success('Payment successful! Welcome to Premium!');
              setIsOpen(false);
            } else {
              throw new Error('Payment verification failed');
            }
          } catch (error) {
            console.error('Payment verification error:', error);
            await updatePaymentStatus(paymentId, { status: 'failed' });
            toast.error('Payment verification failed. Please contact support.');
          }
        },
        prefill: {
          name: currentUser.displayName || '',
          email: currentUser.email || '',
        },
        theme: {
          color: '#8B5CF6'
        },
        modal: {
          ondismiss: () => {
            updatePaymentStatus(paymentId, { status: 'cancelled' });
            setIsProcessing(false);
          }
        }
      };

      // Open Razorpay checkout
      const rzp = new razorpay(options);
      rzp.open();

    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Payment failed. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-purple-500" />
            Upgrade to Premium
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Pricing Display */}
          <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-2">
              <IndianRupee className="h-8 w-8 text-purple-500" />
              <span className="text-4xl font-bold">149</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <p className="text-sm text-muted-foreground">Billed monthly, cancel anytime</p>
          </div>

          {/* Features List */}
          <div className="space-y-3">
            <h4 className="font-semibold">Premium Features:</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-purple-500" />
                <span className="text-sm">Up to 50 video drafts per month</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-purple-500" />
                <span className="text-sm">Up to 50 clients</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-purple-500" />
                <span className="text-sm">500MB file size limit</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-purple-500" />
                <span className="text-sm">Priority video processing</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-purple-500" />
                <span className="text-sm">Advanced timestamp comments</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-purple-500" />
                <span className="text-sm">Real-time notifications</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-purple-500" />
                <span className="text-sm">Priority support</span>
              </div>
            </div>
          </div>

          {/* Payment Button */}
          <Button
            onClick={handlePayment}
            disabled={isProcessing}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Crown className="mr-2 h-4 w-4" />
                Pay ₹149 & Upgrade Now
              </>
            )}
          </Button>

          {/* Security Note */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Secure payment powered by Razorpay
            </p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                SSL Encrypted
              </Badge>
              <Badge variant="outline" className="text-xs">
                PCI Compliant
              </Badge>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};