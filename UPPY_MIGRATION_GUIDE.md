# Migration Guide: Integrating Uppy Upload into Existing Dashboard

## 🎯 Overview

This guide helps you integrate the new Uppy-based resumable upload system into your existing dashboard alongside the current upload implementation.

## 📋 Migration Strategy

### Option 1: Side-by-Side (Recommended)
Keep both upload systems and let users choose based on file size:
- **Simple Upload**: Files < 50MB (existing system)
- **Uppy Upload**: Files > 50MB (new system)

### Option 2: Full Replacement
Replace the existing upload system entirely with Uppy.

### Option 3: Gradual Migration
Start with Uppy for new uploads, keep existing for legacy support.

## 🔧 Implementation Steps

### Step 1: Add Uppy Component to Dashboard

**File**: `src/pages/Dashboard.tsx` or your main dashboard file

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UploadSection from "@/components/dashboard/UploadSection"; // Existing
import UppyUploadSection from "@/components/dashboard/UppyUploadSection"; // New

function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Other dashboard content */}
      
      <Tabs defaultValue="simple" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="simple">
            Simple Upload (< 50MB)
          </TabsTrigger>
          <TabsTrigger value="resumable">
            Resumable Upload (> 50MB)
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="simple">
          <UploadSection />
        </TabsContent>
        
        <TabsContent value="resumable">
          <UppyUploadSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Step 2: Add Smart File Size Detection

**File**: `src/components/dashboard/SmartUploadSection.tsx`

```tsx
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import UploadSection from "./UploadSection";
import UppyUploadSection from "./UppyUploadSection";

const SmartUploadSection = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<'simple' | 'resumable' | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    // Auto-select upload mode based on file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB < 50) {
      setUploadMode('simple');
    } else {
      setUploadMode('resumable');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Select Video File</CardTitle>
          <CardDescription>
            We'll automatically choose the best upload method for your file
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="smart-file-select">Video File</Label>
            <Input
              id="smart-file-select"
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
            />
          </div>

          {selectedFile && uploadMode && (
            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertDescription>
                {uploadMode === 'simple' ? (
                  <>
                    File size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    <br />
                    Using <strong>Simple Upload</strong> (faster for small files)
                  </>
                ) : (
                  <>
                    File size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    <br />
                    Using <strong>Resumable Upload</strong> (reliable for large files)
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {uploadMode === 'simple' && <UploadSection preSelectedFile={selectedFile} />}
      {uploadMode === 'resumable' && <UppyUploadSection preSelectedFile={selectedFile} />}
    </div>
  );
};

export default SmartUploadSection;
```

### Step 3: Update Existing Components to Accept Pre-selected Files

**File**: `src/components/dashboard/UppyUploadSection.tsx`

Add prop to accept pre-selected file:

```tsx
interface UppyUploadSectionProps {
  preSelectedFile?: File | null;
}

const UppyUploadSection = ({ preSelectedFile }: UppyUploadSectionProps) => {
  const [file, setFile] = useState<File | null>(preSelectedFile || null);

  useEffect(() => {
    if (preSelectedFile) {
      setFile(preSelectedFile);
      if (!title) {
        setTitle(preSelectedFile.name.replace(/\.[^/.]+$/, ""));
      }
    }
  }, [preSelectedFile]);

  // Rest of component...
};
```

### Step 4: Update Routes (if using React Router)

**File**: `src/App.tsx` or routing file

```tsx
import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import SmartUploadSection from './components/dashboard/SmartUploadSection';

function App() {
  return (
    <Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/upload" element={<SmartUploadSection />} />
      {/* Other routes */}
    </Routes>
  );
}
```

## 🔄 Backward Compatibility

### Maintain Existing API Endpoints

Keep these endpoints for backward compatibility:
- `/api/gcs/upload` - Simple upload
- `/api/gcs/simple-upload` - Simple upload (alternative)
- `/api/signed-url` - Signed URL generation

### Database Schema Compatibility

Both systems use the same Firestore schema:
```typescript
{
  id: string;
  title: string;
  description: string;
  clientName: string;
  fileName: string;
  gcsPath: string;
  publicUrl: string;
  size: number;
  contentType: string;
  userId: string;
  securityCode: string;
  isActive: boolean;
  accessCount: number;
  privacyStatus: string;
  isPubliclyAccessible: boolean;
  service: 'gcs';
  uploadedAt: Timestamp;
}
```

## 📊 Feature Comparison

| Feature | Simple Upload | Uppy Upload |
|---------|--------------|-------------|
| Max File Size | 50MB | 2GB |
| Resumable | ❌ | ✅ |
| Pause/Resume | ❌ | ✅ |
| Chunk Upload | ❌ | ✅ (10MB) |
| Auto Retry | ❌ | ✅ (3x) |
| Network Recovery | ❌ | ✅ |
| Progress Tracking | Basic | Advanced |
| Upload Speed | ❌ | ✅ |
| ETA | ❌ | ✅ |
| Vercel Timeout | Risk | No Risk |

## 🎨 UI/UX Recommendations

### 1. File Size Indicator
Show file size and recommended upload method:

```tsx
<Badge variant={fileSizeMB < 50 ? "default" : "secondary"}>
  {fileSizeMB < 50 ? "Simple Upload" : "Resumable Upload"}
</Badge>
```

