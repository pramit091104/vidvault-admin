import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, CheckCircle2, Youtube, Copy, Cloud, Globe, Link2, Eye } from "lucide-react";
import { toast } from "sonner";
import { youtubeService } from "@/integrations/youtube/youtubeService";
import { gcsService } from "@/integrations/gcs/gcsService";
import { Progress } from "@/components/ui/progress";
import { saveYouTubeVideo, saveGCSVideo } from "@/integrations/firebase/videoService";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/integrations/firebase/config";
import { v4 as uuidv4 } from 'uuid';
import { generateVideoSlug, createPublicUrl } from '@/lib/slugGenerator';

const UploadSection = () => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [privacyStatus, setPrivacyStatus] = useState<"private" | "unlisted" | "public">("private");
  const [uploadService, setUploadService] = useState<"youtube" | "gcs">("youtube");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [youtubeVideoUrl, setYoutubeVideoUrl] = useState("");
  const [gcsVideoUrl, setGcsVideoUrl] = useState("");
  const [isInitializing, setIsInitializing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isPublicWebsite, setIsPublicWebsite] = useState<boolean>(false);
  const [publicSlug, setPublicSlug] = useState<string>("");
  const [publicUrl, setPublicUrl] = useState<string>("");

  useEffect(() => {
    // Initialize services based on selected upload service
    const initializeServices = async () => {
      try {
        setIsInitializing(true);
        
        // Always initialize YouTube service in case user switches to it
        await youtubeService.initialize();
        
        // Initialize GCS service
        await gcsService.initialize();
      } catch (error: any) {
        console.error("Failed to initialize services:", error);
        if (uploadService === 'youtube') {
          toast.error("Failed to initialize YouTube service. Please check your configuration.");
        } else {
          toast.error("Failed to initialize Google Cloud Storage service. Please check your configuration.");
        }
      } finally {
        setIsInitializing(false);
      }
    };

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    initializeServices();

    return () => unsubscribe();
  }, [uploadService]);

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
    if (!clientName.trim()) {
      toast.error("Please enter a client name.");
      return;
    }
    if (!currentUser) {
      toast.error("Please sign in to upload videos.");
      return;
    }
    
    setIsUploading(true);
    setUploadSuccess(false);
    setUploadProgress(0);
    setYoutubeVideoUrl("");
    setGcsVideoUrl("");
    setPublicSlug("");
    setPublicUrl("");
    
    try {
      if (uploadService === 'youtube') {
        // YouTube Upload Logic
        const isAuthenticated = await youtubeService.isAuthenticated();
        if (!isAuthenticated) {
          toast.info("Please sign in to YouTube to continue");
          const authenticated = await youtubeService.authenticate();
          if (!authenticated) {
            setIsUploading(false);
            return;
          }
        }
        
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
        
        const youtubeVideoId = result.videoId || result.videoUrl?.split('v=')[1]?.split('&')[0];
        
        // Generate public slug if enabled
        let generatedSlug = '';
        if (isPublicWebsite) {
          try {
            generatedSlug = generateVideoSlug(clientName.trim(), title.trim());
            setPublicSlug(generatedSlug);
            const url = createPublicUrl(generatedSlug);
            setPublicUrl(url);
            toast.success('Public website created successfully!');
          } catch (slugError: any) {
            console.error('Slug generation error:', slugError);
            toast.error('Video uploaded but failed to create public website');
          }
        }
        
        // Save to Firebase YouTube collection
        const videoId = uuidv4();
        try {
          await saveYouTubeVideo({
            id: videoId,
            title: title.trim(),
            description: description?.trim() || '',
            clientName: clientName.trim(),
            userId: currentUser?.uid,
            youtubeVideoId,
            youtubeVideoUrl: result.videoUrl,
            privacyStatus,
            securityCode: '',
            isActive: true,
            accessCount: 0,
            uploadStatus: 'completed',
            uploadedAt: new Date(),
            isPublic: isPublicWebsite,
            publicSlug: generatedSlug,
            publicUrl: isPublicWebsite ? createPublicUrl(generatedSlug) : '',
            viewCount: 0,
          });
        } catch (firebaseError: any) {
          console.error('Firebase save error:', firebaseError);
          toast.error('Video uploaded but failed to save to database');
        }
        
        setYoutubeVideoUrl(result.videoUrl);
        setUploadSuccess(true);
        toast.success('Video uploaded successfully to YouTube!');
        window.dispatchEvent(new CustomEvent("youtube-video-uploaded"));
        
      } else {
        // Google Cloud Storage Upload Logic
        const result = await gcsService.uploadVideo(
          file,
          {
            title: title.trim(),
            description: description?.trim() || '',
            clientName: clientName.trim(),
            privacyStatus,
          },
          (progress) => {
            setUploadProgress(progress);
          }
        );
        
        // Generate public slug if enabled
        let generatedSlug = '';
        if (isPublicWebsite) {
          try {
            generatedSlug = generateVideoSlug(clientName.trim(), title.trim());
            setPublicSlug(generatedSlug);
            const url = createPublicUrl(generatedSlug);
            setPublicUrl(url);
            toast.success('Public website created successfully!');
          } catch (slugError: any) {
            console.error('Slug generation error:', slugError);
            toast.error('Video uploaded but failed to create public website');
          }
        }
        
        // Save to Firebase GCS collection
        const videoId = uuidv4();
        try {
          await saveGCSVideo({
            id: videoId,
            title: title.trim(),
            description: description?.trim() || '',
            clientName: clientName.trim(),
            userId: currentUser?.uid,
            fileName: result.fileName,
            publicUrl: result.publicUrl,
            size: result.size,
            contentType: result.contentType,
            privacyStatus,
            securityCode: '',
            isActive: true,
            accessCount: 0,
            isPubliclyAccessible: privacyStatus === 'public',
            uploadedAt: new Date(),
            isPublic: isPublicWebsite,
            publicSlug: generatedSlug,
            publicWebsiteUrl: isPublicWebsite ? createPublicUrl(generatedSlug) : '',
            viewCount: 0,
          });
        } catch (firebaseError: any) {
          console.error('Firebase save error:', firebaseError);
          toast.error('Video uploaded but failed to save to database');
        }
        
        setGcsVideoUrl(result.publicUrl);
        setUploadSuccess(true);
        toast.success('Video uploaded successfully to Google Cloud Storage!');
        window.dispatchEvent(new CustomEvent("gcs-video-uploaded"));
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      
      if (uploadService === 'youtube') {
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
      } else {
        toast.error(error.message || "Failed to upload video to Google Cloud Storage");
      }
      
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const copyPublicUrl = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      toast.success('Public URL copied to clipboard!');
    }
  };

  return (
    <Card className="border-border/50 bg-card/95">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          Upload Video
        </CardTitle>
        <CardDescription>
          Upload your video to YouTube or Google Cloud Storage
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="uploadService">Upload Service *</Label>
          <Select value={uploadService} onValueChange={(value: "youtube" | "gcs") => setUploadService(value)}>
            <SelectTrigger className="bg-background/50">
              <SelectValue placeholder="Select upload service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="youtube">
                <div className="flex items-center gap-2">
                  <Youtube className="h-4 w-4" />
                  YouTube
                </div>
              </SelectItem>
              <SelectItem value="gcs">
                <div className="flex items-center gap-2">
                  <Cloud className="h-4 w-4" />
                  Google Cloud Storage
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

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
          <Label htmlFor="clientName">Client Name *</Label>
          <Input
            id="clientName"
            placeholder="Enter client name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
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
          <Label htmlFor="publicWebsite">Public Access</Label>
          <div className="flex items-center space-x-3 p-4 border border-border/50 rounded-lg bg-background/50">
            <input
              type="checkbox"
              id="publicWebsite"
              checked={isPublicWebsite}
              onChange={(e) => setIsPublicWebsite(e.target.checked)}
              className="h-4 w-4 text-primary rounded border-border"
            />
            <div className="flex-1">
              <Label htmlFor="publicWebsite" className="text-sm font-medium text-foreground cursor-pointer">
                Create public website
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Generate a shareable single-page website for this video. Anyone with the link can view without a security code.
              </p>
            </div>
            <Globe className="h-5 w-5 text-muted-foreground" />
          </div>
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
          <div className="space-y-4">
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                Selected: {file.name}
              </p>
              <p className="text-xs text-muted-foreground">
                Size: {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            
            {publicUrl && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Public Website Created
                  </h4>
                </div>
                <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-md px-3 py-2">
                  <code className="text-sm font-mono text-blue-700 dark:text-blue-300 truncate">
                    {publicUrl}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyPublicUrl}
                    className="ml-2 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Share this link for direct public access. No security code required.
                </p>
              </div>
            )}
          </div>
        )}

        <Button
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          onClick={handleUpload}
          disabled={!file || !title || !clientName || isUploading || isInitializing}
        >
          {isInitializing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Initializing...
            </>
          ) : isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading to {uploadService === 'youtube' ? 'YouTube...' : 'Google Cloud Storage...'}
            </>
          ) : uploadSuccess ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Upload Complete!
            </>
          ) : (
            <>
              {uploadService === 'youtube' ? (
                <>
                  <Youtube className="mr-2 h-4 w-4" />
                  Upload to YouTube
                </>
              ) : (
                <>
                  <Cloud className="mr-2 h-4 w-4" />
                  Upload to Google Cloud Storage
                </>
              )}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default UploadSection;
