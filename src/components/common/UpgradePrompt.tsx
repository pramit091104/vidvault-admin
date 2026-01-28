import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Zap, TrendingUp, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PremiumPaymentModal } from "@/components/payment/PremiumPaymentModal";
import { applicationService } from "@/services";
import { useEffect, useState } from "react";

interface UpgradePromptProps {
  title?: string;
  description?: string;
  reason?: string;
  compact?: boolean;
  className?: string;
  userId?: string; // Optional user ID for subscription validation
}

export const UpgradePrompt = ({ 
  title = "Upgrade to Premium",
  description = "Unlock more features and higher limits",
  reason,
  compact = false,
  className = "",
  userId
}: UpgradePromptProps) => {
  const { subscription, currentUser } = useAuth();
  const [upgradeRecommendations, setUpgradeRecommendations] = useState<{
    shouldUpgrade: boolean;
    currentTier: string;
    recommendedTier: 'premium' | 'enterprise';
    reasons: string[];
    benefits: string[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Get the user ID from props or auth context
  const effectiveUserId = userId || currentUser?.uid;

  // Load upgrade recommendations using application service
  useEffect(() => {
    const loadUpgradeRecommendations = async () => {
      if (!effectiveUserId) return;

      setIsLoading(true);
      try {
        const recommendations = await applicationService.getUpgradeRecommendations(effectiveUserId);
        setUpgradeRecommendations(recommendations);
      } catch (error) {
        console.error('Error loading upgrade recommendations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUpgradeRecommendations();
  }, [effectiveUserId]);

  // Check if user needs upgrade using application service
  const needsUpgrade = upgradeRecommendations?.shouldUpgrade || subscription.tier !== 'premium';

  // Don't show if already premium and no specific upgrade needed
  if (!needsUpgrade && subscription.tier === 'premium') {
    return null;
  }

  if (compact) {
    return (
      <div className={`p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800 text-sm">{title}</p>
              {(reason || upgradeRecommendations?.reasons?.[0]) && (
                <p className="text-xs text-yellow-700">
                  {reason || upgradeRecommendations?.reasons?.[0]}
                </p>
              )}
            </div>
          </div>
          <PremiumPaymentModal>
            <Button size="sm" className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white">
              {isLoading ? "Loading..." : "Upgrade"}
            </Button>
          </PremiumPaymentModal>
        </div>
      </div>
    );
  }

  return (
    <Card className={`border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-yellow-600" />
            <CardTitle className="text-yellow-800">{title}</CardTitle>
          </div>
          <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
            ₹149/month
          </Badge>
        </div>
        <CardDescription className="text-yellow-700">
          {description}
        </CardDescription>
        {(reason || upgradeRecommendations?.reasons?.length > 0) && (
          <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-sm text-yellow-800">
            {reason || upgradeRecommendations?.reasons?.join(', ')}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Premium Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {upgradeRecommendations?.benefits?.map((benefit: string, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm text-yellow-700">
              <TrendingUp className="h-4 w-4 text-yellow-600" />
              <span>{benefit}</span>
            </div>
          )) || (
            <>
              <div className="flex items-center gap-2 text-sm text-yellow-700">
                <TrendingUp className="h-4 w-4 text-yellow-600" />
                <span>50 video uploads/month</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-yellow-700">
                <Shield className="h-4 w-4 text-yellow-600" />
                <span>50 clients</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-yellow-700">
                <Zap className="h-4 w-4 text-yellow-600" />
                <span>500MB file size limit</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-yellow-700">
                <Crown className="h-4 w-4 text-yellow-600" />
                <span>Priority processing</span>
              </div>
            </>
          )}
        </div>

        <PremiumPaymentModal>
          <Button 
            className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white"
            disabled={isLoading}
          >
            <Crown className="h-4 w-4 mr-2" />
            {isLoading ? "Loading..." : `Upgrade to ${upgradeRecommendations?.recommendedTier || 'Premium'} - ₹149/month`}
          </Button>
        </PremiumPaymentModal>
      </CardContent>
    </Card>
  );
};