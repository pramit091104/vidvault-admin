import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { HardDrive, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getAllVideosForUser } from "@/integrations/firebase/videoService";
import { applicationService } from "@/services";

interface StorageUsageProps {
  compact?: boolean;
}

export const StorageUsage = ({ compact = false }: StorageUsageProps) => {
  const [totalStorage, setTotalStorage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [usageStats, setUsageStats] = useState<{
    uploadCount: number;
    maxUploads: number;
    clientsUsed: number;
    maxClients: number;
    tier: string;
    isActive: boolean;
  } | null>(null);
  const { currentUser, subscription } = useAuth();

  useEffect(() => {
    const fetchStorageData = async () => {
      if (!currentUser?.uid) return;
      
      try {
        setIsLoading(true);
        
        // Load usage stats from application service
        const stats = await applicationService.getUserUsageStats(currentUser.uid);
        setUsageStats(stats);
        
        // Get videos to calculate actual storage used
        const videos = await getAllVideosForUser(currentUser.uid);
        
        // Calculate total storage used
        const totalUsed = videos.reduce((total, video) => {
          return total + (video.size || 0);
        }, 0);
        
        setTotalStorage(totalUsed);
      } catch (error) {
        console.error('Error fetching storage data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStorageData();
  }, [currentUser]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Calculate storage limit based on subscription using application service data
  // For display purposes - actual limits are enforced per file upload
  const currentTier = usageStats?.tier || subscription.tier;
  const storageLimit = currentTier === 'premium' ? 10 * 1024 * 1024 * 1024 : 1 * 1024 * 1024 * 1024; // 10GB vs 1GB
  const usagePercent = (totalStorage / storageLimit) * 100;
  const isNearLimit = usagePercent >= 80;

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
        <HardDrive className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Storage Used</span>
            <span>{formatFileSize(totalStorage)}</span>
          </div>
          <Progress value={Math.min(usagePercent, 100)} className="h-1 mt-1" />
        </div>
        {isNearLimit && (
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <HardDrive className="h-4 w-4" />
          Storage Usage
        </CardTitle>
        <CardDescription className="text-xs">
          Total video storage across all uploads
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-2 bg-gray-200 rounded animate-pulse"></div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Used</span>
              <span className="font-medium">{formatFileSize(totalStorage)}</span>
            </div>
            
            <Progress value={Math.min(usagePercent, 100)} className="h-2" />
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>0 B</span>
              <span>{formatFileSize(storageLimit)} limit</span>
            </div>

            {isNearLimit && (
              <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                <AlertTriangle className="h-3 w-3" />
                <span>Approaching storage limit</span>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              {currentTier === 'free' 
                ? 'Upgrade to Premium for more storage'
                : 'Premium storage limit'
              }
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};