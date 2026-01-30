import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PremiumPaymentModal } from "@/components/payment/PremiumPaymentModal";
import { applicationService } from "@/services";
import { useEffect, useState } from "react";
import { SubscriptionStatus as SubscriptionStatusType } from "@/types/subscription";

export const SubscriptionStatus = () => {
  const { subscription, currentUser } = useAuth();
  const [cachedSubscription, setCachedSubscription] = useState<SubscriptionStatusType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSubscriptionData = async () => {
      if (!currentUser?.uid) {
        setIsLoading(false);
        return;
      }

      try {
        // Use the application service to get subscription status
        const subscriptionData = await applicationService.getSubscriptionStatus(currentUser.uid);
        if (subscriptionData) {
          setCachedSubscription(subscriptionData);
        } else {
          // Fallback to auth context subscription if application service fails
          if (subscription) {
            const fallbackData: SubscriptionStatusType = {
              isActive: subscription.tier === 'premium',
              tier: subscription.tier,
              expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
              uploadCount: 0, // Would be fetched from backend
              features: subscription.tier === 'premium' 
                ? ['basic_upload', 'basic_sharing', 'advanced_analytics', 'priority_support']
                : ['basic_upload', 'basic_sharing'],
              maxUploads: subscription.tier === 'premium' ? 50 : 5,
              maxClients: subscription.tier === 'premium' ? 50 : 5,
              maxFileSize: subscription.tier === 'premium' ? 500 : 100,
              clientsUsed: 0, // Would be fetched from backend
              status: subscription.tier === 'premium' ? 'active' : 'active'
            };
            setCachedSubscription(fallbackData);
          }
        }
      } catch (error) {
        console.error('Error loading subscription data:', error);
        // Fallback to auth context on error
        if (subscription) {
          const fallbackData: SubscriptionStatusType = {
            isActive: subscription.tier === 'premium',
            tier: subscription.tier,
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            uploadCount: 0,
            features: subscription.tier === 'premium' 
              ? ['basic_upload', 'basic_sharing', 'advanced_analytics', 'priority_support']
              : ['basic_upload', 'basic_sharing'],
            maxUploads: subscription.tier === 'premium' ? 50 : 5,
            maxClients: subscription.tier === 'premium' ? 50 : 5,
            maxFileSize: subscription.tier === 'premium' ? 500 : 100,
            clientsUsed: 0,
            status: subscription.tier === 'premium' ? 'active' : 'active'
          };
          setCachedSubscription(fallbackData);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadSubscriptionData();
  }, [currentUser?.uid, subscription]);

  // Use cached subscription data if available, otherwise fall back to auth context
  const currentSubscription = cachedSubscription || subscription;
  const isPremium = currentSubscription?.tier === 'premium';

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-gray-400 animate-pulse" />
              <CardTitle className="text-lg">Loading...</CardTitle>
            </div>
            <Badge variant="secondary" className="animate-pulse">
              ...
            </Badge>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className={`h-5 w-5 ${isPremium ? 'text-yellow-500' : 'text-gray-400'}`} />
            <CardTitle className="text-lg">Subscription Status</CardTitle>
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
            ? "You're enjoying all premium features" 
            : "Upgrade to unlock more features and higher limits"
          }
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Upgrade Button for Free Users */}
        {!isPremium && (
          <div>
            <PremiumPaymentModal>
              <Button className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white">
                <Crown className="h-4 w-4 mr-2" />
                Upgrade to Premium - ₹149/month
              </Button>
            </PremiumPaymentModal>
          </div>
        )}

        {/* Premium Status Message */}
        {isPremium && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-green-600" />
              <h4 className="font-medium text-sm text-green-800">Premium Active</h4>
            </div>
            <p className="text-xs text-green-700 mt-1">
              You have access to all premium features and higher limits.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};