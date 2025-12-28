// src/pages/Watch.tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getYouTubeVideo, getGCSVideo, YouTubeVideoRecord, GCSVideoRecord } from '@/integrations/firebase/videoService';
import { getVideoTimestampedComments, addTimestampedComment } from '@/integrations/firebase/commentService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
  id: string;
  videoId: string;
  userName: string;
  timestamp: number;
  comment: string;
  createdAt: string;
}

const Watch = () => {
  const { videoId } = useParams<{ videoId: string }>();
  const [video, setVideo] = useState<YouTubeVideoRecord | GCSVideoRecord | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [userName, setUserName] = useState(localStorage.getItem('commenterName') || '');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
  const fetchVideoAndComments = async () => {
    try {
      setIsLoading(true);
      
      // Try to fetch as YouTube video first
      let videoData: YouTubeVideoRecord | GCSVideoRecord | null = await getYouTubeVideo(videoId!);
      
      // If not found as YouTube video, try as GCS video
      if (!videoData) {
        videoData = await getGCSVideo(videoId!);
      }
      
      if (!videoData) {
        throw new Error('Video not found');
      }
      
      const commentsData = await getVideoTimestampedComments(videoId!);
      
      setVideo(videoData);
      setComments(commentsData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load video or comments');
    } finally {
      setIsLoading(false);
    }
  };

  if (videoId) {
    fetchVideoAndComments();
  }
}, [videoId]);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !userName.trim()) return;

    try {
      const commentData = {
        videoId: videoId!,
        userName,
        comment: newComment,
        timestamp: 0, // You might want to get the current video time
        createdAt: new Date().toISOString(),
      };

      // Save username to localStorage for convenience
      localStorage.setItem('commenterName', userName);

      // Add comment to Firestore
      const commentRef = await addTimestampedComment(commentData);
      
      // Update local state immediately for better UX
      setComments(prev => [{
        ...commentData,
        id: commentRef.id
      }, ...prev]);
      
      // Reset comment input
      setNewComment('');
    } catch (err) {
      console.error('Error adding comment:', err);
      setError('Failed to post comment. Please try again.');
    }
  };

  if (isLoading) {
    return <div className="container mx-auto p-4">Loading...</div>;
  }

  if (error) {
    return <div className="container mx-auto p-4 text-red-500">{error}</div>;
  }

  if (!video) {
    return <div className="container mx-auto p-4">Video not found</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Player Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="aspect-w-16 aspect-h-9 bg-black rounded-lg overflow-hidden">
            <video
              className="w-full h-full"
              controls
              src={video.service === 'youtube' ? `https://www.youtube.com/embed/${video.youtubeVideoId}` : video.publicUrl}
              poster={video.service === 'youtube' ? video.thumbnailUrl : undefined}
            />
          </div>
          
          <div>
            <h1 className="text-2xl font-bold">{video.title}</h1>
            <p className="text-muted-foreground">
              {video.uploadedAt && formatDistanceToNow(new Date(video.uploadedAt))} ago
            </p>
          </div>
        </div>

        {/* Comments Section */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Comments ({comments.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Comment Form */}
              <form onSubmit={handleCommentSubmit} className="space-y-2">
                <div>
                  <Input
                    type="text"
                    placeholder="Your name"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    required
                    className="flex-1"
                  />
                  <Button type="submit" disabled={!newComment.trim() || !userName.trim()}>
                    Post
                  </Button>
                </div>
              </form>

              {/* Comments List */}
              <div className="space-y-4 mt-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="border-b pb-2 last:border-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{comment.userName}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.createdAt))} ago
                        </p>
                      </div>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{comment.comment}</p>
                  </div>
                ))}
                {comments.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    No comments yet. Be the first to comment!
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Watch;