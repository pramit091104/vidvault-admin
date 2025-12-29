import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  RotateCcw, 
  Trash2, 
  Clock, 
  FileVideo, 
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useUploadResumption } from '@/hooks/useUploadResumption';
import { ResumableUpload } from '@/lib/uploadSessionManager';

interface UploadResumptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResumeUpload?: (sessionId: string) => void;
  onStartFreshUpload?: (sessionId: string) => void;
}

export function UploadResumptionDialog({
  open,
  onOpenChange,
  onResumeUpload,
  onStartFreshUpload
}: UploadResumptionDialogProps) {
  const {
    resumableUploads,
    hasResumableUploads,
    hasExpiredUploads,
    cancelSession,
    isResuming,
    resumeError,
    refreshResumableUploads
  } = useUploadResumption();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [resumingSessionId, setResumingSessionId] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleResumeUpload = async (upload: ResumableUpload) => {
    if (!selectedFile) {
      toast.error('Please select a file to resume the upload');
      return;
    }

    setResumingSessionId(upload.sessionId);
    
    try {
      // Verify file matches
      if (selectedFile.name !== upload.state.fileName || selectedFile.size !== upload.state.totalSize) {
        toast.error('Selected file does not match the original upload');
        return;
      }

      onResumeUpload?.(upload.sessionId);
      toast.success(`Resuming upload: ${upload.state.fileName}`);
      onOpenChange(false);
    } catch (error) {
      console.error('Error resuming upload:', error);
      toast.error('Failed to resume upload');
    } finally {
      setResumingSessionId(null);
    }
  };

  const handleStartFresh = (upload: ResumableUpload) => {
    if (!selectedFile) {
      toast.error('Please select a file to start a fresh upload');
      return;
    }

    try {
      onStartFreshUpload?.(upload.sessionId);
      toast.success(`Starting fresh upload for: ${upload.state.fileName}`);
      onOpenChange(false);
    } catch (error) {
      console.error('Error starting fresh upload:', error);
      toast.error('Failed to start fresh upload');
    }
  };

  const handleCancelUpload = (upload: ResumableUpload) => {
    try {
      cancelSession(upload.sessionId);
      toast.success(`Cancelled upload: ${upload.state.fileName}`);
      refreshResumableUploads();
    } catch (error) {
      console.error('Error cancelling upload:', error);
      toast.error('Failed to cancel upload');
    }
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (!hasResumableUploads && !hasExpiredUploads) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileVideo className="h-5 w-5" />
            Resume Uploads
          </DialogTitle>
          <DialogDescription>
            You have incomplete uploads. Select a file and choose to resume or restart your uploads.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Select File</CardTitle>
              <CardDescription>
                Choose the file you want to resume uploading
              </CardDescription>
            </CardHeader>
            <CardContent>
              <input
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="w-full p-2 border border-border rounded-md bg-background"
              />
              {selectedFile && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </div>
              )}
            </CardContent>
          </Card>

          {/* Error Display */}
          {resumeError && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">{resumeError}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resumable Uploads */}
          {hasResumableUploads && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Resumable Uploads</h3>
              {resumableUploads
                .filter(upload => !upload.isExpired)
                .map(upload => (
                  <Card key={upload.sessionId} className="border-primary/20">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{upload.state.fileName}</h4>
                            <Badge variant="secondary">
                              {upload.state.status}
                            </Badge>
                          </div>
                          
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div>Size: {formatFileSize(upload.state.totalSize)}</div>
                            <div>Client: {upload.state.metadata?.clientName || 'Unknown'}</div>
                            <div>Started: {formatDate(upload.state.createdAt)}</div>
                            <div>Last Updated: {formatDate(upload.state.updatedAt)}</div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Progress</span>
                              <span>{upload.progress}%</span>
                            </div>
                            <Progress value={upload.progress} className="h-2" />
                            <div className="text-xs text-muted-foreground">
                              {upload.state.uploadedChunks.length} of {upload.state.totalChunks} chunks uploaded
                              {upload.remainingChunks > 0 && ` • ${upload.remainingChunks} remaining`}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 ml-4">
                          <Button
                            size="sm"
                            onClick={() => handleResumeUpload(upload)}
                            disabled={!selectedFile || isResuming || resumingSessionId === upload.sessionId}
                            className="w-24"
                          >
                            {resumingSessionId === upload.sessionId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-1" />
                                Resume
                              </>
                            )}
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancelUpload(upload)}
                            className="w-24"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}

          {/* Expired Uploads */}
          {hasExpiredUploads && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                Expired Uploads
              </h3>
              <p className="text-sm text-muted-foreground">
                These uploads are older than 24 hours. You can start fresh uploads with the same settings.
              </p>
              
              {resumableUploads
                .filter(upload => upload.isExpired)
                .map(upload => (
                  <Card key={upload.sessionId} className="border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-900/10">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{upload.state.fileName}</h4>
                            <Badge variant="outline" className="border-orange-300 text-orange-700">
                              Expired
                            </Badge>
                          </div>
                          
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div>Size: {formatFileSize(upload.state.totalSize)}</div>
                            <div>Client: {upload.state.metadata?.clientName || 'Unknown'}</div>
                            <div>Started: {formatDate(upload.state.createdAt)}</div>
                            <div>Progress: {upload.progress}% ({upload.state.uploadedChunks.length}/{upload.state.totalChunks} chunks)</div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartFresh(upload)}
                            disabled={!selectedFile}
                            className="w-24"
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Restart
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancelUpload(upload)}
                            className="w-24"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}