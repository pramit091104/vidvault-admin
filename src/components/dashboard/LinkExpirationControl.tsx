import { useState } from "react";
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
  { value: "0", label: "Never expires" },
  { value: "1", label: "1 hour" },
  { value: "6", label: "6 hours" },
  { value: "24", label: "24 hours" },
  { value: "72", label: "3 days" },
  { value: "168", label: "1 week" },
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
      return `${days}d remaining`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const handleUpdateExpiration = async () => {
    setIsUpdating(true);
    try {
      const hours = selectedExpiration === "0" ? null : parseInt(selectedExpiration);
      await updateVideoLinkExpiration(video.id, hours);
      
      toast.success(
        hours 
          ? `Link expires in ${hours} hours`
          : "Link will never expire"
      );
      
      onUpdate?.();
    } catch (error) {
      console.error("Error updating link expiration:", error);
      toast.error("Failed to update expiration");
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = () => {
    if (!hasExpiration) {
      return (
        <Badge variant="secondary" className="text-xs">
          <Infinity className="h-3 w-3 mr-1" />
          Never expires
        </Badge>
      );
    }
    
    if (isExpired) {
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Expired
        </Badge>
      );
    }
    
    return (
      <Badge variant="default" className="text-xs">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        {getTimeRemaining()}
      </Badge>
    );
  };

  return (
    <div className="space-y-3">
      {/* Status and Time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Link Expiration</span>
        </div>
        {getStatusBadge()}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <Select value={selectedExpiration} onValueChange={setSelectedExpiration}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXPIRATION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Button 
          onClick={handleUpdateExpiration}
          disabled={isUpdating || selectedExpiration === (video.linkExpirationHours?.toString() || "24")}
          size="sm"
        >
          {isUpdating ? "..." : "Update"}
        </Button>
      </div>
    </div>
  );
};