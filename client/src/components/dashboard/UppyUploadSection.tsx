import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, CheckCircle2, Pause, Play, X, Zap, Cloud, Crown, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useUppyUpload } from "@/hooks/useUppyUpload";
import { saveGCSVideo } from "@/integrations/firebase/videoService";
import { useAuth } from "@/contexts/AuthContext";
import { v4 as uuidv4 } from 'uuid';
import { PremiumPaymentModal } from "@/components/payment/PremiumPaymentModal";
import { applicationService } from "@/services";

interface UppyUploadSectionProps {
  preSelectedFile?: File | null;
}

const UppyUploadSection = ({ preSelectedFile }: UppyUploadSectionProps = {}) => {
  const [file, setFile] = useState<File | null>(preSelectedFile || null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [canUpload, setCanUpload] = useState<{
    canUpload: boolean;
    reason?: string;
    upgradeRequired?: boolean;
  }>({ canUpload: true });
  const [usageStats, setUsageStats] = useState<{
    uploadCount: number;
    maxUploads: number;
    clientsUsed: number;
    maxClients: number;
    tier: string;
    isActive: boolean;
  } | null>(null);
  
  const { currentUser, subscription } = useAuth();

  const {
    isUploading,
    uploadProgress,
    uploadSpeed,
    currentChunk,
    totalChunks,
    error: uploadError,
    result: uploadResult,
    startUpload,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    reset: resetUpload,
    isPaused
  } = useUppyUpload();

  // Check upload permissions and load usage stats using application service
  useEffect(() => {
    const loadUploadData = async () => {
      if (!currentUser?.uid) {
        setCanUpload({ canUpload: false, reason: 'Please sign in to upload videos' });
        return;
      }

      try {
        // Check upload permissions
        const uploadPermission = await applicationService.canUserUpload(currentUser.uid);
        setCanUpload(uploadPermission);

        // Load usage statistics
        const stats = await applicationService.getUserUsageStats(currentUser.uid);
        setUsageStats(stats);
      } catch (error) {
        console.error('Error loading upload data:', error);
        setCanUpload({ 
          canUpload: false, 
          reason: 'Error checking upload permissions',
          upgradeRequired: false 
        });
      }
    };

    loadUploadData();
  }, [currentUser?.uid, subscription]);

  useEffect(() => {
    if (preSelectedFile) {
      setFile(preSelectedFile);
      if (!title) {
        setTitle(preSelectedFile.name.replace(/\.[^/.]+$/, ""));
      }
    }
  }, [preSelectedFile, title]);

  // Handle upload success
  useEffect(() => {
    if (uploadResult && uploadResult.success) {
      handleUploadSuccess();
    }
  }, [uploadResult]);

  // Handle upload error
  useEffect(() => {
    if (uploadError) {
      toast.error(uploadError);
    }
  }, [uploadError]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Validate file type
      const allowedTypes = [
        "video/mp4", "video/mpeg", "video/quicktime",
        "video/x-msvideo", "video/webm", "video/ogg", "video/x-matroska"
      ];
      const allowedExts = ["mp4", "mov", "avi", "wmv", "flv", "webm", "mkv", "ogg"];
      const ext = selectedFile.name.split('.').pop()?.toLowerCase() || "";
      
      if (!allowedTypes.includes(selectedFile.type) && !allowedExts.includes(ext)) {
        toast.error("Invalid file type. Please select a supported video format.");
        return;
      }
      
      // Basic size check for UI feedback (backend will do the real validation)
      const maxSize = (usageStats?.maxFileSize || subscription.maxFileSize) * 1024 * 1024; // Convert MB to bytes
      if (selectedFile.size > maxSize) {
        const tier = usageStats?.tier || subscription.tier;
        const maxFileSize = usageStats?.maxFileSize || subscription.maxFileSize;
        toast.error(`File size exceeds the ${maxFileSize}MB limit for ${tier} users. ${tier === 'free' ? 'Upgrade to Premium for larger file uploads.' : 'Please compress your video first.'}`);
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
      toast.error("Please select a video file");
      return;
    }

    if (!title.trim()) {
      toast.error("Please enter a video title");
      return;
    }

    if (!clientName.trim()) {
      toast.error("Please enter a client name");
      return;
    }

    if (!currentUser) {
      toast.error("Please sign in to upload videos");
      return;
    }

    if (!canUpload.canUpload) {
      toast.error(canUpload.reason || "Upload not allowed");
      return;
    }

    // Backend will handle all validation including upload limits
    try {
      await startUpload({
        file,
        metadata: {
          title: title.trim(),
          description: description.trim(),
          clientName: clientName.trim()
        },
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Upload failed');
    }
  };

  const handleUploadSuccess = async () => {
    if (!uploadResult || !currentUser) return;

    try {
      // Backend already incremented upload count, just update local state
      // Note: In a real app, you'd want to refetch subscription data from the server
      
      // Save metadata to Firestore
      const videoId = uuidv4();
      const securityCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      await saveGCSVideo({
        id: videoId,
        title: title.trim(),
        description: description.trim(),
        clientName: clientName.trim(),
        fileName: uploadResult.fileName,
        publicUrl: uploadResult.gcsPath, // Store the GCS path for now - will be used to generate signed URLs
        size: uploadResult.fileSize,
        contentType: file?.type || 'video/mp4',
        userId: currentUser.uid,
        securityCode: securityCode,
        isActive: true,
        accessCount: 0,
        privacyStatus: 'private',
        isPubliclyAccessible: false,
        uploadedAt: new Date(),
        // Store the actual GCS path for signed URL generation
        gcsPath: uploadResult.gcsPath,
        // Approval workflow fields - start as draft
        approvalStatus: 'draft',
        version: 1
      } as any);

      setUploadSuccess(true);
      toast.success("Video uploaded successfully!");

      // Reset form after 3 seconds
      setTimeout(() => {
        resetForm();
      }, 3000);

    } catch (error: any) {
      console.error('Error saving video metadata:', error);
      toast.error('Upload succeeded but failed to save metadata');
    }
  };

  const resetForm = () => {
    setFile(null);
    setTitle("");
    setDescription("");
    setClientName("");
    setUploadSuccess(false);
    resetUpload();
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond === 0) return '0 B/s';
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const k = 1024;
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    return `${(bytesPerSecond / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
  };

  const calculateETA = (): string => {
    if (uploadSpeed === 0 || !file) return 'Calculating...';
    const remainingBytes = file.size * (1 - uploadProgress / 100);
    const remainingSeconds = remainingBytes / uploadSpeed;
    
    if (remainingSeconds < 60) return `${Math.round(remainingSeconds)}s`;
    if (remainingSeconds < 3600) return `${Math.round(remainingSeconds / 60)}m`;
    return `${Math.round(remainingSeconds / 3600)}h`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Upload Video (Uppy - Resumable)
            </CardTitle>
            <CardDescription>
              Upload videos (up to {usageStats?.maxFileSize || subscription.maxFileSize}MB for {usageStats?.tier || subscription.tier} users) with resumable upload support
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Resumable
            </Badge>
            <Badge 
              variant={(usageStats?.tier || subscription.tier) === 'premium' ? 'default' : 'secondary'} 
              className={`flex items-center gap-1 ${(usageStats?.tier || subscription.tier) === 'premium' ? 'bg-purple-500 hover:bg-purple-600' : ''}`}
            >
              {(usageStats?.tier || subscription.tier) === 'premium' && <Crown className="h-3 w-3" />}
              {(usageStats?.tier || subscription.tier).toUpperCase()}
            </Badge>
          </div>
        </div>
        
        {/* Subscription Status */}
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Upload Usage</span>
            {(usageStats?.tier || subscription.tier) === 'free' && (
              <PremiumPaymentModal>
                <Button 
                  size="sm" 
                  className="bg-purple-500 hover:bg-purple-600 text-white"
                >
                  <Crown className="h-3 w-3 mr-1" />
                  Upgrade
                </Button>
              </PremiumPaymentModal>
            )}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Progress 
              value={((usageStats?.uploadCount || subscription.videoUploadsUsed) / (usageStats?.maxUploads || subscription.maxVideoUploads)) * 100} 
              className="flex-1 h-2" 
            />
            <span className="text-sm text-muted-foreground">
              {usageStats?.uploadCount || subscription.videoUploadsUsed}/{usageStats?.maxUploads || subscription.maxVideoUploads}
            </span>
          </div>
          {(usageStats?.uploadCount || subscription.videoUploadsUsed) >= (usageStats?.maxUploads || subscription.maxVideoUploads) && (
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Upload limit reached. {(usageStats?.tier || subscription.tier) === 'free' ? 'Upgrade to continue uploading.' : 'Limit resets monthly.'}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isUploading && !uploadSuccess && (
          <>
            <div className="space-y-2">
              <Label htmlFor="video-file">Video File</Label>
              <Input
                id="video-file"
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                disabled={isUploading}
              />
              {file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {file.name} ({formatFileSize(file.size)})
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Video Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter video title"
                disabled={isUploading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter video description"
                disabled={isUploading}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-name">Client Name</Label>
              <Input
                id="client-name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Enter client name"
                disabled={isUploading}
              />
            </div>

            <Button
              onClick={handleUpload}
              disabled={!file || isUploading || !currentUser || !canUpload.canUpload}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              Start Upload
            </Button>
          </>
        )}

        {isUploading && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Upload Progress</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Upload Speed</p>
                <p className="font-medium">{formatSpeed(uploadSpeed)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Time Remaining</p>
                <p className="font-medium">{calculateETA()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Chunks</p>
                <p className="font-medium">{currentChunk} / {totalChunks}</p>
              </div>
              <div>
                <p className="text-muted-foreground">File Size</p>
                <p className="font-medium">{file ? formatFileSize(file.size) : '-'}</p>
              </div>
            </div>

            <Separator />

            <div className="flex gap-2">
              {!isPaused ? (
                <Button onClick={pauseUpload} variant="outline" className="flex-1">
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </Button>
              ) : (
                <Button onClick={resumeUpload} variant="outline" className="flex-1">
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </Button>
              )}
              <Button onClick={cancelUpload} variant="destructive" className="flex-1">
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {uploadSuccess && (
          <div className="text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">Upload Successful!</h3>
              <p className="text-sm text-muted-foreground">
                Your video has been uploaded successfully
              </p>
            </div>
            <Button onClick={resetForm} variant="outline">
              Upload Another Video
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UppyUploadSection;
