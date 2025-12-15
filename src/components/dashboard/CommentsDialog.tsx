import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquare, ThumbsUp } from "lucide-react";
import { youtubeService, YouTubeComment } from "@/integrations/youtube/youtubeService";

export function CommentsDialog({
  videoId,
  open,
  onOpenChange,
}: {
  videoId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [comments, setComments] = useState<YouTubeComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchComments = async () => {
      if (!open) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const videoComments = await youtubeService.getVideoComments(videoId, 50);
        setComments(videoComments);
      } catch (err: any) {
        console.error("Error fetching comments:", err);
        setError(err.message || "Failed to load comments");
      } finally {
        setIsLoading(false);
      }
    };

    fetchComments();
  }, [videoId, open]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Video Comments</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">
            <p>{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => window.open(`https://youtube.com/watch?v=${videoId}&lc=1`, '_blank')}
            >
              View on YouTube
            </Button>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No comments yet</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => window.open(`https://youtube.com/watch?v=${videoId}&lc=1`, '_blank')}
            >
              Add a comment on YouTube
            </Button>
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4 -mr-4">
            <div className="space-y-6 pr-4">
              {comments.map((comment) => (
                <div key={comment.id} className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={comment.authorImageUrl} alt={comment.author} />
                      <AvatarFallback>{comment.author[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{comment.author}</p>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(comment.publishedAt)}
                        </span>
                      </div>
                      <p className="text-sm mt-1 whitespace-pre-line">{comment.text}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          <span>{comment.likeCount}</span>
                        </div>
                        {comment.replies && comment.replies.length > 0 && (
                          <div className="text-blue-500">
                            {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="ml-12 space-y-4 border-l-2 border-muted pl-4">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="flex items-start gap-3 pt-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={reply.authorImageUrl} alt={reply.author} />
                            <AvatarFallback>{reply.author[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{reply.author}</p>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(reply.publishedAt)}
                              </span>
                            </div>
                            <p className="text-sm mt-1 whitespace-pre-line">{reply.text}</p>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <ThumbsUp className="h-3 w-3" />
                                <span>{reply.likeCount}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
        
        <div className="flex justify-end pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => window.open(`https://youtube.com/watch?v=${videoId}&lc=1`, '_blank')}
          >
            View all comments on YouTube
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
