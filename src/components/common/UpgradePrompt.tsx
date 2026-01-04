import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Zap, TrendingUp, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PremiumPaymentModal } from "@/components/payment/PremiumPaymentModal";

interface UpgradePromptProps {
  title?: string;
  description?: string;
  reason?: string;
  compact?: boolean;
  className?: string;
}

export const UpgradePrompt = ({ 
  title = "Upgrade to Premium",
  description = "Unlock more features and higher limits",
  reason,
  compact = false,
  className = ""
}: UpgradePromptProps) => {
  const { subscription } = useAuth();

  // Don't show if already premium
  if (subscription.tier === 'premium') {
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
              {reason && (
                <p className="text-xs text-yellow-700">{reason}</p>
              )}
            </div>
          </div>
          <PremiumPaymentModal>
            <Button size="sm" className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white">
              Upgrade
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
        {reason && (
          <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-sm text-yellow-800">
            {reason}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Premium Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
        </div>

        <PremiumPaymentModal>
          <Button className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white">
            <Crown className="h-4 w-4 mr-2" />
            Upgrade to Premium - ₹149/month
          </Button>
        </PremiumPaymentModal>
      </CardContent>
    </Card>
  );
};