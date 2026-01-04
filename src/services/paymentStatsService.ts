import { auth } from '@/integrations/firebase/config';

export interface PaymentStats {
  totalPayments: number;
  completedPayments: number;
  totalPaid: number;
  pendingPayments: number;
  failedPayments: number;
  monthlySpending: number;
  recentPayments: RecentPayment[];
  currency: string;
}

export interface RecentPayment {
  id: string;
  type: string;
  amount: number;
  status: string;
  createdAt: Date;
  clientName?: string;
  notes?: any;
}

/**
 * Get authentication headers for API calls
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

/**
 * Get user payment statistics
 */
export async function getPaymentStats(): Promise<PaymentStats> {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch('/api/payment-stats', {
      method: 'GET',
      headers,
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to get payment stats' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // Convert date strings back to Date objects
    const stats = {
      ...data.stats,
      recentPayments: data.stats.recentPayments.map((payment: any) => ({
        ...payment,
        createdAt: new Date(payment.createdAt)
      }))
    };

    return stats;
  } catch (error) {
    console.error('Error getting payment stats:', error);
    throw error;
  }
}