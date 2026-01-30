import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, AlertCircle, Loader2, FileVideo, Zap } from 'lucide-react';
import { videoCompressionService, CompressionProgress } from '@/services/videoCompressionService';
import { VideoAnalysis, CompressionOptions, CompressionResult } from '@/services/compressionService';

interface VideoCompressionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  onCompressionComplete: (result: CompressionResult & { compressedFile?: File }) => void;
  onCompressionSkip: () => void;
}

export function VideoCompressionDialog({
  open,
  onOpenChange,
  file,
  onCompressionComplete,
  onCompressionSkip
}: VideoCompressionDialogProps) {
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [recommendations, setRecommendations] = useState<CompressionOptions | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState<CompressionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null);

  useEffect(() => {
    if (open && file) {
      analyzeVideo();
    } else {
      resetState();
    }
  }, [open, file]);

  const resetState = () => {
    setAnalysis(null);
    setRecommendations(null);
    setIsAnalyzing(false);
    setIsCompressing(false);
    setProgress(null);
    setError(null);
    setCompressionResult(null);
  };

  const analyzeVideo = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await videoCompressionService.analyzeVideo(file);
      setAnalysis(result.analysis);
      setRecommendations(result.recommendations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCompress = async () => {
    if (!file || !recommendations) return;

    setIsCompressing(true);
    setError(null);

    try {
      const result = await videoCompressionService.compressVideo(
        file,
        recommendations,
        (progressData) => setProgress(progressData)
      );
      
      setCompressionResult(result);
      onCompressionComplete(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compression failed');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSkip = () => {
    onCompressionSkip();
    onOpenChange(false);
  };

  const formatFileSize = (bytes: number) => {
    return videoCompressionService.formatFileSize(bytes);
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getSavingsInfo = () => {
    if (!analysis || !compressionResult) return null;
    
    return videoCompressionService.calculateSavings(
      analysis.size,
      compressionResult.compressedSize || analysis.size
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileVideo className="h-5 w-5" />
            Video Compression
          </DialogTitle>
          <DialogDescription>
            Optimize your video for faster uploads and better performance
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Info */}
          {file && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">File Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{file.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Size:</span>
                  <span className="font-medium">{formatFileSize(file.size)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium">{file.type}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Analysis Results */}
          {isAnalyzing && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analyzing video...</span>
                </div>
              </CardContent>
            </Card>
          )}

          {analysis && recommendations && !isCompressing && !compressionResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Analysis Complete
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Resolution:</span>
                    <div className="font-medium">
                      {analysis.resolution.width} × {analysis.resolution.height}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Duration:</span>
                    <div className="font-medium">{formatDuration(analysis.duration)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Bitrate:</span>
                    <div className="font-medium">{Math.round(analysis.bitrate)} kbps</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Codec:</span>
                    <div className="font-medium">{analysis.codec}</div>
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-blue-500" />
                    <span className="font-medium text-sm">Compression Recommendations</span>
                  </div>
                  
                  {analysis.needsCompression ? (
                    <div className="space-y-2">
                      <Badge variant="secondary" className="mb-2">
                        Compression Recommended
                      </Badge>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>• Target resolution: {recommendations.maxResolution.width} × {recommendations.maxResolution.height}</div>
                        <div>• Target bitrate: {recommendations.maxBitrate} kbps</div>
                        <div>• Estimated size reduction: 30-60%</div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Badge variant="outline" className="mb-2">
                        Already Optimized
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        Your video is already well-optimized. Compression may not provide significant benefits.
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Compression Progress */}
          {isCompressing && progress && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="font-medium">Compressing video...</span>
                  </div>
                  <Progress value={progress.percent} className="w-full" />
                  <div className="text-sm text-muted-foreground">
                    {progress.message} ({Math.round(progress.percent)}%)
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Compression Results */}
          {compressionResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Compression Complete
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const savings = getSavingsInfo();
                  return savings ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Original size:</span>
                        <span>{formatFileSize(compressionResult.originalSize)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Compressed size:</span>
                        <span>{formatFileSize(compressionResult.compressedSize || 0)}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span className="text-green-600">Space saved:</span>
                        <span className="text-green-600">
                          {formatFileSize(savings.savedBytes)} ({Math.round(savings.savedPercentage)}%)
                        </span>
                      </div>
                    </div>
                  ) : null;
                })()}
              </CardContent>
            </Card>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleSkip}>
              Skip Compression
            </Button>
            
            {analysis && recommendations && !compressionResult && (
              <Button 
                onClick={handleCompress} 
                disabled={isCompressing}
                className="min-w-[120px]"
              >
                {isCompressing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Compressing...
                  </>
                ) : (
                  'Compress Video'
                )}
              </Button>
            )}

            {compressionResult && (
              <Button onClick={() => onOpenChange(false)}>
                Continue with Upload
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}