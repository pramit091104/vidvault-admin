import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CreditCard, IndianRupee, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { razorpayService, PaymentRequest } from "@/integrations/razorpay/razorpayService";
import { createPaymentRecord, updatePaymentStatus } from "@/integrations/firebase/paymentService";

interface PaymentModalProps {
  client: {
    id: string;
    clientName: string;
    prePayment: number;
    paidPayment: number;
    finalPayment: number;
  };
  onPaymentComplete: (paymentType: 'pre' | 'post' | 'final', amount: number) => void;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const PaymentModal = ({ client, onPaymentComplete }: PaymentModalProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<'pre' | 'post' | 'final' | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const paymentOptions = [
    {
      type: 'pre' as const,
      label: 'Pre-Payment',
      amount: client.prePayment,
      color: 'bg-blue-500',
      description: 'Initial deposit to start work'
    },
    {
      type: 'post' as const,
      label: 'Post-Payment',
      amount: client.paidPayment,
      color: 'bg-green-500',
      description: 'Payment during project progress'
    },
    {
      type: 'final' as const,
      label: 'Final Payment',
      amount: client.finalPayment,
      color: 'bg-purple-500',
      description: 'Final payment after completion'
    }
  ];

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async (paymentType: 'pre' | 'post' | 'final', amount: number) => {
    if (amount <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    setIsProcessing(true);
    
    try {
      // Create payment record
      const paymentId = await createPaymentRecord({
        clientId: client.id,
        clientName: client.clientName,
        type: paymentType,
        amount,
        status: 'pending',
        notes: {
          payment_type: paymentType,
          client_name: client.clientName
        }
      });

      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Failed to load payment gateway');
      }

      // Create order
      const order = await razorpayService.createOrder({
        amount: amount * 100, // Convert to paise
        currency: 'INR',
        receipt: `payment_${paymentId}`,
        notes: {
          client_id: client.id,
          client_name: client.clientName,
          payment_type: paymentType,
          payment_id: paymentId
        },
        customer: {
          name: client.clientName,
          email: `${client.clientName.replace(/\s+/g, '').toLowerCase()}@example.com`
        }
      });

      // Update payment record with order ID
      await updatePaymentStatus(paymentId, 'processing', {
        razorpayOrderId: order.id
      });

      // Open Razorpay checkout
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'VidVault Admin',
        description: `${paymentType.charAt(0).toUpperCase() + paymentType.slice(1)} payment for ${client.clientName}`,
        order_id: order.id,
        handler: async (response: any) => {
          try {
            // Verify payment
            const isValid = razorpayService.verifyPayment({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature
            });

            if (isValid) {
              // Update payment record as completed
              await updatePaymentStatus(paymentId, 'completed', {
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature
              });

              toast.success('Payment successful!');
              onPaymentComplete(paymentType, amount);
              setIsOpen(false);
            } else {
              // Update payment record as failed
              await updatePaymentStatus(paymentId, 'failed');
              toast.error('Payment verification failed');
            }
          } catch (error) {
            console.error('Error updating payment status:', error);
            toast.error('Payment processed but status update failed');
          }
        },
        prefill: {
          name: client.clientName,
        },
        theme: {
          color: '#6366f1'
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getPaymentStatus = (type: 'pre' | 'post' | 'final') => {
    const amounts = { pre: client.prePayment, post: client.paidPayment, final: client.finalPayment };
    return amounts[type] > 0 ? 'paid' : 'pending';
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CreditCard className="h-4 w-4" />
          Process Payment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5" />
            Process Payment for {client.clientName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid gap-3">
            {paymentOptions.map((option) => {
              const status = getPaymentStatus(option.type);
              return (
                <div
                  key={option.type}
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    selectedPayment === option.type
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedPayment(option.type)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${option.color}`} />
                      <div>
                        <h4 className="font-semibold">{option.label}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {option.description}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">
                        ₹{option.amount.toLocaleString('en-IN')}
                      </div>
                      <Badge
                        variant={status === 'paid' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {status === 'paid' ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Paid
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 mr-1" />
                            Pending
                          </>
                        )}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedPayment && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="custom-amount">Custom Amount (Optional)</Label>
                <Input
                  id="custom-amount"
                  type="number"
                  placeholder="Enter custom amount"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <Button
                onClick={() => {
                  const amount = customAmount ? parseFloat(customAmount) : 
                    paymentOptions.find(p => p.type === selectedPayment)?.amount || 0;
                  handlePayment(selectedPayment, amount);
                }}
                disabled={isProcessing}
                className="w-full"
              >
                {isProcessing ? 'Processing...' : `Pay ₹${customAmount || 
                  paymentOptions.find(p => p.type === selectedPayment)?.amount.toLocaleString('en-IN')}`}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
