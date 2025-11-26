import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Film, Trash2, ExternalLink } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Mock data
const mockVideos = [
  {
    id: "1",
    title: "Client Draft v1",
    vimeoUrl: "https://vimeo.com/123456789",
    uploadDate: "2024-01-15",
    status: "active",
  },
  {
    id: "2",
    title: "Project Showcase",
    vimeoUrl: "https://vimeo.com/987654321",
    uploadDate: "2024-01-10",
    status: "active",
  },
];

const VideosTable = () => {
  const handleDelete = (id: string) => {
    // TODO: Implement delete functionality
    console.log("Delete video:", id);
  };

  return (
    <Card className="border-border/50 bg-card/95 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="h-5 w-5 text-primary" />
          Manage Videos
        </CardTitle>
        <CardDescription>
          View and manage all uploaded videos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50">
                <TableHead>Title</TableHead>
                <TableHead>Upload Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockVideos.map((video) => (
                <TableRow key={video.id} className="hover:bg-secondary/30">
                  <TableCell className="font-medium">{video.title}</TableCell>
                  <TableCell>{video.uploadDate}</TableCell>
                  <TableCell>
                    <Badge className="bg-primary/10 text-primary border-primary/20">
                      {video.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => window.open(video.vimeoUrl, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8"
                      onClick={() => handleDelete(video.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {mockVideos.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Film className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No videos uploaded yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VideosTable;
