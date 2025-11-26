import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const UploadSection = () => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      if (!title) {
        setTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !title) {
      toast.error("Please select a file and enter a title");
      return;
    }

    setIsUploading(true);
    setUploadSuccess(false);

    // TODO: Implement Vimeo upload
    // Simulate upload
    setTimeout(() => {
      setIsUploading(false);
      setUploadSuccess(true);
      toast.success("Video uploaded successfully!");
      
      setTimeout(() => {
        setFile(null);
        setTitle("");
        setUploadSuccess(false);
      }, 2000);
    }, 3000);
  };

  return (
    <Card className="border-border/50 bg-card/95 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          Upload Video to Vimeo
        </CardTitle>
        <CardDescription>
          Select a video file from your computer to upload to Vimeo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Video Title</Label>
          <Input
            id="title"
            placeholder="Enter video title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-background/50"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="video">Video File</Label>
          <div className="relative">
            <Input
              id="video"
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="bg-background/50 cursor-pointer"
            />
          </div>
          {file && (
            <p className="text-sm text-muted-foreground">
              Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        <Button
          onClick={handleUpload}
          disabled={!file || !title || isUploading}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading to Vimeo...
            </>
          ) : uploadSuccess ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Upload Complete!
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Video
            </>
          )}
        </Button>

        <div className="bg-secondary/50 border border-border rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-medium text-foreground">Integration Required</h4>
          <p className="text-xs text-muted-foreground">
            To complete this feature, you'll need to:
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Add Vimeo API credentials</li>
            <li>Configure Firebase Firestore</li>
            <li>Set up Firebase Authentication</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default UploadSection;