### 2. Upload Method Selector
Let users manually choose:

```tsx
<RadioGroup value={uploadMethod} onValueChange={setUploadMethod}>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="simple" id="simple" />
    <Label htmlFor="simple">Simple Upload (faster for small files)</Label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="resumable" id="resumable" />
    <Label htmlFor="resumable">Resumable Upload (reliable for large files)</Label>
  </div>
</RadioGroup>
```

### 3. Progress Comparison
Show different progress indicators:

**Simple Upload**:
```tsx
<Progress value={uploadProgress} />
<p>{uploadProgress}%</p>
```

**Uppy Upload**:
```tsx
<Progress value={uploadProgress} />
<div className="grid grid-cols-3 gap-2 text-sm">
  <div>
    <p className="text-muted-foreground">Progress</p>
    <p className="font-medium">{uploadProgress}%</p>
  </div>
  <div>
    <p className="text-muted-foreground">Speed</p>
    <p className="font-medium">{formatSpeed(uploadSpeed)}</p>
  </div>
  <div>
    <p className="text-muted-foreground">ETA</p>
    <p className="font-medium">{calculateETA()}</p>
  </div>
</div>
```

## 🧪 Testing Migration

### Test Checklist

1. **Simple Upload Still Works**
   - [ ] Upload file < 50MB
   - [ ] Verify in dashboard
   - [ ] Check Firestore
   - [ ] Check GCS bucket

2. **Uppy Upload Works**
   - [ ] Upload file > 50MB
   - [ ] Test pause/resume
   - [ ] Verify in dashboard
   - [ ] Check Firestore
   - [ ] Check GCS bucket

3. **Smart Detection Works**
   - [ ] Select file < 50MB → Simple upload
   - [ ] Select file > 50MB → Uppy upload
   - [ ] Manual override works

4. **Both Systems Coexist**
   - [ ] Upload via simple method
   - [ ] Upload via Uppy method
   - [ ] Both appear in dashboard
   - [ ] Both playable

## 🚀 Deployment Strategy

### Phase 1: Beta Testing (Week 1)
- Deploy Uppy upload to staging
- Test with internal team
- Collect feedback

### Phase 2: Limited Release (Week 2)
- Enable for 10% of users
- Monitor performance
- Track error rates

### Phase 3: Full Release (Week 3)
- Enable for all users
- Keep simple upload as fallback
- Monitor adoption

### Phase 4: Optimization (Week 4+)
- Analyze usage patterns
- Optimize chunk size
- Improve error handling

## 📈 Monitoring

### Metrics to Track

1. **Upload Success Rate**
   ```javascript
   const successRate = (successfulUploads / totalUploads) * 100;
   ```

2. **Average Upload Time**
   ```javascript
   const avgTime = totalUploadTime / totalUploads;
   ```

3. **Method Usage**
   ```javascript
   const uppyUsage = (uppyUploads / totalUploads) * 100;
   ```

4. **Error Rate**
   ```javascript
   const errorRate = (failedUploads / totalUploads) * 100;
   ```

### Analytics Events

```typescript
// Track upload method selection
analytics.track('upload_method_selected', {
  method: 'uppy' | 'simple',
  fileSize: file.size,
  autoSelected: boolean
});

// Track upload completion
analytics.track('upload_completed', {
  method: 'uppy' | 'simple',
  fileSize: file.size,
  duration: uploadDuration,
  success: boolean
});

// Track upload errors
analytics.track('upload_error', {
  method: 'uppy' | 'simple',
  error: errorMessage,
  fileSize: file.size
});
```

## 🔧 Configuration

### Environment Variables

Add to `.env`:
```env
# Upload Configuration
VITE_UPLOAD_SIMPLE_MAX_SIZE=52428800  # 50MB
VITE_UPLOAD_RESUMABLE_MAX_SIZE=2147483648  # 2GB
VITE_UPLOAD_CHUNK_SIZE=10485760  # 10MB
```

### Feature Flags

```typescript
// src/config/features.ts
export const FEATURES = {
  UPPY_UPLOAD: true,
  SIMPLE_UPLOAD: true,
  AUTO_SELECT_METHOD: true,
  MANUAL_METHOD_OVERRIDE: true
};
```

## ✅ Migration Checklist

- [ ] Install Uppy dependencies
- [ ] Create new API endpoints
- [ ] Create Uppy upload component
- [ ] Add smart file detection
- [ ] Update dashboard layout
- [ ] Test both upload methods
- [ ] Deploy to staging
- [ ] Beta test with users
- [ ] Monitor performance
- [ ] Deploy to production
- [ ] Update documentation
- [ ] Train support team

## 🎉 Success Criteria

Migration is successful when:
- ✅ Both upload methods work
- ✅ Users can upload files > 50MB
- ✅ No increase in error rate
- ✅ Improved user satisfaction
- ✅ Zero Vercel timeouts
- ✅ Faster large file uploads

## 📞 Support

If you encounter issues during migration:
1. Check [Quick Start Guide](./UPPY_QUICK_START.md)
2. Review [Implementation Guide](./UPPY_RESUMABLE_UPLOAD_GUIDE.md)
3. Check [Testing Guide](./UPPY_UPLOAD_TESTING.md)
4. Review migration logs
5. Contact development team
