import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { hlsService } from '@/services/hlsService';
import { Badge } from '@/components/ui/badge';

interface HLSTranscodingStatusProps {
  videoId: string;
  autoCheck?: boolean;
  onComplete?: (hlsPath: string) => void;
  className?: string;
}

export const HLSTranscodingStatus: React.FC<HLSTranscodingStatusProps> = ({
  videoId,
  autoCheck = true,
  onComplete,
  className = ''
}) => {
  const [status, setStatus] = useState<'checking' | 'queued' | 'processing' | 'completed' | 'failed' | 'not-found'>('checking');
  const [progress, setProgress] = useState<number>(0);
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    if (!autoCheck) return;

    let intervalId: NodeJS.Timeout;

    const checkStatus = async () => {
      try {
        const result = await hlsService.checkTranscodeStatus(videoId);
        
        if (result.transcoded) {
          setStatus('completed');
          setProgress(100);
          setMessage('HLS version ready');
          onComplete?.(result.hlsPath || '');
          clearInterval(intervalId);
        } else {
          // Check queue status
          try {
            const queueStatus = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/hls/queue/status/${videoId}`, {
              headers: {
                'Authorization': `Bearer ${await (await import('firebase/auth')).getAuth().currentUser?.getIdToken()}`
              }
            }).then(r => r.json());

            if (queueStatus.success) {
              setStatus(queueStatus.status);
              setProgress(queueStatus.progress || 0);
              setMessage(queueStatus.message || '');
            } else {
              setStatus('not-found');
            }
          } catch {
            setStatus('not-found');
          }
        }
      } catch (error) {
        console.error('Error checking HLS status:', error);
        setStatus('failed');
      }
    };

    // Check immediately
    checkStatus();

    // Poll every 5 seconds if not completed
    intervalId = setInterval(() => {
      if (status !== 'completed' && status !== 'failed') {
        checkStatus();
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [videoId, autoCheck, status, onComplete]);

  const getStatusBadge = () => {
    switch (status) {
      case 'checking':
        return (
          <Badge variant="secondary" className={className}>
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Checking...
          </Badge>
        );
      case 'queued':
        return (
          <Badge variant="secondary" className={className}>
            <Clock className="h-3 w-3 mr-1" />
            Queued for transcoding
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="secondary" className={className}>
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Transcoding {progress > 0 ? `${progress}%` : '...'}
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="default" className={`${className} bg-green-600`}>
            <CheckCircle className="h-3 w-3 mr-1" />
            HLS Ready
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className={className}>
            <AlertCircle className="h-3 w-3 mr-1" />
            Transcoding failed
          </Badge>
        );
      case 'not-found':
        return (
          <Badge variant="outline" className={className}>
            <AlertCircle className="h-3 w-3 mr-1" />
            Not transcoded
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {getStatusBadge()}
      {message && status === 'processing' && (
        <span className="text-xs text-muted-foreground">{message}</span>
      )}
    </div>
  );
};

export default HLSTranscodingStatus;
