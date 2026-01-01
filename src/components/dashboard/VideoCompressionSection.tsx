import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Upload, 
  Zap, 
  Clock, 
  HardDrive, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import { useVideoCompression } from '@/hooks/useVideoCompression';
import { formatFileSize, formatDuration } from '@/lib/utils';

interface VideoCompressionSectionProps {
  onCompressionComplete?: (compressedFile: File, originalFile: File) => void;
  onCompressionError?: (error: string) => void;
}

export function VideoCompressionSection({ 
  onCompressionComplete, 
  onCompressionError 
}: VideoCompressionSectionProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const {
    isCompressing,
    progress,
    error,
    result,
    estimatedTime,
    estimatedSize,
    compressVideo,
    cancelCompression,
    reset,
    shouldCompress,
    getEstimate
  } = useVideoCompression();

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('video/')) {
      onCompressionError?.('Please select a video file');
      return;
    }

    if (file.size > 2 * 1024 * 1024 * 1024) { // 2GB limit
      onCompressionError?.('File size must be less than 2GB');
      return;
    }

    setSelectedFile(file);
    reset();
  }, [reset, onCompressionError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const startCompression = useCallback(async () => {
    if (!selectedFile) return;

    try {
      const compressedResult = await compressVideo(selectedFile);
      onCompressionComplete?.(compressedResult.compressedFile, selectedFile);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Compression failed';
      onCompressionError?.(errorMessage);
    }
  }, [selectedFile, compressVideo, onCompressionComplete, onCompressionError]);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    reset();
  }, [reset]);

  const renderFileInfo = () => {
    if (!selectedFile) return null;

    const needsCompression = shouldCompress(selectedFile);
    const estimate = getEstimate(selectedFile.size);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">{selectedFile.name}</h4>
            <p className="text-sm text-muted-foreground">
              {formatFileSize(selectedFile.size)}
            </p>
          </div>
          <Badge variant={needsCompression ? "secondary" : "outline"}>
            {needsCompression ? "Will Compress" : "Skip Compression"}
          </Badge>
        </div>

        {needsCompression && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span>Est. Size: {formatFileSize(estimate.estimatedSize)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Est. Time: {formatDuration(estimate.estimatedTime)}</span>
            </div>
          </div>
        )}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {needsCompression 
              ? "This video will be compressed to draft quality (720p, optimized for faster uploads)"
              : "Small files don't need compression and will upload directly"
            }
          </AlertDescription>
        </Alert>
      </div>
    );
  };

  const renderCompressionProgress = () => {
    if (!isCompressing && !result) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">
            {isCompressing ? 'Compressing Video...' : 'Compression Complete'}
          </h4>
          {result && (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              Complete
            </Badge>
          )}
        </div>

        <Progress value={progress} className="w-full" />
        
        <div className="text-sm text-muted-foreground">
          {isCompressing ? (
            <div className="flex justify-between">
              <span>{progress}% complete</span>
              {estimatedTime && (
                <span>~{formatDuration(estimatedTime * (1 - progress / 100))} remaining</span>
              )}
            </div>
          ) : result && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-medium">Original:</span> {formatFileSize(result.originalSize)}
              </div>
              <div>
                <span className="font-medium">Compressed:</span> {formatFileSize(result.compressedSize)}
              </div>
              <div>
                <span className="font-medium">Reduction:</span> {result.compressionRatio.toFixed(1)}%
              </div>
              <div>
                <span className="font-medium">Time:</span> {formatDuration(result.duration)}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Video Compression
        </CardTitle>
        <CardDescription>
          Compress videos for faster uploads while maintaining good quality
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* File Drop Zone */}
        {!selectedFile && (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Select Video File</h3>
            <p className="text-muted-foreground mb-4">
              Drag and drop a video file here, or click to browse
            </p>
            <input
              type="file"
              accept="video/*"
              onChange={handleFileInputChange}
              className="hidden"
              id="video-file-input"
            />
            <Button asChild variant="outline">
              <label htmlFor="video-file-input" className="cursor-pointer">
                Browse Files
              </label>
            </Button>
          </div>
        )}

        {/* File Info */}
        {selectedFile && !isCompressing && !result && renderFileInfo()}

        {/* Compression Progress */}
        {renderCompressionProgress()}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {selectedFile && !isCompressing && !result && (
            <>
              <Button onClick={startCompression} className="flex-1">
                <Play className="h-4 w-4 mr-2" />
                {shouldCompress(selectedFile) ? 'Compress Video' : 'Use Original'}
              </Button>
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </>
          )}

          {isCompressing && (
            <Button variant="outline" onClick={cancelCompression} className="flex-1">
              <Pause className="h-4 w-4 mr-2" />
              Cancel Compression
            </Button>
          )}

          {result && (
            <Button variant="outline" onClick={handleReset} className="flex-1">
              <RotateCcw className="h-4 w-4 mr-2" />
              Compress Another
            </Button>
          )}
        </div>

        {/* Compression Info */}
        <Separator />
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Videos larger than 50MB will be compressed to 720p draft quality</p>
          <p>• Compression happens in your browser - files never leave your device</p>
          <p>• Original files remain untouched on your device</p>
          <p>• Compressed videos upload faster and use less storage</p>
        </div>
      </CardContent>
    </Card>
  );
}