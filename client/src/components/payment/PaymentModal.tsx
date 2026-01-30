// In PaymentModal.tsx, replace the entire file with:

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CreditCard, IndianRupee, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { createPaymentRecord, updatePaymentStatus } from "@/integrations/firebase/paymentService";
import { apiService } from "@/services/apiService";
import { loadRazorpay } from "@/lib/loadRazorpay";

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

      // Create order through our API
      const order = await apiService.createOrder({
        amount: amount * 100, // Convert to paise
        currency: 'INR',
        receipt: `payment_${paymentId}`,
        notes: {
          client_id: client.id,
          client_name: client.clientName,
          payment_type: paymentType,
          payment_id: paymentId
        }
      });

      // Update payment record with order ID
      await updatePaymentStatus(paymentId, 'processing', {
        razorpayOrderId: order.id
      });

      // Load Razorpay checkout script
      const Razorpay = await loadRazorpay();
      if (!Razorpay) {
        throw new Error('Failed to load payment gateway');
      }

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
            // Verify payment through our API
            const { isValid } = await apiService.verifyPayment({
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

      const rzp = new Razorpay(options);
      rzp.open();

    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Payment failed. Please try again.');
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
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedPayment === option.type ? 'border-primary ring-2 ring-primary/20' : 'hover:bg-accent/50'
                  }`}
                  onClick={() => {
                    setSelectedPayment(option.type);
                    setCustomAmount(option.amount > 0 ? option.amount.toString() : '');
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{option.label}</h4>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                    <Badge 
                      variant={status === 'paid' ? 'success' : 'outline'}
                      className={`${status === 'paid' ? 'bg-green-100 text-green-800' : ''}`}
                    >
                      {status === 'paid' ? 'Paid' : 'Pending'}
                    </Badge>
                  </div>
                  {status === 'pending' && (
                    <div className="mt-3">
                      <Label htmlFor={`amount-${option.type}`} className="text-sm font-medium">
                        Amount (INR)
                      </Label>
                      <Input
                        id={`amount-${option.type}`}
                        type="number"
                        value={selectedPayment === option.type ? customAmount : ''}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        placeholder="Enter amount"
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedPayment && customAmount) {
                  handlePayment(selectedPayment, parseFloat(customAmount));
                }
              }}
              disabled={!selectedPayment || !customAmount || isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Proceed to Pay'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};