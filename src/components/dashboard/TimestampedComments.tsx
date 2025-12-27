import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, AlertCircle, RefreshCw, Copy, Check } from "lucide-react";
import { getVideoTimestampedComments, getVideoCommentsGroupedByUserName, TimestampedComment, clearVideoCommentsCache } from "@/integrations/firebase/commentService";
import { format } from "date-fns";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TimestampedCommentsProps {
  videoId: string;
  videoTitle: string;
}

const TimestampedComments = ({ videoId, videoTitle }: TimestampedCommentsProps) => {
  const [comments, setComments] = useState<TimestampedComment[]>([]);
  const [groupedComments, setGroupedComments] = useState<Record<string, TimestampedComment[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'grouped'>('all');

  useEffect(() => {
    // Only fetch when dialog is opened to save resources
    if (isOpen) {
      fetchComments();
    }
  }, [isOpen, videoId]);

  const fetchComments = async (forceRefresh: boolean = true) => {
    if (!videoId) {
      console.error('No videoId provided');
      setError('No video ID provided');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      if (forceRefresh) {
        clearVideoCommentsCache(videoId);
      }
      
      console.log(`[TimestampedComments] Fetching comments for videoId: "${videoId}"`);
      const fetchedComments = await getVideoTimestampedComments(videoId, !forceRefresh);
      console.log(`[TimestampedComments] Received ${fetchedComments?.length || 0} comments:`, fetchedComments);
      
      if (!fetchedComments || fetchedComments.length === 0) {
        console.warn(`[TimestampedComments] No comments found for videoId: "${videoId}"`);
      }
      
      setComments(fetchedComments || []);
      setCommentCount(fetchedComments?.length || 0);
      
      // Also fetch grouped comments
      if (fetchedComments && fetchedComments.length > 0) {
        const grouped = await getVideoCommentsGroupedByUserName(videoId);
        setGroupedComments(grouped);
      }
    } catch (error: any) {
      console.error('[TimestampedComments] Error fetching comments:', error);
      setError(error?.message || 'Failed to load comments');
      setComments([]);
      setGroupedComments({});
      setCommentCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRefresh = () => {
    fetchComments(true);
    toast.success("Comments refreshed");
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
        title={`View ${commentCount} timestamped comment${commentCount !== 1 ? 's' : ''}`}
      >
        <MessageSquare className="h-4 w-4" />
        {commentCount > 0 ? `${commentCount} Timestamped` : "View Timestamped"}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Timestamped Comments for "{videoTitle}"</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            {error && (
              <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20 flex gap-3 mb-4">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Error loading comments</p>
                  <p className="text-xs mt-1">{error}</p>
                  <p className="text-xs mt-2 text-muted-foreground">Video ID: {videoId}</p>
                </div>
              </div>
            )}
            
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm text-muted-foreground">Loading comments...</p>
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground mb-2">No timestamped comments yet</p>
                <p className="text-xs text-muted-foreground">Comments will appear here when users add them</p>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'grouped')} className="flex flex-col h-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="all">All Comments ({comments.length})</TabsTrigger>
                  <TabsTrigger value="grouped">By User ({Object.keys(groupedComments).length})</TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="space-y-3 pr-4">
                      {comments.map((comment) => (
                        <Card key={comment.id} className="border-l-4 border-l-primary">
                          <CardContent className="pt-3 pb-3">
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{comment.userName}</p>
                                  <p className="text-xs text-muted-foreground truncate">{comment.userEmail}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded whitespace-nowrap">
                                    {formatTimestamp(comment.timestamp)}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(comment.comment, comment.id)}
                                    className="h-6 w-6 p-0"
                                  >
                                    {copiedId === comment.id ? (
                                      <Check className="h-3 w-3 text-green-500" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                              <p className="text-sm text-foreground whitespace-pre-wrap break-words">{comment.comment}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(comment.createdAt), 'MMM dd, yyyy HH:mm')}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="grouped" className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="space-y-4 pr-4">
                      {Object.entries(groupedComments).map(([userName, userComments]) => (
                        <div key={userName} className="border rounded-lg p-4 bg-card/50">
                          <div className="mb-3">
                            <p className="font-semibold text-sm">{userName}</p>
                            <p className="text-xs text-muted-foreground">{userComments.length} comment{userComments.length !== 1 ? 's' : ''}</p>
                          </div>
                          <div className="space-y-2">
                            {userComments.map((comment) => (
                              <div key={comment.id} className="border-l-2 border-primary/30 pl-3 py-2 bg-background rounded">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">
                                    {formatTimestamp(comment.timestamp)}
                                  </span>
                                  <span className="text-xs text-muted-foreground">{format(new Date(comment.createdAt), 'MMM dd HH:mm')}</span>
                                </div>
                                <p className="text-sm text-foreground whitespace-pre-wrap break-words">{comment.comment}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TimestampedComments;
