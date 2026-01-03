import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload as UploadIcon, Crown, AlertCircle, CheckCircle2, Pause, Play, X, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/integrations/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { useUppyUpload } from "@/hooks/useUppyUpload";
import { useSimpleUpload } from "@/hooks/useSimpleUpload";
import { saveGCSVideo } from "@/integrations/firebase/videoService";
import { PremiumPaymentModal } from "@/components/payment/PremiumPaymentModal";
import { v4 as uuidv4 } from 'uuid';
import { FEATURES, formatFileSize } from "@/config/features";

const SmartUploadSection = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const { subscription, canUploadVideo, incrementVideoUpload } = useAuth();

  // Use both upload hooks
  const {
    isUploading: isUppyUploading,
    uploadProgress: uppyProgress,
    uploadSpeed: uppySpeed,
    currentChunk,
    totalChunks,
    error: uppyError,
    result: uppyResult,
    startUpload: startUppyUpload,
    pauseUpload,
    resumeUpload,
    cancelUpload: cancelUppyUpload,
    reset: resetUppyUpload,
    isPaused
  } = useUppyUpload();

  const {
    isUploading: isSimpleUploading,
    uploadProgress: simpleProgress,
    error: simpleError,
    result: simpleResult,
    uploadFile: startSimpleUpload,
    reset: resetSimpleUpload
  } = useSimpleUpload();

  // Determine which upload method to use and get unified state
  const isLargeFile = selectedFile ? selectedFile.size >= FEATURES.SIMPLE_UPLOAD_MAX_SIZE : false;
  const isUploading = isUppyUploading || isSimpleUploading;
  const uploadProgress = isLargeFile ? uppyProgress : simpleProgress;
  const uploadSpeed = isLargeFile ? uppySpeed : 0;
  const uploadError = isLargeFile ? uppyError : simpleError;
  const uploadResult = isLargeFile ? uppyResult : simpleResult;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Auto-fill title from filename
  useEffect(() => {
    if (selectedFile && !title) {
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
      setTitle(nameWithoutExt);
    }
  }, [selectedFile, title]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }

    // Validate file type
    const allowedTypes = [
      "video/mp4", "video/mpeg", "video/quicktime",
      "video/x-msvideo", "video/webm", "video/ogg", "video/x-matroska"
    ];
    const allowedExts = ["mp4", "mov", "avi", "wmv", "flv", "webm", "mkv", "ogg"];
    const ext = file.name.split('.').pop()?.toLowerCase() || "";
    
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
      toast.error("Invalid file type. Please select a supported video format.");
      return;
    }

    // Check subscription limits
    if (!canUploadVideo()) {
      toast.error(`Upload limit reached. You've used ${subscription.videoUploadsUsed}/${subscription.maxVideoUploads} uploads.`);
      setShowPaymentModal(true);
      return;
    }

    // Get file size limits based on subscription
    const maxFileSize = subscription.tier === 'premium' 
      ? FEATURES.RESUMABLE_UPLOAD_MAX_SIZE // 2GB for premium
      : FEATURES.SIMPLE_UPLOAD_MAX_SIZE;   // 100MB for free

    // Validate file size based on subscription
    if (file.size > maxFileSize) {
      const maxSizeFormatted = formatFileSize(maxFileSize);
      const currentSizeFormatted = formatFileSize(file.size);
      
      if (subscription.tier === 'free') {
        toast.error(`File too large (${currentSizeFormatted}). Free users can upload up to ${maxSizeFormatted}. Upgrade to Premium for larger files.`);
        setShowPaymentModal(true);
      } else {
        toast.error(`File too large (${currentSizeFormatted}). Maximum file size is ${maxSizeFormatted}.`);
      }
      return;
    }

    setSelectedFile(file);
    setUploadSuccess(false);
    resetUppyUpload();
    resetSimpleUpload();
  };

  const handleUpload = async () => {
    if (!selectedFile || !title.trim() || !clientName.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!currentUser) {
      toast.error("Please sign in to upload videos");
      return;
    }

    if (!canUploadVideo()) {
      toast.error("Upload limit reached. Please upgrade to continue.");
      setShowPaymentModal(true);
      return;
    }

    const videoId = uuidv4();
    const fileName = `${videoId}.${selectedFile.name.split('.').pop()}`;

    const handleUploadSuccess = async (result: any) => {
      try {
        // Save to Firestore when upload is successful
        const videoData = {
          id: videoId,
          title: title.trim(),
          description: description.trim(),
          clientName: clientName.trim(),
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          uploadedAt: new Date(),
          service: 'gcs' as const,
          gcsPath: result.gcsPath || result.fileName || fileName,
          isPublic: false,
          viewCount: 0
        };

        await saveGCSVideo(videoData, currentUser.uid);
        await incrementVideoUpload();

        setUploadSuccess(true);
        toast.success("Video uploaded successfully!");

        // Dispatch event for other components to refresh
        window.dispatchEvent(new CustomEvent("gcs-video-uploaded"));

        // Reset form
        setSelectedFile(null);
        setTitle("");
        setDescription("");
        setClientName("");
        resetUppyUpload();
        resetSimpleUpload();
      } catch (error: any) {
        console.error("Error saving video data:", error);
        toast.error("Upload completed but failed to save video data. Please try again.");
      }
    };

    const handleUploadError = (errorMessage: string) => {
      console.error("Upload error:", errorMessage);
      toast.error(errorMessage || "Upload failed. Please try again.");
    };

    try {
      if (isLargeFile) {
        // Use resumable upload for large files
        await startUppyUpload({
          file: selectedFile,
          metadata: {
            title: title.trim(),
            description: description.trim(),
            clientName: clientName.trim()
          },
          onSuccess: handleUploadSuccess,
          onError: handleUploadError
        });
      } else {
        // Use simple upload for small files
        const result = await startSimpleUpload({
          file: selectedFile,
          metadata: {
            title: title.trim(),
            description: description.trim(),
            clientName: clientName.trim()
          },
          subscription: subscription
        });

        if (result.success) {
          await handleUploadSuccess(result);
        } else {
          handleUploadError(result.error || "Upload failed");
        }
      }
    } catch (error: any) {
      console.error("Upload initialization error:", error);
      toast.error(error.message || "Failed to start upload. Please try again.");
    }
  };

  const handleCancel = () => {
    if (isLargeFile) {
      cancelUppyUpload();
    }
    setSelectedFile(null);
    setTitle("");
    setDescription("");
    setClientName("");
    resetUppyUpload();
    resetSimpleUpload();
  };

  const getUploadMethodBadge = () => {
    if (!selectedFile) return null;
    
    const isLargeFile = selectedFile.size >= FEATURES.SIMPLE_UPLOAD_MAX_SIZE;
    return (
      <Badge variant={isLargeFile ? "secondary" : "default"} className="flex items-center gap-1">
        {isLargeFile && <Zap className="h-3 w-3" />}
        {isLargeFile ? 'Resumable Upload' : 'Simple Upload'}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Subscription Status */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {subscription.tier === 'premium' && <Crown className="h-4 w-4 text-yellow-500" />}
                <span className="font-medium">
                  {subscription.tier === 'premium' ? 'Premium Plan' : 'Free Plan'}
                </span>
              </div>
              <Badge variant="outline">
                {subscription.videoUploadsUsed}/{subscription.maxVideoUploads} uploads used
              </Badge>
            </div>
            {subscription.tier === 'free' && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowPaymentModal(true)}
                className="flex items-center gap-2"
              >
                <Crown className="h-4 w-4" />
                Upgrade to Premium
              </Button>
            )}
          </div>
          
          {!canUploadVideo() && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You've reached your upload limit. 
                {subscription.tier === 'free' ? ' Upgrade to Premium for 50 uploads per month.' : ' Your limit will reset next month.'}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadIcon className="h-5 w-5" />
            Smart Video Upload
          </CardTitle>
          <CardDescription>
            Upload videos with automatic optimization and smart method selection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* File Selection */}
            <div className="space-y-2">
              <Label htmlFor="video-file">Select Video File *</Label>
              <Input
                id="video-file"
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                disabled={isUploading || !canUploadVideo()}
              />
              <p className="text-sm text-muted-foreground">
                {subscription.tier === 'premium' 
                  ? `Maximum file size: ${formatFileSize(FEATURES.RESUMABLE_UPLOAD_MAX_SIZE)}`
                  : `Free plan limit: ${formatFileSize(FEATURES.SIMPLE_UPLOAD_MAX_SIZE)}. Upgrade for larger files.`
                }
              </p>
            </div>

            {/* File Info */}
            {selectedFile && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <div>
                    <strong>{selectedFile.name}</strong>
                    <br />
                    Size: {formatFileSize(selectedFile.size)}
                  </div>
                  {getUploadMethodBadge()}
                </AlertDescription>
              </Alert>
            )}

            {/* Form Fields */}
            {selectedFile && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="video-title">Video Title *</Label>
                  <Input
                    id="video-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter video title"
                    disabled={isUploading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client-name">Client Name *</Label>
                  <Input
                    id="client-name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Enter client name"
                    disabled={isUploading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="video-description">Description (Optional)</Label>
                  <Textarea
                    id="video-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter video description"
                    disabled={isUploading}
                  />
                </div>
              </>
            )}

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Uploading...</span>
                  <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
                
                {totalChunks > 1 && isLargeFile && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Chunk {currentChunk} of {totalChunks}</span>
                    {uploadSpeed && <span>{uploadSpeed}</span>}
                  </div>
                )}

                <div className="flex gap-2">
                  {isLargeFile && (
                    <>
                      {isPaused ? (
                        <Button onClick={resumeUpload} size="sm" variant="outline">
                          <Play className="h-4 w-4 mr-2" />
                          Resume
                        </Button>
                      ) : (
                        <Button onClick={pauseUpload} size="sm" variant="outline">
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </Button>
                      )}
                    </>
                  )}
                  <Button onClick={handleCancel} size="sm" variant="destructive">
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Upload Error */}
            {uploadError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{uploadError}</AlertDescription>
              </Alert>
            )}

            {/* Upload Success */}
            {uploadSuccess && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Video uploaded successfully! You can now manage it in the Videos section.
                </AlertDescription>
              </Alert>
            )}

            {/* Upload Button */}
            {selectedFile && !isUploading && !uploadSuccess && (
              <Button 
                onClick={handleUpload} 
                className="w-full"
                disabled={!title.trim() || !clientName.trim() || !canUploadVideo()}
              >
                <UploadIcon className="h-4 w-4 mr-2" />
                Upload Video
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* No File Selected State */}
      {!selectedFile && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <UploadIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a video file to begin upload</p>
              <p className="text-sm mt-2">
                {subscription.tier === 'premium' 
                  ? `Upload files up to ${formatFileSize(FEATURES.RESUMABLE_UPLOAD_MAX_SIZE)} with resumable upload support`
                  : `Free plan: up to ${formatFileSize(FEATURES.SIMPLE_UPLOAD_MAX_SIZE)}. Upgrade for larger files and more uploads.`
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Premium Payment Modal */}
      <PremiumPaymentModal 
        isOpen={showPaymentModal} 
        onClose={() => setShowPaymentModal(false)} 
      />
    </div>
  );
};

export default SmartUploadSection;