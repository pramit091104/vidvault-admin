import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Crown, IndianRupee } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PremiumPaymentModal } from "@/components/payment/PremiumPaymentModal";
import { useNavigate } from "react-router-dom";

interface PricingCardProps {
  showFree?: boolean;
  compact?: boolean;
}

export const PricingCard = ({ showFree = true, compact = false }: PricingCardProps) => {
  const { subscription } = useAuth();
  const navigate = useNavigate();

  if (compact && subscription.tier === 'premium') {
    return (
      <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-purple-500" />
              <span className="font-semibold text-purple-700 dark:text-purple-300">Premium Active</span>
            </div>
            <Badge className="bg-purple-500 hover:bg-purple-600">
              {subscription.videoUploadsUsed}/{subscription.maxVideoUploads} uploads
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
      {showFree && (
        <Card className={subscription.tier === 'free' ? 'border-blue-200 bg-blue-50/50 dark:bg-blue-900/10' : ''}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Free</CardTitle>
              {subscription.tier === 'free' && (
                <Badge variant="outline">Current Plan</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold">₹0</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <CardDescription>Perfect for getting started</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Up to 5 video uploads</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Up to 5 clients</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">50MB file size limit</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Basic timestamp comments</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Secure client access</span>
              </div>
            </div>
            
            {subscription.tier !== 'free' && (
              <Button 
                onClick={() => navigate("/auth")}
                variant="outline" 
                className="w-full"
              >
                Get Started Free
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card className={`relative ${subscription.tier === 'premium' ? 'border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20' : 'border-purple-200'}`}>
        {subscription.tier !== 'premium' && (
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
            <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1">
              <Crown className="h-3 w-3 mr-1" />
              MOST POPULAR
            </Badge>
          </div>
        )}
        
        <CardHeader className="pt-6">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-purple-500" />
              Premium
            </CardTitle>
            {subscription.tier === 'premium' && (
              <Badge className="bg-purple-500 text-white">Current Plan</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <IndianRupee className="h-6 w-6 text-purple-500" />
            <span className="text-3xl font-bold">149</span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <CardDescription>Everything you need to scale</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-4 w-4 text-purple-500" />
              <span className="text-sm">Up to 50 video drafts</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-4 w-4 text-purple-500" />
              <span className="text-sm">Up to 50 clients</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-4 w-4 text-purple-500" />
              <span className="text-sm">500MB file size limit</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-4 w-4 text-purple-500" />
              <span className="text-sm">Advanced timestamp comments</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-4 w-4 text-purple-500" />
              <span className="text-sm">Priority video processing</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-4 w-4 text-purple-500" />
              <span className="text-sm">Real-time notifications</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-4 w-4 text-purple-500" />
              <span className="text-sm">Priority support</span>
            </div>
          </div>
          
          {subscription.tier === 'premium' ? (
            <Button className="w-full bg-purple-500 hover:bg-purple-600" disabled>
              <Crown className="mr-2 h-4 w-4" />
              Active Plan
            </Button>
          ) : (
            <PremiumPaymentModal>
              <Button 
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
              >
                <Crown className="mr-2 h-4 w-4" />
                Upgrade to Premium
              </Button>
            </PremiumPaymentModal>
          )}
        </CardContent>
      </Card>
    </div>
  );
};