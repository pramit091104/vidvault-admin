import { GCS_CONFIG, validateGCSConfig, getPublicUrl } from './config';
import { getApiBaseUrl } from '../../config/environment';

export interface GCSVideoMetadata {
  title: string;
  description?: string;
  clientName: string;
  privacyStatus?: "private" | "unlisted" | "public";
}

export interface GCSUploadResult {
  fileName: string;
  publicUrl: string;
  size: number;
  contentType: string;
  uploadedAt: Date;
}

export class GCSService {
  private static instance: GCSService;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): GCSService {
    if (!GCSService.instance) {
      GCSService.instance = new GCSService();
    }
    return GCSService.instance;
  }

  /**
   * Initialize Google Cloud Storage service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      validateGCSConfig();
      this.isInitialized = true;
    } catch (error: any) {
      throw new Error(`Failed to initialize GCS service: ${error.message || "Unknown error"}`);
    }
  }

  /**
   * Upload video to Google Cloud Storage
   */
  async uploadVideo(
    file: File,
    metadata: GCSVideoMetadata,
    onProgress?: (progress: number) => void
  ): Promise<GCSUploadResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedTitle = metadata.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      const fileName = `${timestamp}_${sanitizedTitle}_${file.name}`;
      // Create FormData for the upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', fileName);
      formData.append('contentType', file.type);
      formData.append('metadata', JSON.stringify(metadata));

      // Upload using resumable upload via our backend
      const result = await this.performResumableUpload(formData, onProgress);

      // Prefer signedUrl returned by backend (when bucket is private).
      const returnedFileName = result?.fileName || fileName;
      const returnedSignedUrl = result?.signedUrl || null;

      return {
        fileName: returnedFileName,
        publicUrl: returnedSignedUrl || getPublicUrl(returnedFileName),
        size: file.size,
        contentType: file.type,
        uploadedAt: new Date(),
      };
    } catch (error: any) {
      console.error("GCS upload error:", error);
      throw new Error(error.message || "Failed to upload video to Google Cloud Storage");
    }
  }

  /**
   * Perform resumable upload to GCS via backend
   */
  private async performResumableUpload(
    formData: FormData,
    onProgress?: (progress: number) => void
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = (e.loaded / e.total) * 100;
          onProgress(Math.min(progress, 100));
        }
      });

      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch {
            resolve({ success: true });
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.error?.message || `Upload failed: ${xhr.statusText}`));
          } catch {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.onabort = () => reject(new Error("Upload was cancelled"));

      // Use backend endpoint for GCS upload with proper API base URL
      const apiBaseUrl = getApiBaseUrl();
      const uploadUrl = apiBaseUrl ? `${apiBaseUrl}/api/gcs/upload` : '/api/gcs/upload';
      
      xhr.open("POST", uploadUrl, true);
      xhr.send(formData);
    });
  }

  /**
   * Delete a file from Google Cloud Storage
   */
  async deleteFile(fileName: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const apiBaseUrl = getApiBaseUrl();
      const deleteUrl = apiBaseUrl ? `${apiBaseUrl}/api/gcs/delete` : '/api/gcs/delete';
      
      const response = await fetch(deleteUrl, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileName }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || "Failed to delete file");
      }
    } catch (error: any) {
      console.error("GCS delete error:", error);
      throw new Error(error.message || "Failed to delete file from Google Cloud Storage");
    }
  }

  /**
   * Get file metadata from GCS
   */
  async getFileMetadata(fileName: string): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const apiBaseUrl = getApiBaseUrl();
      const metadataUrl = apiBaseUrl 
        ? `${apiBaseUrl}/api/gcs/metadata?fileName=${encodeURIComponent(fileName)}`
        : `/api/gcs/metadata?fileName=${encodeURIComponent(fileName)}`;
        
      const response = await fetch(metadataUrl);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || "Failed to get file metadata");
      }

      return await response.json();
    } catch (error: any) {
      console.error("GCS metadata error:", error);
      throw new Error(error.message || "Failed to get file metadata");
    }
  }
}

export const gcsService = GCSService.getInstance();
