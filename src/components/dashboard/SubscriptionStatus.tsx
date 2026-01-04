import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PremiumPaymentModal } from "@/components/payment/PremiumPaymentModal";

export const SubscriptionStatus = () => {
  const { subscription } = useAuth();

  const isPremium = subscription.tier === 'premium';

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