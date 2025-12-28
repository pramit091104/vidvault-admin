import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  IndianRupee, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  TrendingUp,
  Calendar
} from "lucide-react";

interface Payment {
  id: string;
  type: 'pre' | 'post' | 'final';
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  date?: string;
  transactionId?: string;
}

interface PaymentSummaryProps {
  client: {
    id: string;
    clientName: string;
    prePayment: number;
    paidPayment: number;
    finalPayment: number;
  };
  payments?: Payment[];
}

export const PaymentSummary = ({ client, payments = [] }: PaymentSummaryProps) => {
  const totalAmount = client.prePayment + client.paidPayment + client.finalPayment;
  const paidAmount = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);
  
  const progressPercentage = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

  const getPaymentStatus = (type: 'pre' | 'post' | 'final') => {
    const payment = payments.find(p => p.type === type);
    if (!payment) return 'pending';
    return payment.status;
  };

  const getPaymentAmount = (type: 'pre' | 'post' | 'final') => {
    const payment = payments.find(p => p.type === type && p.status === 'completed');
    return payment?.amount || 0;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const paymentBreakdown = [
    {
      type: 'pre' as const,
      label: 'Pre-Payment',
      expected: client.prePayment,
      paid: getPaymentAmount('pre'),
      status: getPaymentStatus('pre'),
      description: 'Initial deposit'
    },
    {
      type: 'post' as const,
      label: 'Post-Payment',
      expected: client.paidPayment,
      paid: getPaymentAmount('post'),
      status: getPaymentStatus('post'),
      description: 'Progress payment'
    },
    {
      type: 'final' as const,
      label: 'Final Payment',
      expected: client.finalPayment,
      paid: getPaymentAmount('final'),
      status: getPaymentStatus('final'),
      description: 'Completion payment'
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IndianRupee className="h-5 w-5" />
          Payment Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Payment Progress</span>
            <span className="font-medium">
              ₹{paidAmount.toLocaleString('en-IN')} / ₹{totalAmount.toLocaleString('en-IN')}
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{progressPercentage.toFixed(1)}% Complete</span>
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {paidAmount > 0 ? 'Active' : 'Pending'}
            </span>
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Payment Breakdown</h4>
          <div className="space-y-2">
            {paymentBreakdown.map((payment) => (
              <div
                key={payment.type}
                className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 dark:bg-gray-900"
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{payment.label}</span>
                    <span className="text-xs text-gray-500">{payment.description}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-mono text-sm">
                      ₹{payment.paid.toLocaleString('en-IN')} / ₹{payment.expected.toLocaleString('en-IN')}
                    </div>
                    {payment.paid > 0 && payment.paid < payment.expected && (
                      <div className="text-xs text-orange-600">
                        ₹{(payment.expected - payment.paid).toLocaleString('en-IN')} pending
                      </div>
                    )}
                  </div>
                  
                  <Badge className={getStatusColor(payment.status)}>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(payment.status)}
                      <span className="text-xs capitalize">{payment.status}</span>
                    </div>
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        {payments.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Recent Transactions</h4>
            <div className="space-y-2">
              {payments
                .filter(p => p.status === 'completed')
                .slice(0, 3)
                .map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-900"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      <span className="text-sm capitalize">{payment.type} Payment</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar className="h-3 w-3" />
                      {payment.date}
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
