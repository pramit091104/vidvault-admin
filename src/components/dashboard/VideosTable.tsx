import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Film, Trash2, ExternalLink, Loader2, RefreshCw, AlertCircle, X, Copy, Globe, Link2, Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { gcsService } from "@/integrations/gcs/gcsService";
import { getAllVideosForUser } from "@/integrations/firebase/videoService";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteVideo, toggleVideoPublicAccess } from "@/integrations/firebase/videoService";
import { fixInvalidVideoSlugs } from "@/lib/fixVideoSlugs";
import '@/lib/quickSlugFix'; // This will make fixTrueSlug available globally
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/integrations/firebase/config";
import TimestampedComments from "./TimestampedComments";
import { logger } from '../../lib/logger';

const VideosTable = () => {
  const [videos, setVideos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("videos");
  
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [gcsVideos, setGcsVideos] = useState<any[]>([]);
  const [isLoadingGcs, setIsLoadingGcs] = useState(false);
  const [allVideos, setAllVideos] = useState<any[]>([]);

  const fetchAllVideos = async () => {
    if (!currentUser) return;
    
    try {
      setIsLoading(true);
      const videos = await getAllVideosForUser(currentUser.uid);
      setAllVideos(videos);
    } catch (error: any) {
      logger.error('Error fetching all videos:', error);
      toast.error('Failed to fetch videos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePublicAccess = async (video: any) => {
    try {
      let newPublicStatus = !video.isPublic;
      let slugToUse = video.publicSlug;
      
      // If making public and no slug exists, generate one
      if (newPublicStatus && !slugToUse) {
        const { generateVideoSlug } = await import('@/lib/slugGenerator');
        slugToUse = generateVideoSlug(video.clientName, video.title);
        
        // Update the video record with the new slug
        await toggleVideoPublicAccess(
          video.id,
          newPublicStatus,
          slugToUse
        );
        
        // Update local state with both public status and slug
        setAllVideos(prev => prev.map(v => 
          v.id === video.id 
            ? { ...v, isPublic: newPublicStatus, publicSlug: slugToUse }
            : v
        ));
        
        // Copy public URL to clipboard
        const publicUrl = `${window.location.origin}/watch/${slugToUse}`;
        navigator.clipboard.writeText(publicUrl);
        
        toast.success('Video is now public! Public URL copied to clipboard.');
        return;
      }
      
      // Normal toggle for existing slugs
      await toggleVideoPublicAccess(
        video.id,
        newPublicStatus,
        slugToUse
      );
      
      setAllVideos(prev => prev.map(v => 
        v.id === video.id 
          ? { ...v, isPublic: newPublicStatus }
          : v
      ));
      
      toast.success(`Video is now ${newPublicStatus ? 'public' : 'private'}`);
    } catch (error: any) {
      logger.error('Error toggling public access:', error);
      toast.error('Failed to update public access');
    }
  };

  const copyPublicUrl = (video: any) => {
    if (!video.publicSlug) {
      const errorMsg = 'Video URL not available';
      logger.error(errorMsg, { videoId: video.id });
      toast.error(errorMsg);
      return;
    }
    
    const publicUrl = `${window.location.origin}/watch/${video.publicSlug}`;
    navigator.clipboard.writeText(publicUrl);
    toast.success('Public URL copied to clipboard!');
  };

  // Admin utility function to fix invalid slugs
  const handleFixSlugs = async () => {
    try {
      toast.info('Fixing invalid video slugs...');
      await fixInvalidVideoSlugs();
      toast.success('Video slugs fixed! Please refresh the page.');
      // Refresh the videos list
      fetchAllVideos();
    } catch (error: any) {
      console.error('Error fixing slugs:', error);
      toast.error('Failed to fix slugs: ' + error.message);
    }
  };

  // Make the fix function available globally for debugging
  useEffect(() => {
    (window as any).fixVideoSlugs = handleFixSlugs;
    return () => {
      delete (window as any).fixVideoSlugs;
    };
  }, []);

  useEffect(() => {
    fetchAllVideos();

    // Listen for video upload events to refresh the list
    const handleVideoUploaded = () => {
      fetchGcsVideos();
      fetchAllVideos();
    };
    window.addEventListener("gcs-video-uploaded", handleVideoUploaded);
    
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    
    return () => {
      window.removeEventListener("gcs-video-uploaded", handleVideoUploaded);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchGcsVideos();
      fetchAllVideos();
    }
  }, [currentUser]);

  const handleRefresh = () => {
    fetchGcsVideos();
  };

  const fetchGcsVideos = async () => {
    if (!currentUser) {
      console.log('No current user, skipping GCS videos fetch');
      setGcsVideos([]);
      return;
    }
    try {
      setIsLoadingGcs(true);
      const all = await getAllVideosForUser(currentUser.uid, 100);
      
      const gcs = all.filter((v: any) => {
        return v.service === 'gcs';
      });
      setGcsVideos(gcs);
    } catch (err: any) {
      logger.error('Error fetching GCS videos:', err);
      console.error('Error details:', err.message, err.code);
    } finally {
      setIsLoadingGcs(false);
    }
  };

  const handleDeleteVideo = async (videoId: string, service: 'gcs') => {
    if (!currentUser) return;
    
    if (window.confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      try {
        await deleteVideo(videoId, service);
        await fetchGcsVideos();
        toast.success('Video deleted successfully');
      } catch (error) {
        logger.error('Error deleting video', error);
        toast.error('Failed to delete video');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleDeleteGcs = async (record: any) => {
    const videoId = record.id;
    setDeletingVideoId(videoId || null);
    try {
      // Delete file from GCS
      if (record.fileName) {
        // Pass both fileName and gcsPath (if available) for better file resolution
        const gcsPath = record.gcsPath || record.publicUrl;
        await gcsService.deleteFile(record.fileName, gcsPath);
      }

      // Delete video record in Firestore
      if (videoId) {
        await deleteVideo(videoId, 'gcs');
      }

      toast.success(`Video "${record.title || record.fileName}" deleted successfully`);
      await fetchGcsVideos();
    } catch (error: any) {
      logger.error('Error deleting GCS video:', error);
      toast.error(error.message || 'Failed to delete GCS video');
    } finally {
      setDeletingVideoId(null);
    }
  };

  return (
    <Card className="border-border/50 bg-card/95">
      <CardHeader>
      <div className="flex items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            Manage Videos
          </CardTitle>
          <CardDescription>
            View and manage uploaded videos from Google Cloud Storage
          </CardDescription>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>
    </CardHeader>
      <CardContent>
        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsContent value="videos" className="space-y-4">
            {isLoadingGcs ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-16 w-28 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/50">
                        <TableHead>File Name</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Upload Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gcsVideos.map((video, index) => (
                        <TableRow key={video.id || video.securityCode || `gcs-${index}`} className="hover:bg-secondary/30">
                          <TableCell>
                            <p className="font-mono text-sm max-w-[100px] truncate" title={video.fileName}>
                              {video.fileName?.length > 15 ? video.fileName.substring(0, 15) + '...' : video.fileName}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium line-clamp-1">{video.title || 'Untitled'}</p>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {video.uploadedAt ? 
                                (video.uploadedAt.seconds ? 
                                  new Date(video.uploadedAt.seconds * 1000).toLocaleDateString() : 
                                  new Date(video.uploadedAt).toLocaleDateString()
                                ) : 
                                'N/A'
                              }
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {video.isPublic && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => copyPublicUrl(video)}
                                  title="Copy public URL"
                                >
                                  <Link2 className="h-4 w-4" />
                                  <span className="sr-only">Copy public URL</span>
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleTogglePublicAccess(video)}
                                title={video.isPublic ? 'Make private' : 'Make public'}
                              >
                                <Globe className={`h-4 w-4 ${video.isPublic ? 'text-blue-600' : 'text-muted-foreground'}`} />
                                <span className="sr-only">Toggle public access</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  if (!video.publicUrl) {
                                    const errorMsg = 'Video URL not available';
                                    logger.error(errorMsg, { videoId: video.id });
                                    toast.error(errorMsg);
                                    return;
                                  }
                                  const opened = window.open(video.publicUrl, '_blank');
                                  if (!opened) {
                                    toast.error('Could not open video. Please check popup blocker settings.');
                                  }
                                }}
                                disabled={!video.publicUrl}
                                title="View video"
                              >
                                <ExternalLink className="h-4 w-4" />
                                <span className="sr-only">View video</span>
                              </Button>
                              <TimestampedComments 
                                videoId={video.id} 
                                videoTitle={video.title || 'Untitled'}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                disabled={deletingVideoId === video.id}
                                onClick={() => handleDeleteGcs(video)}
                                title="Delete video"
                              >
                                {deletingVideoId === video.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                                <span className="sr-only">Delete video</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {gcsVideos.length === 0 && !error && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Film className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium mb-2">No videos found</p>
                    <p className="text-sm">
                      Upload your first video using the Upload section above
                    </p>
                  </div>
                )}
              </>
            )}
          </TabsContent>
          
          
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default VideosTable;
