import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  CreditCard, 
  Download, 
  RefreshCw, 
  Calendar,
  IndianRupee,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Receipt
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getUserPayments } from "@/integrations/firebase/paymentService";

interface PaymentRecord {
  id: string;
  type: 'pre' | 'post' | 'final' | 'video_completion';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  clientName?: string;
  videoId?: string;
  notes?: {
    subscription_type?: string;
    user_email?: string;
    user_name?: string;
  };
  createdAt: Date;
  completedAt?: Date;
}

export const PaymentHistory = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { currentUser } = useAuth();

  const loadPayments = async () => {
    if (!currentUser) return;

    try {
      const userPayments = await getUserPayments(currentUser.uid);
      setPayments(userPayments);
    } catch (error) {
      console.error('Error loading payments:', error);
      toast.error('Failed to load payment history');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [currentUser]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadPayments();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: "default",
      failed: "destructive",
      pending: "secondary",
      cancelled: "outline"
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "outline"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getPaymentTypeLabel = (type: string, notes?: any) => {
    if (type === 'video_completion' && notes?.subscription_type === 'premium') {
      return 'Premium Subscription';
    }
    
    const typeLabels = {
      pre: 'Pre Payment',
      post: 'Post Payment', 
      final: 'Final Payment',
      video_completion: 'Video Service'
    };
    
    return typeLabels[type as keyof typeof typeLabels] || type;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatAmount = (amount: number, currency: string = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0
    }).format(amount);
  };

  const downloadReceipt = (payment: PaymentRecord) => {
    // Generate a simple receipt text
    const receiptContent = `
PAYMENT RECEIPT
===============

Payment ID: ${payment.razorpayPaymentId || payment.id}
Order ID: ${payment.razorpayOrderId || 'N/A'}
Date: ${formatDate(payment.completedAt || payment.createdAt)}
Type: ${getPaymentTypeLabel(payment.type, payment.notes)}
Amount: ${formatAmount(payment.amount, payment.currency)}
Status: ${payment.status.toUpperCase()}
${payment.clientName ? `Client: ${payment.clientName}` : ''}

Thank you for your payment!
Previu - Video Management Platform
    `.trim();

    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${payment.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Receipt downloaded');
  };

  const totalPaid = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <CardTitle>Payment History</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <CardDescription>
          View all your payment transactions and download receipts
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-green-600 font-medium">Total Paid</p>
                <p className="text-lg font-bold text-green-700">
                  {formatAmount(totalPaid)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-blue-600 font-medium">Total Transactions</p>
                <p className="text-lg font-bold text-blue-700">{payments.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-purple-600 font-medium">Successful</p>
                <p className="text-lg font-bold text-purple-700">
                  {payments.filter(p => p.status === 'completed').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Payments Table */}
        {payments.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              No payments yet
            </h3>
            <p className="text-sm text-muted-foreground">
              Your payment history will appear here once you make your first transaction.
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Client/Service</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {formatDate(payment.createdAt)}
                        </span>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <span className="text-sm font-medium">
                        {getPaymentTypeLabel(payment.type, payment.notes)}
                      </span>
                    </TableCell>
                    
                    <TableCell>
                      <span className="font-medium">
                        {formatAmount(payment.amount, payment.currency)}
                      </span>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(payment.status)}
                        {getStatusBadge(payment.status)}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {payment.clientName || 
                         (payment.notes?.subscription_type === 'premium' ? 'Premium Subscription' : 'N/A')}
                      </span>
                    </TableCell>
                    
                    <TableCell>
                      {payment.status === 'completed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadReceipt(payment)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Receipt
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};