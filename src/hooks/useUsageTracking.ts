import { useAuth } from "@/contexts/AuthContext";
import { useMemo } from "react";

export interface UsageStatus {
  canUploadVideo: boolean;
  canAddClient: boolean;
  videoUsagePercent: number;
  clientUsagePercent: number;
  isNearVideoLimit: boolean;
  isNearClientLimit: boolean;
  isVideoLimitReached: boolean;
  isClientLimitReached: boolean;
  daysUntilExpiry: number | null;
  isExpiringSoon: boolean;
  isExpired: boolean;
  upgradeReasons: string[];
}

export const useUsageTracking = (): UsageStatus => {
  const { subscription, canUploadVideo, canAddClient } = useAuth();

  return useMemo(() => {
    const videoUsagePercent = (subscription.videoUploadsUsed / subscription.maxVideoUploads) * 100;
    const clientUsagePercent = (subscription.clientsUsed / subscription.maxClients) * 100;
    
    const isNearVideoLimit = videoUsagePercent >= 80;
    const isNearClientLimit = clientUsagePercent >= 80;
    const isVideoLimitReached = videoUsagePercent >= 100;
    const isClientLimitReached = clientUsagePercent >= 100;

    // Calculate days until expiry
    let daysUntilExpiry: number | null = null;
    let isExpiringSoon = false;
    let isExpired = false;

    if (subscription.expiryDate) {
      const now = new Date();
      const expiry = new Date(subscription.expiryDate);
      const diffTime = expiry.getTime() - now.getTime();
      daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      isExpiringSoon = daysUntilExpiry <= 7 && daysUntilExpiry > 0;
      isExpired = daysUntilExpiry <= 0;
    }

    // Generate upgrade reasons
    const upgradeReasons: string[] = [];
    
    if (subscription.tier === 'free') {
      if (isVideoLimitReached) {
        upgradeReasons.push("You've reached your monthly video upload limit");
      } else if (isNearVideoLimit) {
        upgradeReasons.push("You're approaching your video upload limit");
      }

      if (isClientLimitReached) {
        upgradeReasons.push("You've reached your client limit");
      } else if (isNearClientLimit) {
        upgradeReasons.push("You're approaching your client limit");
      }

      if (upgradeReasons.length === 0) {
        upgradeReasons.push("Get 10x more uploads and clients with Premium");
      }
    } else if (subscription.tier === 'premium') {
      if (isExpired) {
        upgradeReasons.push("Your premium subscription has expired");
      } else if (isExpiringSoon) {
        upgradeReasons.push(`Your subscription expires in ${daysUntilExpiry} days`);
      }
    }

    return {
      canUploadVideo: canUploadVideo(),
      canAddClient: canAddClient(),
      videoUsagePercent,
      clientUsagePercent,
      isNearVideoLimit,
      isNearClientLimit,
      isVideoLimitReached,
      isClientLimitReached,
      daysUntilExpiry,
      isExpiringSoon,
      isExpired,
      upgradeReasons
    };
  }, [subscription, canUploadVideo, canAddClient]);
};