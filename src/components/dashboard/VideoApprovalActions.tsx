import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Send, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Upload,
  Loader2 
} from "lucide-react";
import { toast } from "sonner";
import { markVideoForReview } from "@/integrations/firebase/videoService";

interface VideoApprovalActionsProps {
  videoId: string;
  approvalStatus?: string;
  onStatusUpdate?: () => void;
}

export const VideoApprovalActions = ({ 
  videoId, 
  approvalStatus = 'draft',
  onStatusUpdate 
}: VideoApprovalActionsProps) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const getStatusBadge = () => {
    switch (approvalStatus) {
      case 'draft':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Draft</Badge>;
      case 'pending_review':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending Review</Badge>;
      case 'needs_changes':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Needs Changes</Badge>;
      case 'approved':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Approved</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Completed</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getStatusIcon = () => {
    switch (approvalStatus) {
      case 'draft':
        return <Upload className="h-4 w-4" />;
      case 'pending_review':
        return <Clock className="h-4 w-4" />;
      case 'needs_changes':
        return <AlertCircle className="h-4 w-4" />;
      case 'approved':
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const handleMarkForReview = async () => {
    try {
      setIsUpdating(true);
      await markVideoForReview(videoId);
      toast.success("Video marked for client review!");
      onStatusUpdate?.();
    } catch (error) {
      console.error('Error marking video for review:', error);
      toast.error("Failed to mark video for review. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {getStatusIcon()}
        {getStatusBadge()}
      </div>
      
      {approvalStatus === 'draft' && (
        <Button
          onClick={handleMarkForReview}
          disabled={isUpdating}
          size="sm"
          className="h-8 px-3 text-xs"
        >
          {isUpdating ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Send className="h-3 w-3 mr-1" />
          )}
          Send for Review
        </Button>
      )}
      
      {approvalStatus === 'needs_changes' && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs border-orange-200 text-orange-700 hover:bg-orange-50"
          onClick={() => {
            // Navigate to upload section with context for replacing this video
            const uploadUrl = `/dashboard?tab=upload&replaceVideoId=${videoId}`;
            window.location.href = uploadUrl;
          }}
        >
          <Upload className="h-3 w-3 mr-1" />
          Upload New Version
        </Button>
      )}
    </div>
  );
};