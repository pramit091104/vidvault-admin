import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Video, 
  Clock, 
  Eye, 
  Share2, 
  Trash2, 
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Infinity,
  Settings
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { 
  getAllVideosForUser, 
  deleteVideo, 
  GCSVideoRecord, 
  isVideoLinkExpired 
} from "@/integrations/firebase/videoService";
import { LinkExpirationControl } from "./LinkExpirationControl";
import { formatDistanceToNow } from "date-fns";

export const VideosManagement = () => {
  const { currentUser } = useAuth();
  const [videos, setVideos] = useState<GCSVideoRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<GCSVideoRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const fetchVideos = async () => {
    if (!currentUser) return;
    
    try {
      setIsLoading(true);
      const userVideos = await getAllVideosForUser(currentUser.uid);
      setVideos(userVideos as GCSVideoRecord[]);
    } catch (error) {
      console.error("Error fetching videos:", error);
      toast.error("Failed to load videos");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, [currentUser]);

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm("Are you sure you want to delete this video? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(videoId);
    try {
      await deleteVideo(videoId);
      toast.success("Video deleted successfully");
      await fetchVideos(); // Refresh the list
    } catch (error) {
      console.error("Error deleting video:", error);
      toast.error("Failed to delete video");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleShareVideo = (video: GCSVideoRecord) => {
    const shareUrl = `${window.location.origin}/watch/${video.id}`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied to clipboard!");
    } else {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      toast.success("Share link copied to clipboard!");
    }
  };

  const getExpirationStatus = (video: GCSVideoRecord) => {
    if (!video.linkExpiresAt) {
      return {
        status: "never",
        badge: (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Infinity className="h-3 w-3" />
            Never expires
          </Badge>
        ),
        timeText: "No expiration set"
      };
    }

    const isExpired = isVideoLinkExpired(video);
    
    if (isExpired) {
      return {
        status: "expired",
        badge: (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Expired
          </Badge>
        ),
        timeText: `Expired ${formatDistanceToNow(video.linkExpiresAt)} ago`
      };
    }

    return {
      status: "active",
      badge: (
        <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Active
        </Badge>
      ),
      timeText: `Expires ${formatDistanceToNow(video.linkExpiresAt, { addSuffix: true })}`
    };
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">Loading videos...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (videos.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No videos uploaded yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Upload your first video to get started
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Your Videos ({videos.length})
          </CardTitle>
          <CardDescription>
            Manage your uploaded videos and control link expiration settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {videos.map((video) => {
              const expirationStatus = getExpirationStatus(video);
              
              return (
                <div key={video.id} className="border rounded-lg p-4 space-y-3">
                  {/* Video Info */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium">{video.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        Client: {video.clientName}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(video.uploadedAt, { addSuffix: true })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {video.viewCount || 0} views
                        </span>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedVideo(selectedVideo?.id === video.id ? null : video)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleShareVideo(video)}
                        disabled={isVideoLinkExpired(video)}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteVideo(video.id)}
                        disabled={isDeleting === video.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Expiration Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {expirationStatus.timeText}
                      </span>
                    </div>
                    {expirationStatus.badge}
                  </div>

                  {/* Expiration Control (Expanded) */}
                  {selectedVideo?.id === video.id && (
                    <>
                      <Separator />
                      <LinkExpirationControl 
                        video={video} 
                        onUpdate={() => {
                          fetchVideos();
                          setSelectedVideo(null);
                        }}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VideosManagement;