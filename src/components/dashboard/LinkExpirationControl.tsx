import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle, CheckCircle2, Infinity } from "lucide-react";
import { toast } from "sonner";
import { updateVideoLinkExpiration, isVideoLinkExpired, GCSVideoRecord } from "@/integrations/firebase/videoService";

interface LinkExpirationControlProps {
  video: GCSVideoRecord;
  onUpdate?: () => void;
}

const EXPIRATION_OPTIONS = [
  { value: "0", label: "Never expires", icon: Infinity },
  { value: "1", label: "1 hour", icon: Clock },
  { value: "6", label: "6 hours", icon: Clock },
  { value: "24", label: "24 hours", icon: Clock },
  { value: "72", label: "3 days", icon: Clock },
  { value: "168", label: "1 week", icon: Clock },
  { value: "720", label: "30 days", icon: Clock },
];

export const LinkExpirationControl = ({ video, onUpdate }: LinkExpirationControlProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedExpiration, setSelectedExpiration] = useState<string>(
    video.linkExpirationHours?.toString() || "24"
  );

  const isExpired = isVideoLinkExpired(video);
  const hasExpiration = video.linkExpiresAt && video.linkExpirationHours;

  const getTimeRemaining = () => {
    if (!video.linkExpiresAt) return null;
    
    const now = new Date();
    const expiry = new Date(video.linkExpiresAt);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''} remaining`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  };

  const handleUpdateExpiration = async () => {
    setIsUpdating(true);
    try {
      const hours = selectedExpiration === "0" ? null : parseInt(selectedExpiration);
      await updateVideoLinkExpiration(video.id, hours);
      
      toast.success(
        hours 
          ? `Link expiration updated to ${hours} hours`
          : "Link expiration removed - link will never expire"
      );
      
      onUpdate?.();
    } catch (error) {
      console.error("Error updating link expiration:", error);
      toast.error("Failed to update link expiration");
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = () => {
    if (!hasExpiration) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Infinity className="h-3 w-3" />
          Never expires
        </Badge>
      );
    }
    
    if (isExpired) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Expired
        </Badge>
      );
    }
    
    return (
      <Badge variant="default" className="flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Active
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Link Expiration Control
        </CardTitle>
        <CardDescription>
          Control how long the preview link remains accessible
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Current Status:</span>
          {getStatusBadge()}
        </div>

        {/* Time Remaining */}
        {hasExpiration && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Time Remaining:</span>
            <span className={`text-sm ${isExpired ? 'text-destructive' : 'text-muted-foreground'}`}>
              {getTimeRemaining()}
            </span>
          </div>
        )}

        {/* Expiration Settings */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Set Expiration:</label>
          <Select value={selectedExpiration} onValueChange={setSelectedExpiration}>
            <SelectTrigger>
              <SelectValue placeholder="Select expiration time" />
            </SelectTrigger>
            <SelectContent>
              {EXPIRATION_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {option.label}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Update Button */}
        <Button 
          onClick={handleUpdateExpiration}
          disabled={isUpdating || selectedExpiration === (video.linkExpirationHours?.toString() || "24")}
          className="w-full"
        >
          {isUpdating ? "Updating..." : "Update Expiration"}
        </Button>

        {/* Info */}
        <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
          <p className="font-medium mb-1">How it works:</p>
          <ul className="space-y-1">
            <li>• Expired links will show an error message to viewers</li>
            <li>• You can extend or remove expiration at any time</li>
            <li>• Links without expiration remain accessible indefinitely</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};