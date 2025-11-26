import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

// Mock data
const mockComments = [
  {
    id: "1",
    videoTitle: "Client Draft v1",
    clientName: "John Doe",
    timestamp: "00:45",
    message: "Love the transition here! Can we make it slightly faster?",
    date: "2024-01-15 14:32",
  },
  {
    id: "2",
    videoTitle: "Client Draft v1",
    clientName: "John Doe",
    timestamp: "02:15",
    message: "The color grading in this scene is perfect.",
    date: "2024-01-15 14:35",
  },
  {
    id: "3",
    videoTitle: "Project Showcase",
    clientName: "Jane Smith",
    timestamp: "01:20",
    message: "Could we adjust the audio levels here?",
    date: "2024-01-10 16:22",
  },
];

const CommentsSection = () => {
  const handleTimestampClick = (timestamp: string) => {
    // TODO: Implement video seeking functionality
    console.log("Seek to:", timestamp);
  };

  return (
    <Card className="border-border/50 bg-card/95 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Client Comments
        </CardTitle>
        <CardDescription>
          View all timestamp comments from clients
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {mockComments.map((comment) => (
          <div
            key={comment.id}
            className="p-4 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-foreground">{comment.clientName}</h4>
                  <Badge variant="outline" className="text-xs">
                    {comment.videoTitle}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {comment.date}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"
                onClick={() => handleTimestampClick(comment.timestamp)}
              >
                {comment.timestamp}
              </Button>
            </div>
            <p className="text-sm text-foreground">{comment.message}</p>
          </div>
        ))}

        {mockComments.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No comments yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CommentsSection;
