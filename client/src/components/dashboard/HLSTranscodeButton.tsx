import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Film, CheckCircle, AlertCircle } from 'lucide-react';
import { hlsService } from '@/services/hlsService';
import { toast } from 'sonner';

interface HLSTranscodeButtonProps {
  videoId: string;
  gcsPath: string;
  onTranscodeComplete?: (hlsPath: string) => void;
  className?: string;
}

export const HLSTranscodeButton: React.FC<HLSTranscodeButtonProps> = ({
  videoId,
  gcsPath,
  onTranscodeComplete,
  className = ''
}) => {
  const [isTranscoding, setIsTranscoding] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [hasHLS, setHasHLS] = useState<boolean | null>(null);
  const [progress, setProgress] = useState<string>('');

  // Check if HLS version exists
  const checkHLSStatus = async () => {
    try {
      setIsChecking(true);
      const status = await hlsService.checkTranscodeStatus(videoId);
      setHasHLS(status.transcoded);
      
      if (status.transcoded) {
        toast.success('HLS version available');
      } else {
        toast.info('No HLS version found');
      }
    } catch (error) {
      console.error('Error checking HLS status:', error);
      toast.error('Failed to check HLS status');
    } finally {
      setIsChecking(false);
    }
  };

  // Start transcoding
  const startTranscode = async () => {
    try {
      setIsTranscoding(true);
      setProgress('Initializing...');

      const result = await hlsService.transcodeAndWait(
        { videoId, gcsPath },
        (message) => {
          setProgress(message);
        }
      );

      setHasHLS(true);
      toast.success('Video transcoded to HLS successfully!');
      onTranscodeComplete?.(result.hlsPath);
    } catch (error) {
      console.error('Transcode error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to transcode video');
    } finally {
      setIsTranscoding(false);
      setProgress('');
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Check Status Button */}
      <Button
        onClick={checkHLSStatus}
        disabled={isChecking || isTranscoding}
        variant="outline"
        size="sm"
      >
        {isChecking ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Checking...
          </>
        ) : hasHLS === true ? (
          <>
            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
            HLS Available
          </>
        ) : hasHLS === false ? (
          <>
            <AlertCircle className="h-4 w-4 mr-2 text-yellow-600" />
            No HLS
          </>
        ) : (
          <>
            <Film className="h-4 w-4 mr-2" />
            Check HLS
          </>
        )}
      </Button>

      {/* Transcode Button */}
      {hasHLS === false && (
        <Button
          onClick={startTranscode}
          disabled={isTranscoding}
          size="sm"
        >
          {isTranscoding ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {progress || 'Transcoding...'}
            </>
          ) : (
            <>
              <Film className="h-4 w-4 mr-2" />
              Convert to HLS
            </>
          )}
        </Button>
      )}
    </div>
  );
};

export default HLSTranscodeButton;
