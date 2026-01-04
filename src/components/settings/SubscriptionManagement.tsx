import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Crown, 
  Check, 
  X, 
  Calendar,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  CreditCard
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PremiumPaymentModal } from "@/components/payment/PremiumPaymentModal";
import { toast } from "sonner";

export const SubscriptionManagement = () => {
  const { subscription, currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const isPremium = subscription.tier === 'premium';
  
  const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  };

  const getDaysRemaining = () => {
    if (!subscription.expiryDate) return null;
    const now = new Date();
    const expiry = new Date(subscription.expiryDate);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysRemaining = getDaysRemaining();
  const isExpiringSoon = daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0;
  const isExpired = daysRemaining !== null && daysRemaining <= 0;

  const handleCancelSubscription = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to cancel your premium subscription? You'll lose access to premium features at the end of your current billing period."
    );
    
    if (!confirmed) return;

    setIsLoading(true);
    try {
      // TODO: Implement subscription cancellation API call
      toast.info("Subscription cancellation is not yet implemented. Please contact support.");
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast.error('Failed to cancel subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const planFeatures = {
    free: [
      { feature: "Video uploads per month", free: "5", premium: "50" },
      { feature: "Client management", free: "5 clients", premium: "50 clients" },
      { feature: "Max file size", free: "50MB", premium: "500MB" },
      { feature: "Video compression", free: "Basic", premium: "Advanced" },
      { feature: "Priority processing", free: false, premium: true },
      { feature: "Advanced analytics", free: false, premium: true },
      { feature: "Custom branding", free: false, premium: true },
      { feature: "Email support", free: "Community", premium: "Priority" }
    ]
  };

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className={`h-5 w-5 ${isPremium ? 'text-yellow-500' : 'text-gray-400'}`} />
              <CardTitle>Current Plan</CardTitle>
            </div>
            <Badge 
              variant={isPremium ? "default" : "secondary"}
              className={isPremium ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-white" : ""}
            >
              {isPremium ? "Premium" : "Free"}
            </Badge>
          </div>
          <CardDescription>
            {isPremium 
              ? "You're currently on the Premium plan with full access to all features"
              : "You're on the Free plan with basic features"
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {isPremium ? (
            <div className="space-y-4">
              {/* Premium Plan Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-yellow-600" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Started</p>
                    <p className="text-sm text-yellow-700">{formatDate(subscription.subscriptionDate)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-yellow-600" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">
                      {isExpired ? "Expired" : "Expires"}
                    </p>
                    <p className="text-sm text-yellow-700">
                      {formatDate(subscription.expiryDate)}
                      {daysRemaining !== null && daysRemaining > 0 && (
                        <span className="ml-1">({daysRemaining} days left)</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Expiry Warning */}
              {(isExpiringSoon || isExpired) && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      {isExpired ? "Subscription Expired" : "Subscription Expiring Soon"}
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      {isExpired 
                        ? "Your premium subscription has expired. Renew now to continue enjoying premium features."
                        : `Your subscription expires in ${daysRemaining} days. Renew to avoid any interruption in service.`
                      }
                    </p>
                    <div className="mt-3">
                      <PremiumPaymentModal>
                        <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Renew Subscription
                        </Button>
                      </PremiumPaymentModal>
                    </div>
                  </div>
                </div>
              )}

              {/* Plan Actions */}
              <div className="flex gap-3 pt-2">
                <PremiumPaymentModal>
                  <Button variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Renew Early
                  </Button>
                </PremiumPaymentModal>
                <Button 
                  variant="outline" 
                  onClick={handleCancelSubscription}
                  disabled={isLoading}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {isLoading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <X className="h-4 w-4 mr-2" />
                  )}
                  Cancel Subscription
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Free Plan Details */}
              <div className="p-4 bg-gray-50 rounded-lg border">
                <p className="text-sm text-gray-600 mb-3">
                  You're currently using the free plan with basic features and limited usage.
                </p>
                <PremiumPaymentModal>
                  <Button className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white">
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade to Premium - ₹149/month
                  </Button>
                </PremiumPaymentModal>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Comparison</CardTitle>
          <CardDescription>
            Compare features between Free and Premium plans
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">Feature</th>
                  <th className="text-center py-3 px-2">
                    <Badge variant="secondary">Free</Badge>
                  </th>
                  <th className="text-center py-3 px-2">
                    <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                      Premium
                    </Badge>
                  </th>
                </tr>
              </thead>
              <tbody>
                {planFeatures.free.map((item, index) => (
                  <tr key={index} className="border-b last:border-b-0">
                    <td className="py-3 px-2 font-medium">{item.feature}</td>
                    <td className="py-3 px-2 text-center">
                      {typeof item.free === 'boolean' ? (
                        item.free ? (
                          <Check className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-red-500 mx-auto" />
                        )
                      ) : (
                        <span className="text-sm">{item.free}</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {typeof item.premium === 'boolean' ? (
                        item.premium ? (
                          <Check className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-red-500 mx-auto" />
                        )
                      ) : (
                        <span className="text-sm font-medium">{item.premium}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!isPremium && (
            <div className="mt-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-5 w-5 text-yellow-600" />
                <h4 className="font-medium text-yellow-800">Ready to upgrade?</h4>
              </div>
              <p className="text-sm text-yellow-700 mb-3">
                Get 10x more uploads, larger file sizes, and priority support for just ₹149/month.
              </p>
              <PremiumPaymentModal>
                <Button size="sm" className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Upgrade Now
                </Button>
              </PremiumPaymentModal>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};