# Video Compression Service

## Overview

The Video Compression Service provides video analysis and compression capabilities for the video upload optimization system. It supports both full FFmpeg-based compression and fallback mode for environments where FFmpeg is not available.

## Features

- **Video Analysis**: Analyzes video files to determine format, resolution, bitrate, and compression needs
- **Compression**: Compresses videos with configurable quality settings
- **Progress Tracking**: Real-time compression progress updates
- **Fallback Mode**: Works without FFmpeg by providing basic analysis and file copying
- **Automatic Cleanup**: Manages temporary files automatically

## API Endpoints

### GET /api/video/compression-status
Returns the current status of the compression service.

**Response:**
```json
{
  "available": true,
  "version": "Fallback mode (FFmpeg not installed)",
  "error": "FFmpeg not available - compression will use fallback mode"
}
```

### POST /api/video/analyze
Analyzes a video file to determine its properties and compression recommendations.

**Request:**
- `video`: Video file (multipart/form-data)

**Response:**
```json
{
  "success": true,
  "analysis": {
    "duration": 120,
    "resolution": { "width": 1920, "height": 1080 },
    "bitrate": 5000,
    "codec": "h264",
    "size": 52428800,
    "needsCompression": true
  },
  "recommendations": {
    "maxResolution": { "width": 1920, "height": 1080 },
    "maxBitrate": 8000,
    "codec": "libx264",
    "quality": 23
  }
}
```

### POST /api/video/compress
Compresses a video file with optional custom settings.

**Request:**
- `video`: Video file (multipart/form-data)
- `options`: JSON string with compression options (optional)

**Response:**
```json
{
  "success": true,
  "result": {
    "success": true,
    "originalSize": 52428800,
    "compressedSize": 31457280,
    "compressionRatio": 0.6,
    "fileName": "compressed_1640995200000_video.mp4",
    "compressedData": "base64-encoded-data",
    "error": null
  }
}
```

## Frontend Integration

### React Hook: useVideoCompression

```typescript
import { useVideoCompression } from '@/hooks/useVideoCompression';

function VideoUploadComponent() {
  const {
    analyzeVideo,
    compressVideo,
    isAnalyzing,
    isCompressing,
    analysis,
    progress,
    error
  } = useVideoCompression();

  const handleFileSelect = async (file: File) => {
    try {
      await analyzeVideo(file);
      
      if (analysis?.needsCompression) {
        const result = await compressVideo(file);
        console.log('Compression complete:', result);
      }
    } catch (err) {
      console.error('Compression failed:', err);
    }
  };

  return (
    <div>
      {isAnalyzing && <p>Analyzing video...</p>}
      {isCompressing && <p>Compressing: {progress?.percent}%</p>}
      {error && <p>Error: {error}</p>}
    </div>
  );
}
```

### Video Compression Dialog

```typescript
import { VideoCompressionDialog } from '@/components/video/VideoCompressionDialog';

function UploadPage() {
  const [showCompressionDialog, setShowCompressionDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleCompressionComplete = (result) => {
    console.log('Compression result:', result);
    // Continue with upload using compressed file
  };

  return (
    <VideoCompressionDialog
      open={showCompressionDialog}
      onOpenChange={setShowCompressionDialog}
      file={selectedFile}
      onCompressionComplete={handleCompressionComplete}
      onCompressionSkip={() => setShowCompressionDialog(false)}
    />
  );
}
```

## Configuration

### Default Compression Settings

```typescript
const defaultOptions = {
  maxResolution: { width: 1920, height: 1080 },
  maxBitrate: 8000, // 8Mbps in kbps
  codec: 'libx264',
  quality: 23 // CRF value for x264
};
```

### Compression Thresholds

- Files larger than 50MB are recommended for compression
- Videos with resolution > 1080p are compressed to 1080p
- Videos with bitrate > 8Mbps are reduced to 8Mbps maximum

## FFmpeg Installation (Optional)

For full compression capabilities, install FFmpeg:

### Windows
```bash
# Using Chocolatey
choco install ffmpeg

# Or download from https://ffmpeg.org/download.html
```

### macOS
```bash
# Using Homebrew
brew install ffmpeg
```

### Linux
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install ffmpeg

# CentOS/RHEL
sudo yum install ffmpeg
```

## Error Handling

The service includes comprehensive error handling:

1. **FFmpeg Not Available**: Falls back to basic analysis and file copying
2. **File Analysis Errors**: Provides estimated properties based on file size
3. **Compression Failures**: Returns original file with warning message
4. **Network Errors**: Proper error responses with descriptive messages

## Performance Considerations

- Temporary files are stored in `./temp` directory
- Automatic cleanup prevents disk space issues
- Progress tracking for long-running compressions
- Configurable quality settings for size vs. quality trade-offs

## Requirements Validation

This implementation satisfies the following requirements:

- **2.1**: Video analysis for format and resolution detection ✅
- **2.2**: Compression to 1080p while maintaining aspect ratio ✅
- **2.3**: Bitrate reduction to 8Mbps maximum ✅
- **2.4**: Compression progress tracking ✅
- **2.5**: Fallback handling when compression fails ✅