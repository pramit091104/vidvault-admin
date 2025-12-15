import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquare, Send, Clock, Calendar } from "lucide-react";
import { getVideoCommentsFromClient, addClientComment, DBComment } from "@/integrations/firebase/commentService";
import { format } from 'date-fns';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ClientCommentsProps {
  clientName: string;
  securityCode: string;
  videoTitle: string;
}

export function ClientComments({ clientName, securityCode, videoTitle }: ClientCommentsProps) {
  const [comments, setComments] = useState<DBComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchComments = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const videoComments = await getVideoCommentsFromClient(clientName, securityCode, videoTitle);
        setComments(videoComments);
      } catch (err: any) {
        console.error("Error fetching comments:", err);
        setError(err.message || "Failed to load comments");
        toast({
          title: "Error",
          description: "Failed to load comments",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchComments();
  }, [clientName, securityCode, videoTitle, toast]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const comment = await addClientComment(
        clientName,
        securityCode,
        videoTitle,
        newComment.trim()
      );
      
      setComments(prev => [comment, ...prev]);
      setNewComment("");
      toast({
        title: "Success",
        description: "Comment added successfully",
      });
    } catch (err: any) {
      console.error("Error adding comment:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to add comment",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comments for {clientName} - {videoTitle}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">
            <p>{error}</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No comments yet for this video</p>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="space-y-2 p-4 bg-muted/30 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {comment.timestamp && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{comment.timestamp}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{format(new Date(comment.date), 'MMM d, yyyy h:mm a')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-line">{comment.message}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
        
        <form onSubmit={handleAddComment} className="mt-auto pt-4 border-t">
          <div className="flex gap-2">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              disabled={isSubmitting}
            />
            <Button 
              type="submit" 
              disabled={!newComment.trim() || isSubmitting}
              size="icon"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
