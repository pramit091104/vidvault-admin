import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Loader2, CheckCircle2, Copy, Cloud, Globe, Link2, Eye, History, Zap, FileVideo } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { saveGCSVideo } from "@/integrations/firebase/videoService";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/integrations/firebase/config";
import { v4 as uuidv4 } from 'uuid';
import { generateVideoSlug, createPublicUrl } from '@/lib/slugGenerator';
import { useUploadResumption } from '@/hooks/useUploadResumption';
import { useIntegratedUpload } from '@/hooks/useIntegratedUpload';
import { useSimpleUpload } from '@/hooks/useSimpleUpload';
import { UploadResumptionDialog } from './UploadResumptionDialog';
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

const UploadSection = () => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isPublicWebsite, setIsPublicWebsite] = useState<boolean>(false);
  const [enableCompression, setEnableCompression] = useState<boolean>(true);
  const [publicSlug, setPublicSlug] = useState<string>("");
  const [publicUrl, setPublicUrl] = useState<string>("");
  const [showResumptionDialog, setShowResumptionDialog] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [useSimpleUploadMode, setUseSimpleUploadMode] = useState(true); // Default to simple upload

  // Simple upload hook (recommended for files < 50MB)
  const simpleUpload = useSimpleUpload();

  // Integrated upload hook (for large files with chunking)
  const {
    isUploading,
    uploadProgress,
    compressionProgress,
    currentChunk,
    totalChunks,
    error: uploadError,
    result: uploadResult,
    stage,
    uploadFile,
    resumeUpload,
    reset: resetUpload
  } = useIntegratedUpload();

  // Upload resumption hook
  const {
    hasResumableUploads,
    hasExpiredUploads,
    cleanup
  } = useUploadResumption();

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    // Clean up old upload states on component mount
    cleanup();

    return () => unsubscribe();
  }, [cleanup]);

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
    
    setUploadSuccess(false);
    setPublicSlug("");
    setPublicUrl("");
    
    try {
      let result;
      
      // Use simple upload for files < 50MB or if explicitly selected
      if (useSimpleUploadMode || file.size < 50 * 1024 * 1024) {
        toast.info("Starting direct upload...");
        simpleUpload.reset();
        
        result = await simpleUpload.uploadFile({
          file,
          metadata: {
            title: title.trim(),
            description: description?.trim() || '',
            clientName: clientName.trim(),
          },
          onProgress: (progress) => {
            // Progress is handled by the hook
          }
        });
      } else {
        // Use chunked upload for large files
        toast.info("Starting chunked upload...");
        resetUpload();
        
        result = await uploadFile({
          file,
          metadata: {
            title: title.trim(),
            description: description?.trim() || '',
            clientName: clientName.trim(),
          },
          enableCompression,
          onProgress: (progress) => {
            // Progress is handled by the hook
          },
          onChunkUploaded: (chunkId, chunkIndex) => {
            // Chunk progress is handled by the hook
          },
          onCompressionProgress: (progress) => {
            // Compression progress is handled by the hook
          },
          onError: (error) => {
            console.error('Upload error:', error);
          }
        });
      }

      if (result.success) {
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
          // Extract the GCS path from the result
          const gcsPath = result.gcsPath || `uploads/${result.uploadId}/${result.fileName}`;
          
          await saveGCSVideo({
            id: videoId,
            title: title.trim(),
            description: description?.trim() || '',
            clientName: clientName.trim(),
            userId: currentUser?.uid,
            fileName: result.fileName || file.name,
            gcsPath: gcsPath, // Save the full GCS path
            publicUrl: result.signedUrl || '',
            size: result.size || file.size,
            contentType: file.type,
            privacyStatus: 'private',
            securityCode: '',
            isActive: true,
            accessCount: 0,
            isPubliclyAccessible: false,
            uploadedAt: new Date(),
            isPublic: isPublicWebsite,
            publicSlug: generatedSlug,
            publicWebsiteUrl: isPublicWebsite ? createPublicUrl(generatedSlug) : '',
            viewCount: 0,
          });
          
          toast.success('Video uploaded and saved successfully!');
          console.log('✅ Video saved to Firebase:', videoId, 'GCS Path:', gcsPath);
        } catch (firebaseError: any) {
          console.error('Firebase save error:', firebaseError);
          toast.error('Video uploaded but failed to save to database');
        }
        
        setUploadSuccess(true);
        window.dispatchEvent(new CustomEvent("gcs-video-uploaded"));
      } else {
        toast.error(result.error || "Failed to upload video");
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload video");
    }
  };

  const copyPublicUrl = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      toast.success('Public URL copied to clipboard!');
    }
  };

  const handleResumeUpload = async (sessionId: string) => {
    if (!file) {
      toast.error('Please select a file to resume the upload');
      return;
    }

    try {
      const result = await resumeUpload(sessionId, file, {
        metadata: {
          title: title.trim(),
          description: description?.trim() || '',
          clientName: clientName.trim(),
        }
      });

      if (result.success) {
        setUploadSuccess(true);
        toast.success('Upload resumed and completed successfully!');
      } else {
        toast.error(result.error || 'Failed to resume upload');
      }
    } catch (error) {
      console.error('Error resuming upload:', error);
      toast.error('Failed to resume upload. Please try again.');
    }
  };

  const handleStartFreshUpload = () => {
    // Just start a new upload
    handleUpload();
  };

  const showResumptionDialogIfNeeded = () => {
    if (hasResumableUploads || hasExpiredUploads) {
      setShowResumptionDialog(true);
    } else {
      handleUpload();
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
          Upload your video to Cloud Storage
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
          <Label htmlFor="uploadMode">Upload Mode</Label>
          <div className="flex items-center space-x-3 p-4 border border-border/50 rounded-lg bg-background/50">
            <input
              type="checkbox"
              id="uploadMode"
              checked={useSimpleUploadMode}
              onChange={(e) => setUseSimpleUploadMode(e.target.checked)}
              className="h-4 w-4 text-primary rounded border-border"
            />
            <div className="flex-1">
              <Label htmlFor="uploadMode" className="text-sm font-medium text-foreground cursor-pointer">
                Use simple upload (Recommended)
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Direct upload for files up to 50MB. Faster and more reliable. Uncheck for large files that need chunked upload.
              </p>
            </div>
            <Zap className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="enableCompression">Video Optimization</Label>
          <div className="flex items-center space-x-3 p-4 border border-border/50 rounded-lg bg-background/50">
            <input
              type="checkbox"
              id="enableCompression"
              checked={enableCompression}
              onChange={(e) => setEnableCompression(e.target.checked)}
              className="h-4 w-4 text-primary rounded border-border"
              disabled={useSimpleUploadMode}
            />
            <div className="flex-1">
              <Label htmlFor="enableCompression" className="text-sm font-medium text-foreground cursor-pointer">
                Enable video compression
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                {useSimpleUploadMode 
                  ? "Compression is not available in simple upload mode. Please compress your video before uploading."
                  : "Automatically compress large videos to reduce file size and improve upload speed. Recommended for files over 50MB."
                }
              </p>
            </div>
            <Zap className="h-5 w-5 text-muted-foreground" />
          </div>
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

        {/* Enhanced Progress Display */}
        {(isUploading || simpleUpload.isUploading) && (
          <div className="space-y-4 p-4 border border-border/50 rounded-lg bg-background/50">
            <div className="flex items-center gap-2">
              <FileVideo className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {useSimpleUploadMode || simpleUpload.isUploading 
                  ? 'Uploading file...' 
                  : stage === 'compressing' ? 'Compressing video...'
                  : stage === 'uploading' ? 'Uploading chunks...'
                  : 'Assembling file...'}
              </span>
              <Badge variant="secondary" className="ml-auto">
                {useSimpleUploadMode || simpleUpload.isUploading ? 'uploading' : stage}
              </Badge>
            </div>

            {/* Simple Upload Progress */}
            {(useSimpleUploadMode || simpleUpload.isUploading) && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Upload Progress</span>
                  <span className="text-muted-foreground">{Math.round(simpleUpload.uploadProgress)}%</span>
                </div>
                <Progress value={simpleUpload.uploadProgress} className="h-2" />
              </div>
            )}

            {/* Compression Progress */}
            {!useSimpleUploadMode && stage === 'compressing' && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Compression Progress</span>
                  <span className="text-muted-foreground">{Math.round(compressionProgress)}%</span>
                </div>
                <Progress value={compressionProgress} className="h-2" />
              </div>
            )}

            {/* Upload Progress */}
            {(stage === 'uploading' || stage === 'assembling') && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Upload Progress</span>
                  <span className="text-muted-foreground">{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
                
                {totalChunks > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Chunk {currentChunk} of {totalChunks}</span>
                    <span>{((file?.size || 0) / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>
                )}
              </div>
            )}

            {/* Assembly Progress */}
            {stage === 'assembling' && (
              <div className="text-sm text-muted-foreground">
                Assembling chunks into final file...
              </div>
            )}
          </div>
        )}

        {/* Upload Error */}
        {uploadError && (
          <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20">
            <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>
          </div>
        )}

        {/* Success Display with Compression Info */}
        {uploadSuccess && uploadResult && (
          <div className="space-y-4">
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <h4 className="text-sm font-medium">Upload Complete!</h4>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">File:</span>
                  <div className="font-medium">{uploadResult.fileName}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Duration:</span>
                  <div className="font-medium">{(uploadResult.uploadDuration / 1000).toFixed(1)}s</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Original Size:</span>
                  <div className="font-medium">{(uploadResult.originalSize / (1024 * 1024)).toFixed(1)} MB</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Final Size:</span>
                  <div className="font-medium">{(uploadResult.finalSize / (1024 * 1024)).toFixed(1)} MB</div>
                </div>
              </div>

              {uploadResult.compressionApplied && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Video Compressed
                    </span>
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400">
                    Saved {((uploadResult.originalSize - uploadResult.finalSize) / (1024 * 1024)).toFixed(1)} MB 
                    ({Math.round((1 - uploadResult.compressionRatio) * 100)}% reduction)
                  </div>
                </div>
              )}
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
          onClick={showResumptionDialogIfNeeded}
          disabled={!file || !title || !clientName || isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {stage === 'compressing' && 'Compressing...'}
              {stage === 'uploading' && 'Uploading...'}
              {stage === 'assembling' && 'Assembling...'}
            </>
          ) : uploadSuccess ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Upload Complete!
            </>
          ) : (
            <>
              <Cloud className="mr-2 h-4 w-4" />
              Upload to Cloud Storage
            </>
          )}
        </Button>

        {/* Show resumption button if there are resumable uploads */}
        {(hasResumableUploads || hasExpiredUploads) && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowResumptionDialog(true)}
          >
            <History className="mr-2 h-4 w-4" />
            Resume Previous Uploads ({hasResumableUploads ? 'Available' : 'Expired'})
          </Button>
        )}
      </CardContent>

      {/* Upload Resumption Dialog */}
      <UploadResumptionDialog
        open={showResumptionDialog}
        onOpenChange={setShowResumptionDialog}
        onResumeUpload={handleResumeUpload}
        onStartFreshUpload={handleStartFreshUpload}
      />
    </Card>
  );
};

export default UploadSection;
