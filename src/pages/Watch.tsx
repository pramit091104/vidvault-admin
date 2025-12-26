import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Share2, Eye, Calendar, Moon } from "lucide-react";
import { toast } from "sonner";
import { requestSignedUrl } from '@/integrations/api/signedUrlService';
import { getPublicVideoBySlug, updateVideoViewCount, YouTubeVideoRecord, GCSVideoRecord } from "@/integrations/firebase/videoService";
import { format } from "date-fns";

interface PublicVideo {
  id: string;
  fileName?: string;
  title: string;
  description: string;
  clientName: string;
  videoUrl: string;
  thumbnailUrl?: string;
  slug: string;
  isPublic: boolean;
  uploadedAt: Date;
  viewCount: number;
  service: 'youtube' | 'gcs';
  youtubeVideoId?: string;
  publicUrl?: string;
}

const Watch = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  
  const [video, setVideo] = useState<PublicVideo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedVideoUrl, setSignedVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const fetchVideo = async () => {
      if (!slug) {
        setError("Invalid video URL");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        console.log("Fetching metadata for slug:", slug);
        const videoData = await getPublicVideoBySlug(slug);
        
        if (!videoData || !videoData.isPublic) {
          setError("Video not found or private");
          setIsLoading(false);
          return;
        }

        const mappedVideo: PublicVideo = {
          id: videoData.id,
          title: videoData.title,
          description: videoData.description || '',
          clientName: videoData.clientName,
          videoUrl: videoData.service === 'youtube' 
            ? (videoData as YouTubeVideoRecord).youtubeVideoUrl 
            : (videoData as GCSVideoRecord).publicUrl,
          thumbnailUrl: videoData.service === 'youtube' 
            ? (videoData as YouTubeVideoRecord).thumbnailUrl 
            : undefined,
          slug: videoData.publicSlug || slug,
          isPublic: videoData.isPublic || false,
          uploadedAt: videoData.uploadedAt instanceof Date ? videoData.uploadedAt : new Date(videoData.uploadedAt),
          viewCount: videoData.viewCount || 0,
          service: videoData.service,
          youtubeVideoId: videoData.service === 'youtube' 
            ? (videoData as YouTubeVideoRecord).youtubeVideoId 
            : undefined,
          publicUrl: videoData.service === 'youtube' 
            ? (videoData as YouTubeVideoRecord).publicUrl 
            : (videoData as GCSVideoRecord).publicUrl,
        };
        
        setVideo(mappedVideo);

        // --- SECURE URL LOGIC ---
        if (mappedVideo.service === 'gcs') {
            console.log("Attempting to sign GCS URL for ID:", mappedVideo.id);
            try {
              // Use the stored fileName for signing; fall back to the document id
              const targetId = (videoData as any).fileName || mappedVideo.id;
              const url = await requestSignedUrl(
                targetId,
                'gcs'
              );
              console.log("Signed URL received successfully");
              setSignedVideoUrl(url);
            } catch (err: any) {
              console.error("Signing failed details:", err.message);
              setVideoError("Could not authorize playback.");
              // Fallback to public URL just in case the bucket is actually public
              if (mappedVideo.publicUrl) {
                  console.warn("Falling back to public URL");
                  setSignedVideoUrl(mappedVideo.publicUrl);
              }
            }
        } else {
            setSignedVideoUrl(mappedVideo.videoUrl);
        }

        updateVideoViewCount(slug, mappedVideo.service).catch(console.error);

      } catch (err: any) {
        console.error('Error fetching video:', err);
        setError(err.message || "Failed to load video");
      } finally {
        setIsLoading(false);
      }
    };

    fetchVideo();
  }, [slug]);

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: video?.title, url: shareUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied!");
    }
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const error = e.currentTarget.error;
    console.error("Video Player Error Object:", error);
    if (error?.code === 4) {
      setVideoError("Format not supported or file not found (404).");
    } else if (error?.code === 2) {
      setVideoError("Network error. Check your connection.");
    } else {
      setVideoError("Playback failed.");
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (error || !video) return <div className="min-h-screen flex items-center justify-center p-4"><Card className="w-full max-w-md p-8 text-center"><h2 className="text-xl font-bold mb-2">Unavailable</h2><p className="text-muted-foreground">{error}</p></Card></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/95 backdrop-blur px-4 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <div className="p-2 rounded-lg bg-primary/10"><Moon className="h-6 w-6 text-primary" /></div>
            <h2 className="text-xl font-bold">Previu</h2>
          </div>
          <Button variant="outline" size="sm" onClick={handleShare}><Share2 className="h-4 w-4 mr-2" /> Share</Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-lg flex items-center justify-center">
            {videoError && (
              <div className="absolute inset-0 bg-black/80 z-10 flex flex-col items-center justify-center text-white">
                 <p className="text-red-400 font-semibold mb-2">Playback Error</p>
                 <p className="text-sm text-gray-300">{videoError}</p>
              </div>
            )}
            {video.service === 'youtube' ? (
              <iframe src={`https://www.youtube.com/embed/${video.youtubeVideoId}`} title={video.title} className="w-full h-full" allowFullScreen />
            ) : (
              signedVideoUrl && (
                  <video
                    key={signedVideoUrl}
                    ref={videoRef}
                    controls
                    className="w-full h-full"
                    poster={video.thumbnailUrl}
                    playsInline
                    preload="metadata"
                    crossOrigin="anonymous"
                    onError={handleVideoError}
                  >
                    <source src={signedVideoUrl} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
              )
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">{video.title}</h1>
            <div className="flex gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Eye className="h-4 w-4"/> {video.viewCount} views</span>
                <span className="flex items-center gap-1"><Calendar className="h-4 w-4"/> {format(video.uploadedAt, 'MMM dd, yyyy')}</span>
            </div>
          </div>
          <Card><CardContent className="p-6"><h3 className="font-semibold mb-2">Description</h3><p className="text-muted-foreground whitespace-pre-wrap">{video.description || "No description provided."}</p></CardContent></Card>
        </div>
        <div className="space-y-6">
            <Card><CardContent className="p-6 space-y-4"><h3 className="font-semibold">Details</h3><div><p className="text-xs text-muted-foreground">Client</p><p className="font-medium">{video.clientName}</p></div><div><p className="text-xs text-muted-foreground">Platform</p><Badge variant={video.service === 'youtube' ? 'default' : 'secondary'}>{video.service === 'youtube' ? 'YouTube' : 'Secure Storage'}</Badge></div></CardContent></Card>
        </div>
      </main>
    </div>
  );
};

export default Watch;