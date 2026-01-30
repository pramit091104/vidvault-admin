import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload as UploadIcon, Crown, AlertCircle, CheckCircle2, Pause, Play, X, Zap, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/integrations/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { useUppyUpload } from "@/hooks/useUppyUpload";
import { useSimpleUpload } from "@/hooks/useSimpleUpload";
import { saveGCSVideo, getVideoById, updateVideoApprovalStatus } from "@/integrations/firebase/videoService";
import { validateVideoUploadData, generateSecurityCode } from "@/lib/videoUploadValidator";
import { PremiumPaymentModal } from "@/components/payment/PremiumPaymentModal";
import { v4 as uuidv4 } from 'uuid';
import { FEATURES, formatFileSize } from "@/config/features";
import { getClientByName, createClient } from "@/integrations/firebase/clientService";
import { validateClientCreation } from "@/services/backendApiService";
import { applicationService } from "@/services";

interface SmartUploadSectionProps {
  replaceVideoId?: string | null;
}

const SmartUploadSection = ({ replaceVideoId }: SmartUploadSectionProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [originalVideo, setOriginalVideo] = useState<any>(null);
  const [isReplacingVideo, setIsReplacingVideo] = useState(false);
  const [canUpload, setCanUpload] = useState<{
    canUpload: boolean;
    reason?: string;
    upgradeRequired?: boolean;
  }>({ canUpload: true });

  const { subscription, currentUser: authUser, canUploadVideo, incrementVideoUpload } = useAuth();

  // Check upload permissions using application service
  useEffect(() => {
    const checkUploadPermissions = async () => {
      if (!authUser?.uid) {
        setCanUpload({ canUpload: false, reason: 'Please sign in to upload videos' });
        return;
      }

      try {
        const uploadPermission = await applicationService.canUserUpload(authUser.uid);
        setCanUpload(uploadPermission);
      } catch (error) {
        console.error('Error checking upload permissions:', error);
        setCanUpload({ 
          canUpload: false, 
          reason: 'Error checking upload permissions',
          upgradeRequired: false 
        });
      }
    };

    checkUploadPermissions();
  }, [authUser?.uid, subscription]);

  // Load original video data if replacing
  useEffect(() => {
    const loadOriginalVideo = async () => {
      if (replaceVideoId && authUser) {
        try {
          const video = await getVideoById(replaceVideoId);
          if (video && video.userId === authUser.uid) {
            setOriginalVideo(video);
            setTitle(video.title);
            setDescription(video.description || "");
            setClientName(video.clientName);
            setIsReplacingVideo(true);
            toast.info(`Replacing video: "${video.title}". Upload a new file to create version ${(video.version || 1) + 1}.`);
          } else {
            toast.error("Video not found or you don't have permission to replace it.");
          }
        } catch (error) {
          console.error("Error loading original video:", error);
          toast.error("Failed to load original video data.");
        }
      }
    };

    loadOriginalVideo();
  }, [replaceVideoId, authUser]);

  // Function to automatically create client if it doesn't exist
  const ensureClientExists = async (clientNameValue: string, videoTitle: string): Promise<void> => {
    if (!authUser || !clientNameValue.trim() || !videoTitle.trim()) {
      return;
    }

    try {
      // Check if client already exists
      const existingClient = await getClientByName(clientNameValue.trim(), authUser.uid);
      
      if (existingClient) {
        console.log(`Client "${clientNameValue}" already exists, skipping creation`);
        return;
      }

      // Validate if user can create a new client using application service
      const validation = await validateClientCreation();
      if (!validation.allowed) {
        console.warn(`Cannot auto-create client: ${validation.error}`);
        // Don't throw error, just log warning - video upload should still succeed
        return;
      }

      // Create new client with video title as work/project name
      const newClientData = {
        clientName: clientNameValue.trim(),
        work: videoTitle.trim(), // Use video title as project name
        status: "In progress" as const,
        prePayment: 0,
        paidPayment: 0,
        finalPayment: 0,
        duration: "1 week",
        userId: authUser.uid
      };

      const clientId = await createClient(newClientData);
      console.log(`Auto-created client "${clientNameValue}" with ID: ${clientId}, project: "${videoTitle}"`);
      
      toast.success(`Client "${clientNameValue}" created automatically with project "${videoTitle}"`);
    } catch (error) {
      console.error("Error auto-creating client:", error);
      // Don't throw error - video upload should still succeed even if client creation fails
      toast.warning(`Video uploaded successfully, but couldn't auto-create client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

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

    // Check subscription limits using application service
    if (!canUpload.canUpload) {
      toast.error(canUpload.reason || "Upload not allowed");
      return;
    }

    // Get file size limits based on subscription and platform constraints
    const maxFileSize = subscription.tier === 'premium' 
      ? FEATURES.RESUMABLE_UPLOAD_MAX_SIZE // 2GB for premium
      : FEATURES.RESUMABLE_UPLOAD_MAX_SIZE; // Also allow resumable for free users for files > 4MB

    // Validate file size based on subscription
    if (file.size > maxFileSize) {
      const maxSizeFormatted = formatFileSize(maxFileSize);
      const currentSizeFormatted = formatFileSize(file.size);
      
      toast.error(`File too large (${currentSizeFormatted}). Maximum file size is ${maxSizeFormatted}.`);
      return;
    }

    // Show warning for files that will use resumable upload
    if (file.size >= FEATURES.SIMPLE_UPLOAD_MAX_SIZE) {
      const currentSizeFormatted = formatFileSize(file.size);
      toast.info(`Large file detected (${currentSizeFormatted}). Will use resumable upload for better reliability.`);
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

    if (!authUser) {
      toast.error("Please sign in to upload videos");
      return;
    }

    if (!isReplacingVideo && !canUpload.canUpload) {
      toast.error(canUpload.reason || "Upload limit reached. Please upgrade to continue.");
      return;
    }

    const videoId = isReplacingVideo ? replaceVideoId : uuidv4();
    const fileName = `${videoId}.${selectedFile.name.split('.').pop()}`;

    const handleUploadSuccess = async (result: any) => {
      try {
        // Ensure user is still authenticated
        if (!authUser || !authUser.uid) {
          throw new Error('User not authenticated');
        }
        
        if (isReplacingVideo && originalVideo) {
          // Update existing video with new file data
          const updatedVideoData = {
            ...originalVideo,
            title: title.trim(),
            description: description.trim(),
            clientName: clientName.trim(),
            fileName: selectedFile.name,
            publicUrl: result.publicUrl || result.signedUrl || `https://storage.googleapis.com/${import.meta.env.VITE_GCS_BUCKET_NAME}/${result.gcsPath || fileName}`,
            size: selectedFile.size,
            contentType: selectedFile.type,
            uploadedAt: new Date(),
            gcsPath: result.gcsPath || result.fileName || fileName,
            version: (originalVideo.version || 1) + 1,
            // Reset approval status to draft for new version
            approvalStatus: 'draft' as const,
            revisionNotes: undefined // Clear previous revision notes
          };

          await saveGCSVideo(updatedVideoData);
          
          toast.success(`Video updated successfully! New version ${updatedVideoData.version} uploaded.`);
          
          // Navigate back to videos management
          setTimeout(() => {
            window.location.href = '/dashboard?tab=videos';
          }, 2000);
        } else {
          // Auto-create client if it doesn't exist (before saving video)
          await ensureClientExists(clientName.trim(), title.trim());
          
          // Generate security code for the video
          const securityCode = generateSecurityCode();
          
          // Prepare video data with all required fields
          const videoData = {
            id: videoId,
            title: title.trim(),
            description: description.trim(),
            clientName: clientName.trim(),
            userId: authUser.uid,
            fileName: selectedFile.name,
            publicUrl: result.publicUrl || result.signedUrl || `https://storage.googleapis.com/${import.meta.env.VITE_GCS_BUCKET_NAME}/${result.gcsPath || fileName}`,
            size: selectedFile.size,
            contentType: selectedFile.type,
            uploadedAt: new Date(),
            securityCode: securityCode,
            isActive: true,
            accessCount: 0,
            privacyStatus: 'private' as const,
            isPubliclyAccessible: false,
            isPublic: false,
            viewCount: 0,
            gcsPath: result.gcsPath || result.fileName || fileName,
            linkExpirationHours: 24, // Default 24 hours expiration
            linkExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
            // Approval workflow fields - start as draft
            approvalStatus: 'draft' as const,
            version: 1
          };

          // Validate data before saving
          const validatedData = validateVideoUploadData(videoData);
          
          console.log('Saving video data to Firestore:', {
            videoId: validatedData.id,
            userId: validatedData.userId,
            isActive: validatedData.isActive,
            hasRequiredFields: !!(validatedData.userId && validatedData.isActive)
          });
          
          console.log('About to save video data:', validatedData);
          console.log('Current user auth state:', {
            uid: authUser.uid,
            email: authUser.email,
            isAuthenticated: !!authUser
          });
          
          try {
            await saveGCSVideo(validatedData);
            console.log('Video data saved successfully to Firestore');
          } catch (firestoreError) {
            console.error('Firestore save failed:', firestoreError);
            throw new Error(`Firestore error: ${firestoreError.message}`);
          }
          
          try {
            await incrementVideoUpload();
            console.log('Video upload count incremented');
          } catch (incrementError) {
            console.error('Increment upload count failed:', incrementError);
            throw new Error(`Increment error: ${incrementError.message}`);
          }

          // Generate shareable link using video ID
          const shareUrl = `${window.location.origin}/watch/${videoId}`;
          
          // Copy to clipboard and show success message with share option
          try {
            await navigator.clipboard.writeText(shareUrl);
            toast.success("Video uploaded successfully! Share link copied to clipboard.", {
              action: {
                label: "Share",
                onClick: () => {
                  if (navigator.share) {
                    navigator.share({
                      title: title.trim(),
                      text: `Check out this video: ${title.trim()}`,
                      url: shareUrl
                    });
                  }
                }
              }
            });
          } catch (err) {
            toast.success(`Video uploaded successfully! Share link: ${shareUrl}`);
          }
        }

        setUploadSuccess(true);

        // Dispatch event for other components to refresh
        window.dispatchEvent(new CustomEvent("gcs-video-uploaded"));

        // Reset form
        setSelectedFile(null);
        if (!isReplacingVideo) {
          setTitle("");
          setDescription("");
          setClientName("");
        }
        resetUppyUpload();
        resetSimpleUpload();
      } catch (error: any) {
        console.error("Error saving video data:", error);
        console.error("Error details:", {
          message: error.message,
          code: error.code,
          stack: error.stack
        });
        
        // Check for billing-related errors
        if (error.code === 'UserProjectAccountProblem' || 
            error.message?.includes('billing account') ||
            error.message?.includes('absent billing')) {
          console.error('Billing error details:', {
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
            gcsProjectId: import.meta.env.VITE_GCS_PROJECT_ID,
            bucketName: import.meta.env.VITE_GCS_BUCKET_NAME,
            errorCode: error.code,
            errorMessage: error.message
          });
          toast.error("Service temporarily unavailable due to billing configuration. Please contact support.");
        } else if (error.code === 'permission-denied' || error.message?.includes('permission')) {
          toast.error("Permission denied. Please check your account permissions.");
        } else {
          toast.error(`Upload completed but failed to save video data: ${error.message || 'Unknown error'}. Please try again.`);
        }
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
      {/* Video Replacement Notice */}
      {isReplacingVideo && originalVideo && (
        <Alert>
          <RefreshCw className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p><strong>Replacing Video:</strong> {originalVideo.title}</p>
              <p><strong>Current Version:</strong> {originalVideo.version || 1}</p>
              <p><strong>New Version:</strong> {(originalVideo.version || 1) + 1}</p>
              <p className="text-sm text-muted-foreground">
                The new version will reset the approval status to "Draft" and require client review again.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

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
            </div>
            {subscription.tier === 'free' && (
              <PremiumPaymentModal>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Crown className="h-4 w-4" />
                  Upgrade to Premium
                </Button>
              </PremiumPaymentModal>
            )}
          </div>
          
          {!isReplacingVideo && !canUpload.canUpload && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {canUpload.reason}
                {canUpload.upgradeRequired && subscription.tier === 'free' && ' Upgrade to Premium for 50 uploads per month.'}
              </AlertDescription>
            </Alert>
          )}
          
          {isReplacingVideo && (
            <Alert className="mt-4">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Video replacement doesn't count against your upload limit.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isReplacingVideo ? <RefreshCw className="h-5 w-5" /> : <UploadIcon className="h-5 w-5" />}
            {isReplacingVideo ? 'Upload New Version' : 'Smart Video Upload'}
          </CardTitle>
          <CardDescription>
            {isReplacingVideo 
              ? `Uploading a new version of "${originalVideo?.title}". This will create version ${(originalVideo?.version || 1) + 1}.`
              : 'Upload videos with automatic optimization and smart method selection'
            }
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
                disabled={isUploading || !canUpload.canUpload}
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
                disabled={!title.trim() || !clientName.trim() || (!isReplacingVideo && !canUpload.canUpload)}
              >
                {isReplacingVideo ? <RefreshCw className="h-4 w-4 mr-2" /> : <UploadIcon className="h-4 w-4 mr-2" />}
                {isReplacingVideo ? 'Upload New Version' : 'Upload Video'}
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
    </div>
  );
};

export default SmartUploadSection;