# Alternative: Use Firebase Storage Instead of GCS

Since you're already using the `veedo-401e0` Firebase project, you might want to consider using Firebase Storage instead of Google Cloud Storage. This would eliminate the need for separate service accounts and simplify your setup.

## 🔄 Firebase Storage vs Google Cloud Storage

**Firebase Storage Benefits:**
- ✅ Same project as Firestore (`veedo-401e0`)
- ✅ Integrated with Firebase Auth
- ✅ Simpler security rules
- ✅ No separate service account needed
- ✅ Built-in CORS handling

**Current GCS Benefits:**
- ✅ More advanced features
- ✅ Better for large-scale operations
- ✅ More granular permissions

## 🚀 Quick Firebase Storage Implementation

If you want to try Firebase Storage, here's how to implement it:

### 1. Update Firebase Configuration

Your Firebase project already has Storage enabled. The bucket would be:
```
veedo-401e0.firebasestorage.app
```

### 2. Create Firebase Storage Service

```typescript
// src/integrations/firebase/storageService.ts
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  getMetadata 
} from 'firebase/storage';
import { app } from './config';

const storage = getStorage(app);

export class FirebaseStorageService {
  /**
   * Upload video to Firebase Storage
   */
  async uploadVideo(file: File, fileName: string): Promise<string> {
    const storageRef = ref(storage, `videos/${fileName}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  }

  /**
   * Delete video from Firebase Storage
   */
  async deleteVideo(fileName: string): Promise<void> {
    const storageRef = ref(storage, `videos/${fileName}`);
    await deleteObject(storageRef);
  }

  /**
   * Get video download URL
   */
  async getVideoURL(fileName: string): Promise<string> {
    const storageRef = ref(storage, `videos/${fileName}`);
    return await getDownloadURL(storageRef);
  }
}

export const firebaseStorageService = new FirebaseStorageService();
```

### 3. Update Security Rules

In Firebase Console > Storage > Rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow authenticated users to upload videos
    match /videos/{fileName} {
      allow read: if true; // Public read access for video playback
      allow write: if request.auth != null; // Only authenticated users can upload
      allow delete: if request.auth != null; // Only authenticated users can delete
    }
  }
}
```

### 4. Update Video Service

Replace GCS calls with Firebase Storage calls in your video components.

## 🤔 Recommendation

**For your current situation, I recommend:**

1. **Short-term:** Complete the GCS migration to `veedo-401e0` as outlined in the migration guide
2. **Long-term:** Consider migrating to Firebase Storage for simplicity

**Why GCS migration first:**
- Your current code is already set up for GCS
- Less code changes required
- You can migrate to Firebase Storage later if needed

## 🎯 Current Action Plan

1. **Get GCS service account credentials for `veedo-401e0`**
2. **Update environment variables**
3. **Test the migration**
4. **Consider Firebase Storage migration later**

Would you like me to help you with:
- A) Complete the GCS migration to `veedo-401e0`
- B) Switch to Firebase Storage instead
- C) Set up both options for comparison

Let me know which approach you prefer!