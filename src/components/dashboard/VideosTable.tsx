import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Film, Trash2, ExternalLink, Youtube, Loader2, RefreshCw, AlertCircle, X, Shield, Key, Copy } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { youtubeService } from "@/integrations/youtube/youtubeService";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { CommentsDialog } from "./CommentsDialog";
import { createAndSaveSecurityCode } from "@/integrations/firebase/securityCodeService";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/integrations/firebase/config";

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  youtubeId: string;
  uploadDate: string;
  status: string;
  privacyStatus: string;
  thumbnailUrl?: string;
}

const VideosTable = () => {
  // Only YouTube is supported now
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [isCommentsDialogOpen, setIsCommentsDialogOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSecurityCodeDialogOpen, setIsSecurityCodeDialogOpen] = useState(false);
  const [selectedVideoForCode, setSelectedVideoForCode] = useState<YouTubeVideo | null>(null);
  const [clientName, setClientName] = useState("");
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [generatedSecurityCode, setGeneratedSecurityCode] = useState<string>("");

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await youtubeService.authenticate();
      setIsAuthenticated(true);
      await fetchVideos(false);
    } catch (error: any) {
      console.error('Error signing in:', error);
      setError(error.message || 'Failed to sign in with YouTube');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVideos = async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      // Check if authenticated
      const isAuth = await youtubeService.isAuthenticated();
      setIsAuthenticated(isAuth);
      
      if (!isAuth) {
        setError("Please sign in with YouTube to view your videos.");
        return;
      }
      const fetchedVideos = await youtubeService.getMyVideos(50);
      setVideos(fetchedVideos);
    } catch (err: any) {
      console.error("Error fetching videos:", err);
      setError(err.message || "Failed to load videos");
      
      if (err.message?.includes("Token missing read permissions") || 
          err.message?.includes("insufficient authentication scopes") ||
          err.message?.includes("Insufficient Permission")) {
        toast.error(
          "Please sign in again to grant permission to view videos. The app needs access to read your YouTube channel.",
          {
            duration: 8000,
            action: {
              label: "Sign In",
              onClick: async () => {
                try {
                  await youtubeService.authenticate();
                  await fetchVideos(false);
                } catch (authError: any) {
                  toast.error(authError.message || "Authentication failed");
                }
              },
            },
          }
        );
      } else if (err.message?.includes("Authentication required") || err.message?.includes("Token missing")) {
        toast.error("Please authenticate with YouTube to view videos. The app needs permission to read your YouTube channel.", {
          duration: 6000,
        });
      } else if (err.message?.includes("No YouTube channel") || err.message?.includes("youtubeSignupRequired")) {
        toast.error("No YouTube channel found. Please create a YouTube channel first.");
      } else {
        toast.error(err.message || "Failed to load videos from YouTube");
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVideos();
    // Listen for video upload events to refresh the list
    const handleVideoUploaded = () => {
      fetchVideos(false);
    };
    window.addEventListener("youtube-video-uploaded", handleVideoUploaded);
    
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    
    return () => {
      window.removeEventListener("youtube-video-uploaded", handleVideoUploaded);
      unsubscribe();
    };
  }, []);

  const handleRefresh = () => {
    fetchVideos(false);
  };

  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);

  const handleDelete = async (videoId: string, videoTitle: string) => {
    // Use a confirmation dialog from the UI library if available, otherwise use window.confirm
    const confirmed = window.confirm(`Are you sure you want to delete "${videoTitle}"? This action cannot be undone.`);
    
    if (!confirmed) return;

    setDeletingVideoId(videoId);
    
    try {
      await youtubeService.deleteVideo(videoId);
      
      // Remove the deleted video from the local state to avoid another API call
      setVideos(prevVideos => prevVideos.filter(video => video.id !== videoId));
      
      toast.success('Video deleted successfully');
    } catch (error: any) {
      console.error('Error deleting video:', error);
      
      // Handle specific error cases
      if (error.message?.includes('insufficient authentication scopes')) {
        toast.error('Insufficient permissions. Please sign in again with delete permissions.');
      } else if (error.message?.includes('Authentication required')) {
        toast.error('Please sign in again to perform this action.');
      } else {
        toast.error(error.message || 'Failed to delete video');
      }
      
      // Refresh the video list to ensure consistency
      fetchVideos(false);
    } finally {
      setDeletingVideoId(null);
    }
  };

  const handleGenerateSecurityCode = (video: YouTubeVideo) => {
    setSelectedVideoForCode(video);
    setClientName("");
    setGeneratedSecurityCode("");
    setIsSecurityCodeDialogOpen(true);
  };

  const handleCreateSecurityCode = async () => {
    if (!selectedVideoForCode || !clientName.trim() || !currentUser) {
      toast.error('Please enter a client name and ensure you are logged in');
      return;
    }

    setIsGeneratingCode(true);
    try {
      const securityCodeRecord = await createAndSaveSecurityCode(
        selectedVideoForCode.title,
        clientName.trim(),
        selectedVideoForCode.youtubeId,
        selectedVideoForCode.videoUrl,
        currentUser.uid
      );
      
      setGeneratedSecurityCode(securityCodeRecord.securityCode);
      toast.success('Security code generated successfully!');
      
      // Reset form after success
      setTimeout(() => {
        setIsSecurityCodeDialogOpen(false);
        setSelectedVideoForCode(null);
        setClientName("");
        setGeneratedSecurityCode("");
      }, 2000);
    } catch (error: any) {
      console.error('Error generating security code:', error);
      toast.error(error.message || 'Failed to generate security code');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const copySecurityCode = () => {
    if (generatedSecurityCode) {
      navigator.clipboard.writeText(generatedSecurityCode);
      toast.success('Security code copied to clipboard!');
    }
  };

  return (
    <Card className="border-border/50 bg-card/95 backdrop-blur-sm">
      <CardHeader>
      <div className="flex items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            Manage YouTube Videos
          </CardTitle>
          <CardDescription>
            View and manage all videos from your YouTube account
          </CardDescription>
        </div>
        <div className="flex gap-2 items-center">
          {!isAuthenticated ? (
            <Button
              variant="default"
              size="sm"
              onClick={handleSignIn}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Youtube className="h-4 w-4 mr-2" />
              Sign In with YouTube
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading || isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          )}
        </div>
      </div>
    </CardHeader>
      <CardContent>
        {!isAuthenticated && !error && (
          <div className="mb-6 p-6 text-center bg-muted/30 rounded-lg border border-border">
            <Youtube className="h-12 w-12 mx-auto mb-4 text-red-600" />
            <h3 className="text-lg font-medium mb-2">Connect Your YouTube Account</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Sign in with YouTube to view and manage your videos. You'll be able to see all your uploaded videos and their details.
            </p>
            <Button 
              onClick={handleSignIn} 
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Youtube className="h-5 w-5 mr-2" />
              {isLoading ? 'Signing In...' : 'Sign In with YouTube'}
            </Button>
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-start gap-2 text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium">{error}</p>
                {error.includes("Token missing read permissions") || error.includes("insufficient authentication scopes") ? (
                  <div className="space-y-2">
                    <p className="text-xs text-destructive/80">
                      Your current authentication only has permission to upload videos. To view videos, you need to sign in again with additional permissions.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          // Clear old token
                          localStorage.removeItem("youtube_access_token");
                          // Re-authenticate with new scopes
                          await youtubeService.authenticate();
                          // Refresh videos
                          await fetchVideos(false);
                        } catch (authError: any) {
                          toast.error(authError.message || "Authentication failed");
                        }
                      }}
                    >
                      Sign In with Full Permissions
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
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
                    <TableHead>Video</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Upload Date</TableHead>
                    <TableHead>Privacy</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.map((video) => (
                    <TableRow key={video.id} className="hover:bg-secondary/30">
                      <TableCell>
                        {video.thumbnailUrl ? (
                          <img
                            src={video.thumbnailUrl}
                            alt={video.title}
                            className="w-24 h-16 object-cover rounded"
                          />
                        ) : (
                          <div className="w-24 h-16 bg-secondary rounded flex items-center justify-center">
                            <Film className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          <p className="font-medium line-clamp-2">{video.title}</p>
                          {video.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                              {video.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{video.uploadDate}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            video.privacyStatus === "public"
                              ? "bg-green-500/10 text-green-600 border-green-500/20"
                              : video.privacyStatus === "unlisted"
                              ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                              : "bg-gray-500/10 text-gray-600 border-gray-500/20"
                          }
                        >
                          {video.privacyStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-primary/10 text-primary border-primary/20">
                          {video.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setSelectedVideoId(video.youtubeId);
                              setIsCommentsDialogOpen(true);
                            }}
                            title="View comments"
                          >
                            <MessageSquare className="h-4 w-4" />
                            <span className="sr-only">View comments</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(video.videoUrl, "_blank")}
                            title="Open in YouTube"
                          >
                            <ExternalLink className="h-4 w-4" />
                            <span className="sr-only">Open in YouTube</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleGenerateSecurityCode(video)}
                            title="Generate security code"
                            disabled={!currentUser}
                          >
                            <Shield className="h-4 w-4" />
                            <span className="sr-only">Generate security code</span>
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 min-w-[32px]"
                          onClick={() => handleDelete(video.id, video.title)}
                          disabled={!!deletingVideoId}
                          title="Delete video"
                        >
                          {deletingVideoId === video.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          <span className="sr-only">Delete video</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {videos.length === 0 && !error && (
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
      </CardContent>
      
      {/* Comments Dialog */}
      {selectedVideoId && (
        <Dialog open={isCommentsDialogOpen} onOpenChange={setIsCommentsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <DialogHeader>
                <DialogTitle>Comments</DialogTitle>
              </DialogHeader>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsCommentsDialogOpen(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
            
            <div className="flex-1 overflow-hidden">
              <CommentsDialog 
                videoId={selectedVideoId} 
                open={isCommentsDialogOpen} 
                onOpenChange={setIsCommentsDialogOpen} 
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Security Code Generation Dialog */}
      {selectedVideoForCode && (
        <Dialog open={isSecurityCodeDialogOpen} onOpenChange={setIsSecurityCodeDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Generate Security Code
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Video</Label>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium text-sm">{selectedVideoForCode.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Uploaded: {selectedVideoForCode.uploadDate}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="clientName">Client Name *</Label>
                <Input
                  id="clientName"
                  placeholder="Enter client name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  disabled={isGeneratingCode || !!generatedSecurityCode}
                />
              </div>
              
              {generatedSecurityCode && (
                <div className="space-y-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <h4 className="text-sm font-medium text-green-800 dark:text-green-200">
                      Security Code Generated
                    </h4>
                  </div>
                  <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-green-300 dark:border-green-700 rounded-md px-3 py-2">
                    <code className="text-lg font-mono text-green-700 dark:text-green-300">
                      {generatedSecurityCode}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copySecurityCode}
                      className="ml-2 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    This code has been saved to Firebase and can be shared with the client.
                  </p>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsSecurityCodeDialogOpen(false);
                    setSelectedVideoForCode(null);
                    setClientName("");
                    setGeneratedSecurityCode("");
                  }}
                  disabled={isGeneratingCode}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateSecurityCode}
                  disabled={!clientName.trim() || isGeneratingCode || !!generatedSecurityCode || !currentUser}
                  className="flex-1"
                >
                  {isGeneratingCode ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : generatedSecurityCode ? (
                    <>
                      <Key className="mr-2 h-4 w-4" />
                      Code Generated
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      Generate Code
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};

export default VideosTable;
