import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Zap, Upload as UploadIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import UploadSection from "./UploadSection"; // Your existing upload component
import UppyUploadSection from "./UppyUploadSection"; // New Uppy component
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/integrations/firebase/config";

const SmartUploadSection = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<'simple' | 'uppy' | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setUploadMode(null);
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
      alert("Invalid file type. Please select a supported video format.");
      return;
    }

    setSelectedFile(file);

    // Auto-select upload mode based on file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB < 100) { // Use simple upload for files < 100MB
      setUploadMode('simple');
    } else { // Use Uppy for files >= 100MB
      setUploadMode('uppy');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadIcon className="h-5 w-5" />
            Smart Video Upload
          </CardTitle>
          <CardDescription>
            We'll automatically choose the best upload method for your file size
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="smart-file-select">Select Video File</Label>
              <Input
                id="smart-file-select"
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
              />
            </div>

            {selectedFile && uploadMode && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <div>
                    <strong>{selectedFile.name}</strong>
                    <br />
                    Size: {formatFileSize(selectedFile.size)}
                    <br />
                    {uploadMode === 'simple' ? (
                      <>Using <strong>Simple Upload</strong> (faster for smaller files)</>
                    ) : (
                      <>Using <strong>Resumable Upload</strong> (reliable for large files)</>
                    )}
                  </div>
                  <Badge variant={uploadMode === 'simple' ? "default" : "secondary"} className="flex items-center gap-1">
                    {uploadMode === 'uppy' && <Zap className="h-3 w-3" />}
                    {uploadMode === 'simple' ? 'Simple' : 'Resumable'}
                  </Badge>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Show appropriate upload component based on file size */}
      {uploadMode === 'simple' && (
        <div>
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Simple Upload Mode</strong> - Optimized for files under 100MB
            </p>
          </div>
          <UploadSection preSelectedFile={selectedFile} />
        </div>
      )}

      {uploadMode === 'uppy' && (
        <div>
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Resumable Upload Mode</strong> - Handles large files with pause/resume support
            </p>
          </div>
          <UppyUploadSection preSelectedFile={selectedFile} />
        </div>
      )}

      {!selectedFile && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <UploadIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a video file to begin upload</p>
              <p className="text-sm mt-2">
                Files under 100MB will use simple upload, larger files will use resumable upload
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SmartUploadSection;