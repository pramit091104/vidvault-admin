import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  TrendingUp, 
  Clock, 
  CheckCircle,
  XCircle,
  IndianRupee,
  Calendar
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getPaymentStats, PaymentStats } from "@/services/paymentStatsService";

export const PaymentStatsCard = () => {
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { currentUser } = useAuth();

  useEffect(() => {
    const loadStats = async () => {
      if (!currentUser) return;

      try {
        const paymentStats = await getPaymentStats();
        setStats(paymentStats);
      } catch (error) {
        console.error('Error loading payment stats:', error);
        // Don't show error toast, just fail silently for dashboard
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [currentUser]);

  const formatAmount = (amount: number, currency: string = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short'
    }).format(date);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'pending':
        return <Clock className="h-3 w-3 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-3 w-3 text-red-500" />;
      default:
        return <Clock className="h-3 w-3 text-gray-400" />;
    }
  };

  const getPaymentTypeLabel = (type: string, notes?: any) => {
    if (type === 'video_completion' && notes?.subscription_type === 'premium') {
      return 'Premium';
    }
    
    const typeLabels = {
      pre: 'Pre Payment',
      post: 'Post Payment', 
      final: 'Final Payment',
      video_completion: 'Video Service'
    };
    
    return typeLabels[type as keyof typeof typeLabels] || type;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" />
            Payment Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.totalPayments === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" />
            Payment Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No payments yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" />
            Payment Overview
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {stats.totalPayments} transactions
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Your payment activity and spending
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Key Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <IndianRupee className="h-3 w-3 text-green-600" />
              <span className="text-xs text-muted-foreground">Total Paid</span>
            </div>
            <p className="text-sm font-semibold text-green-700">
              {formatAmount(stats.totalPaid, stats.currency)}
            </p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-blue-600" />
              <span className="text-xs text-muted-foreground">This Month</span>
            </div>
            <p className="text-sm font-semibold text-blue-700">
              {formatAmount(stats.monthlySpending, stats.currency)}
            </p>
          </div>
        </div>

        {/* Status Summary */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-green-500" />
            <span>{stats.completedPayments} completed</span>
          </div>
          {stats.pendingPayments > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-yellow-500" />
              <span>{stats.pendingPayments} pending</span>
            </div>
          )}
          {stats.failedPayments > 0 && (
            <div className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              <span>{stats.failedPayments} failed</span>
            </div>
          )}
        </div>

        {/* Recent Payments */}
        {stats.recentPayments.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground">Recent Payments</h4>
            <div className="space-y-2">
              {stats.recentPayments.slice(0, 3).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(payment.status)}
                    <span className="truncate max-w-[100px]">
                      {getPaymentTypeLabel(payment.type, payment.notes)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {formatAmount(payment.amount, stats.currency)}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDate(payment.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};