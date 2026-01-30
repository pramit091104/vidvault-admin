import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Video, 
  Eye, 
  Calendar,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Upload
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { 
  getVideosByApprovalStatus, 
  GCSVideoRecord 
} from "@/integrations/firebase/videoService";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

interface ApprovalStatusVideosProps {
  status: 'draft' | 'pending_review' | 'needs_changes' | 'approved' | 'completed';
  title: string;
  description: string;
  icon: React.ReactNode;
  emptyMessage: string;
}

export const ApprovalStatusVideos = ({ 
  status, 
  title, 
  description, 
  icon, 
  emptyMessage 
}: ApprovalStatusVideosProps) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<GCSVideoRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchVideos = async () => {
    if (!currentUser) return;
    
    try {
      setIsLoading(true);
      const statusVideos = await getVideosByApprovalStatus(currentUser.uid, status);
      setVideos(statusVideos);
    } catch (error) {
      console.error(`Error fetching ${status} videos:`, error);
      toast.error(`Failed to load ${status} videos`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, [currentUser, status]);

  const getStatusBadge = (videoStatus: string) => {
    switch (videoStatus) {
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

  const handleVideoClick = (video: GCSVideoRecord) => {
    if (video.publicSlug) {
      navigate(`/watch/${video.publicSlug}`);
    } else {
      navigate(`/watch/${video.id}`);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
          {videos.length > 0 && (
            <Badge variant="outline" className="ml-auto">
              {videos.length}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {videos.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {videos.map((video) => (
              <div
                key={video.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleVideoClick(video)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Video className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{video.title}</h4>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {video.viewCount || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDistanceToNow(video.uploadedAt, { addSuffix: true })}
                      </span>
                      {video.version && video.version > 1 && (
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          v{video.version}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Client: {video.clientName}
                    </p>
                    {video.revisionNotes && status === 'needs_changes' && (
                      <p className="text-xs text-orange-700 mt-1 bg-orange-50 p-2 rounded border border-orange-200">
                        <strong>Revision Notes:</strong> {video.revisionNotes}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {getStatusBadge(video.approvalStatus || 'draft')}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};