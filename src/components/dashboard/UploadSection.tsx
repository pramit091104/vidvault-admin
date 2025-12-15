import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, CheckCircle2, Youtube } from "lucide-react";
import { toast } from "sonner";
import { youtubeService } from "@/integrations/youtube/youtubeService";
import { Progress } from "@/components/ui/progress";

const UploadSection = () => {
  const [fileUrl, setFileUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [privacyStatus, setPrivacyStatus] = useState<"private" | "unlisted" | "public">("private");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [youtubeVideoUrl, setYoutubeVideoUrl] = useState("");
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    // Initialize YouTube service on mount
    const initYouTube = async () => {
      try {
        setIsInitializing(true);
        await youtubeService.initialize();
      } catch (error: any) {
        console.error("Failed to initialize YouTube service:", error);
        toast.error("Failed to initialize YouTube service. Please check your configuration.");
      } finally {
        setIsInitializing(false);
      }
    };

    initYouTube();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      // Strict file type validation
      const allowedTypes = [
        "video/mp4",
        "video/mpeg",
        "video/quicktime",
        "video/x-msvideo",
        "video/webm",
        "video/ogg",
        "video/x-matroska"
      ];
      const allowedExts = ["mp4", "mov", "avi", "wmv", "flv", "webm", "mkv", "ogg"];
      const ext = selectedFile.name.split('.').pop()?.toLowerCase() || "";
      if (!allowedTypes.includes(selectedFile.type) && !allowedExts.includes(ext)) {
        toast.error("Invalid file type. Please select a supported video format.");
        return;
      }
      // Strict file size check (YouTube limit is 256GB, set a reasonable frontend limit)
      const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
      if (selectedFile.size > maxSize) {
        toast.error("File size exceeds the 2GB upload limit.");
        return;
      }
      setFile(selectedFile);
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a video file to upload.");
      return;
    }
    if (!title.trim()) {
      toast.error("Please enter a video title.");
      return;
    }
    setIsUploading(true);
    setUploadSuccess(false);
    setUploadProgress(0);
    setYoutubeVideoUrl("");
    try {
      // Check authentication
      const isAuthenticated = await youtubeService.isAuthenticated();
      if (!isAuthenticated) {
        toast.info("Please sign in to YouTube to continue");
        const authenticated = await youtubeService.authenticate();
        if (!authenticated) {
          setIsUploading(false);
          return;
        }
      }
      // Upload video to YouTube
      const result = await youtubeService.uploadVideo(
        file,
        {
          title: title.trim(),
          description: description?.trim() || undefined,
          privacyStatus,
        },
        (progress) => {
          setUploadProgress(progress);
        }
      );
      setYoutubeVideoUrl(result.videoUrl);
      setUploadSuccess(true);
      toast.success('Video uploaded successfully to YouTube!');
      window.dispatchEvent(new CustomEvent("youtube-video-uploaded"));
      // Reset form after 3 seconds
      setTimeout(() => {
        setFile(null);
        setTitle("");
        setDescription("");
        setPrivacyStatus("private");
        setUploadSuccess(false);
        setUploadProgress(0);
        setYoutubeVideoUrl("");
      }, 5000);
    } catch (error: any) {
      console.error("Upload error:", error);
      if (error.isYouTubeSignupRequired || error.message?.includes("YouTube channel")) {
        toast.error(
          error.message || "Your Google account needs a YouTube channel to upload videos. Please create one at youtube.com first.",
          {
            duration: 8000,
            action: {
              label: "Open YouTube",
              onClick: () => window.open("https://www.youtube.com", "_blank"),
            },
          }
        );
      } else {
        toast.error(error.message || "Failed to upload video to YouTube");
      }
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="border-border/50 bg-card/95 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          Upload Video
        </CardTitle>
        <CardDescription>
          Upload your video to YouTube
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Video Title *</Label>
          <Input
            id="title"
            placeholder="Enter video title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-background/50"
            required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (Optional)</Label>
          <Textarea
            id="description"
            placeholder="Enter video description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-background/50 min-h-[100px]"
            rows={4} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="privacy">Privacy Status</Label>
          <Select value={privacyStatus} onValueChange={(value: "private" | "unlisted" | "public") => setPrivacyStatus(value)}>
            <SelectTrigger className="bg-background/50">
              <SelectValue placeholder="Select privacy status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">Private</SelectItem>
              <SelectItem value="unlisted">Unlisted</SelectItem>
              <SelectItem value="public">Public</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="video">Video File *</Label>
          <div className="relative">
            <Input
              id="video"
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="bg-background/50 cursor-pointer"
              disabled={isUploading} />
          </div>
          {file && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Selected: {file.name}
              </p>
              <p className="text-xs text-muted-foreground">
                Size: {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}
        </div>

        {isUploading && uploadProgress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Upload Progress</span>
              <span className="text-muted-foreground">{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

                {uploadSuccess && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Selected: {file.name}
            </p>
            <p className="text-xs text-muted-foreground">
              Size: {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        )}

        <Button
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          onClick={handleUpload}
          disabled={!file || !title || isUploading || isInitializing}
        >
          {isInitializing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Initializing...
            </>
          ) : isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading to YouTube...
            </>
          ) : uploadSuccess ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Upload Complete!
            </>
          ) : (
            <>
              <Youtube className="mr-2 h-4 w-4" />
              Upload to YouTube
            </>
          )}
        </Button>

        <div className="bg-secondary/50 border border-border rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-medium text-foreground">YouTube Integration</h4>
          <p className="text-xs text-muted-foreground">
            Videos will be uploaded to your YouTube channel. Make sure you have:
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Configured YouTube API credentials</li>
            <li>Authorized the application to upload videos</li>
            <li>
              <strong>Created a YouTube channel</strong> (visit{" "}
              <a
                href="https://www.youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                youtube.com
              </a>{" "}
              to create one if needed)
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default UploadSection;