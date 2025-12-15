import { YOUTUBE_CONFIG } from "./config";

// Declare Google Identity Services types
declare global {
  interface Window {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token: string; error?: string }) => void;
            error_callback?: (error: any) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

export interface YouTubeVideoMetadata {
  title: string;
  description?: string;
  tags?: string[];
  privacyStatus?: "private" | "unlisted" | "public";
  categoryId?: string;
}

export interface YouTubeComment {
  id: string;
  author: string;
  authorImageUrl?: string;
  text: string;
  likeCount: number;
  publishedAt: string;
  updatedAt: string;
  isReply: boolean;
  parentId?: string;
  replies?: YouTubeComment[];
}

export class YouTubeService {
  private static instance: YouTubeService;
  private accessToken: string | null = null;
  private tokenClient: any = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): YouTubeService {
    if (!YouTubeService.instance) {
      YouTubeService.instance = new YouTubeService();
    }
    return YouTubeService.instance;
  }

  /**
   * Wait for Google Identity Services to load
   */
  private async waitForGoogle(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }

      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait
      const interval = setInterval(() => {
        attempts++;
        if (window.google?.accounts?.oauth2) {
          clearInterval(interval);
          resolve();
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error("Google Identity Services failed to load"));
        }
      }, 100);
    });
  }

  /**
   * Initialize Google Identity Services
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (!YOUTUBE_CONFIG.CLIENT_ID) {
      throw new Error("YouTube Client ID is not configured. Please set VITE_YOUTUBE_CLIENT_ID in your .env file.");
    }

    try {
      await this.waitForGoogle();

      // Initialize token client (this is just for storage, we'll create fresh ones for auth)
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: YOUTUBE_CONFIG.CLIENT_ID,
        scope: YOUTUBE_CONFIG.SCOPES,
        callback: (response) => {
          if (response.error) {
            console.error("OAuth error:", response.error);
            this.accessToken = null;
            return;
          }
          if (response.access_token) {
            this.accessToken = response.access_token;
            localStorage.setItem("youtube_access_token", response.access_token);
          }
        },
        error_callback: (error) => {
          console.error("OAuth error callback:", error);
          this.accessToken = null;
        },
      });

      // Check if we have a stored token
      const storedToken = localStorage.getItem("youtube_access_token");
      if (storedToken) {
        // Verify token is still valid and has required scopes
        try {
          const isValid = await this.verifyToken(storedToken);
          if (isValid) {
            // Also check if token has the required scopes
            const tokenInfo = await fetch(
              `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${storedToken}`
            ).then(res => res.json()).catch(() => null);
            
            if (tokenInfo && tokenInfo.scope) {
              const hasReadScope = tokenInfo.scope.includes("youtube.readonly") || tokenInfo.scope.includes("youtube");
              const hasUploadScope = tokenInfo.scope.includes("youtube.upload");
              
              // If token doesn't have both scopes, clear it (user needs to re-authenticate)
              if (!hasReadScope || !hasUploadScope) {
                console.warn("Stored token missing required scopes. Clearing token for re-authentication.");
                localStorage.removeItem("youtube_access_token");
                this.accessToken = null;
              } else {
                this.accessToken = storedToken;
              }
            } else {
              this.accessToken = storedToken;
            }
          } else {
            localStorage.removeItem("youtube_access_token");
          }
        } catch {
          localStorage.removeItem("youtube_access_token");
        }
      }

      this.isInitialized = true;
    } catch (error: any) {
      throw new Error(`Failed to initialize YouTube service: ${error.message || "Unknown error"}`);
    }
  }

  /**
   * Verify if a token is still valid and has the required scope
   */
  private async verifyToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`
      );
      
      if (!response.ok) {
        return false;
      }

      const tokenInfo = await response.json();
      
      // Check if token has expired
      if (tokenInfo.expires_in && tokenInfo.expires_in <= 0) {
        return false;
      }

      // Check if token has the required scopes
      if (tokenInfo.scope) {
        const hasUploadScope = tokenInfo.scope.includes("youtube.upload");
        const hasReadScope = tokenInfo.scope.includes("youtube.readonly") || tokenInfo.scope.includes("youtube");
        
        if (!hasUploadScope && !hasReadScope) {
          console.warn("Token does not have required YouTube scopes");
          return false;
        }
        
        // If token only has upload scope but we need read scope, it's invalid for reading
        if (!hasReadScope && !hasUploadScope) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Authenticate user with Google OAuth2
   */
  async authenticate(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      if (!this.tokenClient) {
        reject(new Error("Token client not initialized"));
        return;
      }

      // Create a new token client for this authentication request
      // This ensures we have fresh callbacks
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: YOUTUBE_CONFIG.CLIENT_ID,
        scope: YOUTUBE_CONFIG.SCOPES,
        callback: (response: { access_token: string; error?: string }) => {
          if (response.error) {
            if (response.error === "popup_closed_by_user" || response.error === "access_denied") {
              reject(new Error("Sign-in was cancelled"));
            } else {
              reject(new Error(`Authentication failed: ${response.error}`));
            }
            return;
          }

          if (!response.access_token) {
            reject(new Error("No access token received"));
            return;
          }

          this.accessToken = response.access_token;
          localStorage.setItem("youtube_access_token", response.access_token);
          console.log("YouTube authentication successful");
          resolve(true);
        },
        error_callback: (error: any) => {
          console.error("OAuth error callback:", error);
          reject(new Error(`Authentication error: ${error.type || error.message || "Unknown error"}`));
        },
      });

      tokenClient.requestAccessToken({ prompt: "consent" });
    });
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.accessToken) {
      // Verify token is still valid
      const isValid = await this.verifyToken(this.accessToken);
      if (!isValid) {
        this.accessToken = null;
        localStorage.removeItem("youtube_access_token");
        return false;
      }
      return true;
    }

    // Check stored token
    const storedToken = localStorage.getItem("youtube_access_token");
    if (storedToken) {
      const isValid = await this.verifyToken(storedToken);
      if (isValid) {
        this.accessToken = storedToken;
        return true;
      } else {
        localStorage.removeItem("youtube_access_token");
      }
    }

    return false;
  }

  /**
   * Get access token for API calls
   */
  async getAccessToken(): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.accessToken) {
      const storedToken = localStorage.getItem("youtube_access_token");
      if (storedToken) {
        const isValid = await this.verifyToken(storedToken);
        if (isValid) {
          this.accessToken = storedToken;
        } else {
          // Token expired, remove it
          localStorage.removeItem("youtube_access_token");
          throw new Error("Access token expired. Please authenticate again.");
        }
      } else {
        throw new Error("No access token found. Please authenticate first.");
      }
    }

    // Verify token is still valid before returning
    const isValid = await this.verifyToken(this.accessToken);
    if (!isValid) {
      this.accessToken = null;
      localStorage.removeItem("youtube_access_token");
      throw new Error("Access token expired. Please authenticate again.");
    }

    return this.accessToken;
  }

  /**
   * Upload video to YouTube
   */
  async uploadVideo(
    file: File,
    metadata: YouTubeVideoMetadata,
    onProgress?: (progress: number) => void
  ): Promise<{ videoId: string; videoUrl: string }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Ensure we have a valid token
    let accessToken: string;
    try {
      accessToken = await this.getAccessToken();
    } catch {
      // Token not available, authenticate
      const authenticated = await this.authenticate();
      if (!authenticated) {
        throw new Error("Authentication required to upload videos");
      }
      accessToken = await this.getAccessToken();
    }

    // Verify token is still valid before uploading
    const isValid = await this.verifyToken(accessToken);
    if (!isValid) {
      // Token expired, re-authenticate
      this.accessToken = null;
      localStorage.removeItem("youtube_access_token");
      const authenticated = await this.authenticate();
      if (!authenticated) {
        throw new Error("Authentication expired. Please sign in again.");
      }
      accessToken = await this.getAccessToken();
    }

    try {
      // Log token info for debugging (first 20 chars only for security)
      console.log("Using access token:", accessToken ? `${accessToken.substring(0, 20)}...` : "null");

      // Step 1: Create video metadata
      const videoMetadata = {
        snippet: {
          title: metadata.title,
          description: metadata.description || "",
          tags: metadata.tags || [],
          categoryId: metadata.categoryId || "22", // People & Blogs
        },
        status: {
          privacyStatus: metadata.privacyStatus || "private",
        },
      };

      // Step 2: Upload video using resumable upload
      const videoId = await this.performResumableUpload(
        file,
        videoMetadata,
        accessToken,
        onProgress
      );

      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      return { videoId, videoUrl };
    } catch (error: any) {
      console.error("YouTube upload error:", error);
      
      // If it's an auth error, clear the token (unless it's a YouTube signup issue)
      if (!error.isYouTubeSignupRequired && (error.message?.includes("Authentication") || error.message?.includes("Unauthorized"))) {
        this.accessToken = null;
        localStorage.removeItem("youtube_access_token");
      }
      
      // Preserve the original error message and add the flag
      const uploadError = new Error(error.message || "Failed to upload video");
      (uploadError as any).isYouTubeSignupRequired = error.isYouTubeSignupRequired || false;
      throw uploadError;
    }
  }

  /**
   * Perform resumable upload to YouTube
   */
  private async performResumableUpload(
    file: File,
    metadata: any,
    accessToken: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      // Validate access token
      if (!accessToken || accessToken.trim() === "") {
        reject(new Error("Invalid access token. Please authenticate again."));
        return;
      }

      // Step 1: Initialize upload session
      const xhr = new XMLHttpRequest();

      xhr.open("POST", "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", true);
      
      // Ensure token is properly formatted
      const token = accessToken.trim();
      if (!token || token.length < 10) {
        reject(new Error("Invalid access token format"));
        return;
      }
      
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("X-Upload-Content-Type", file.type);
      xhr.setRequestHeader("X-Upload-Content-Length", file.size.toString());

      xhr.onload = () => {
        if (xhr.status === 200) {
          const uploadUrl = xhr.getResponseHeader("Location");
          if (!uploadUrl) {
            reject(new Error("No upload URL received"));
            return;
          }

          // Step 2: Upload video file
          this.uploadVideoFile(uploadUrl, file, accessToken, onProgress)
            .then((response) => {
              const videoId = JSON.parse(response).id;
              resolve(videoId);
            })
            .catch(reject);
        } else if (xhr.status === 401) {
          // Token expired or invalid - clear it and request re-authentication
          this.accessToken = null;
          localStorage.removeItem("youtube_access_token");
          
          let errorMessage = "Authentication failed.";
          let isYouTubeSignupRequired = false;
          
          try {
            const error = JSON.parse(xhr.responseText);
            console.error("401 Error details:", error);
            
            // Check for specific YouTube errors
            if (error.error?.errors && error.error.errors.length > 0) {
              const firstError = error.error.errors[0];
              
              if (firstError.reason === "youtubeSignupRequired") {
                isYouTubeSignupRequired = true;
                errorMessage = "Your Google account doesn't have a YouTube channel. Please create a YouTube channel first by visiting youtube.com and accepting the terms of service, then try again.";
              } else if (firstError.reason === "channelNotFound") {
                isYouTubeSignupRequired = true;
                errorMessage = "No YouTube channel found for this account. Please create a YouTube channel first, then try again.";
              } else if (firstError.reason === "invalidCredentials") {
                errorMessage = "Invalid credentials. Please sign in again.";
              } else if (firstError.reason === "tokenExpired") {
                errorMessage = "Authentication expired. Please sign in again.";
              } else if (error.error?.message) {
                errorMessage = error.error.message;
              } else {
                errorMessage = `Authentication failed: ${firstError.reason || "Unknown error"}`;
              }
            } else if (error.error?.message) {
              errorMessage = error.error.message;
            }
          } catch {
            // Couldn't parse error, use default message
            errorMessage = "Authentication expired. Please sign in again.";
          }
          
          // Create a more helpful error with actionable information
          const error = new Error(errorMessage);
          (error as any).isYouTubeSignupRequired = isYouTubeSignupRequired;
          reject(error);
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            const errorMessage = error.error?.message || `HTTP ${xhr.status}: ${xhr.statusText}`;
            reject(new Error(`Failed to initialize upload: ${errorMessage}`));
          } catch {
            reject(new Error(`Failed to initialize upload: HTTP ${xhr.status} ${xhr.statusText}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error("Network error during upload initialization"));
      xhr.send(JSON.stringify(metadata));
    });
  }

  /**
   * Upload video file chunk by chunk
   */
  private async uploadVideoFile(
    uploadUrl: string,
    file: File,
    accessToken: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          if (onProgress) {
            onProgress(Math.min(progress, 100));
          }
        }
      });

      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) {
          resolve(xhr.responseText);
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.error?.message || "Upload failed"));
          } catch {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.onabort = () => reject(new Error("Upload was cancelled"));

      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    });
  }

  /**
   * Get video details by ID
   */
  async getVideoDetails(videoId: string): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!(await this.isAuthenticated())) {
      throw new Error("Authentication required");
    }

    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,status&access_token=${accessToken}`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch video details");
    }

    const data = await response.json();
    return data.items[0];
  }

  /**
   * Get user's YouTube channel information including uploads playlist
   */
  async getMyChannelInfo(): Promise<{ channelId: string; uploadsPlaylistId: string }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!(await this.isAuthenticated())) {
      throw new Error("Authentication required");
    }

    const accessToken = await this.getAccessToken();

    // Get channel info including contentDetails (which contains uploads playlist)
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=id,contentDetails&mine=true&access_token=${accessToken}`
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      
      if (response.status === 403) {
        const errorMessage = error.error?.message || "";
        
        if (errorMessage.includes("insufficient authentication scopes") || 
            errorMessage.includes("Insufficient Permission")) {
          // Clear token and request re-authentication with new scopes
          this.accessToken = null;
          localStorage.removeItem("youtube_access_token");
          throw new Error("Token missing read permissions. Please sign in again to grant access to view videos.");
        }
      }
      
      throw new Error(error.error?.message || "Failed to fetch channel information");
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      throw new Error("No YouTube channel found. Please create a YouTube channel first.");
    }

    const channel = data.items[0];
    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
      throw new Error("Could not find uploads playlist for your channel.");
    }

    return {
      channelId: channel.id,
      uploadsPlaylistId: uploadsPlaylistId,
    };
  }

  /**
   * Get user's YouTube channel ID
   */
  async getMyChannelId(): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!(await this.isAuthenticated())) {
      throw new Error("Authentication required");
    }

    const accessToken = await this.getAccessToken();

    // Verify token has read scope
    const tokenInfo = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`
    ).then(res => res.json()).catch(() => null);

    if (tokenInfo && tokenInfo.scope) {
      const hasReadScope = tokenInfo.scope.includes("youtube.readonly") || tokenInfo.scope.includes("youtube");
      if (!hasReadScope) {
        // Token doesn't have read scope, need to re-authenticate
        this.accessToken = null;
        localStorage.removeItem("youtube_access_token");
        throw new Error("Token missing read permissions. Please sign in again to grant access to view videos.");
      }
    }

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=id&mine=true&access_token=${accessToken}`
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      
      if (response.status === 403) {
        const errorMessage = error.error?.message || "";
        
        if (errorMessage.includes("insufficient authentication scopes") || 
            errorMessage.includes("Insufficient Permission")) {
          // Clear token and request re-authentication with new scopes
          this.accessToken = null;
          localStorage.removeItem("youtube_access_token");
          throw new Error("Token missing read permissions. Please sign in again to grant access to view videos.");
        }
      }
      
      throw new Error(error.error?.message || "Failed to fetch channel information");
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      throw new Error("No YouTube channel found. Please create a YouTube channel first.");
    }

    return data.items[0].id;
  }

  /**
   * Get all videos from user's YouTube channel (including private and unlisted)
   */
  /**
   * Get comments for a specific video
   */
  async getVideoComments(videoId: string, maxResults: number = 20): Promise<YouTubeComment[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!(await this.isAuthenticated())) {
      throw new Error("Authentication required");
    }

    try {
      const accessToken = await this.getAccessToken();
      const apiUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${videoId}&maxResults=${maxResults}&order=relevance&access_token=${accessToken}`;
      
      console.log('Fetching comments from:', apiUrl);
      const response = await fetch(apiUrl);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('YouTube API Error:', errorData);
        
        if (response.status === 403) {
          if (errorData.error?.errors?.[0]?.reason === 'commentsDisabled') {
            throw new Error('Comments are disabled for this video');
          } else if (errorData.error?.errors?.[0]?.reason === 'forbidden') {
            throw new Error('Insufficient permissions. Please check if the YouTube Data API v3 is enabled and you have the required scopes.');
          }
        }
        
        throw new Error(errorData.error?.message || `Failed to fetch comments (${response.status} ${response.statusText})`);
      }

      const data = await response.json();
      console.log('Comments API Response:', data);
      
      if (!data.items || data.items.length === 0) {
        console.log('No comments found for video:', videoId);
        return [];
      }

      // Process comments and their replies
      return data.items.map((item: any) => {
        const comment = item.snippet.topLevelComment.snippet;
        const commentData: YouTubeComment = {
          id: item.id,
          author: comment.authorDisplayName,
          authorImageUrl: comment.authorProfileImageUrl,
          text: comment.textOriginal,
          likeCount: comment.likeCount,
          publishedAt: comment.publishedAt,
          updatedAt: comment.updatedAt,
          isReply: false,
        };

        // Process replies if any
        if (item.replies && item.replies.comments && item.replies.comments.length > 0) {
          commentData.replies = item.replies.comments.map((reply: any) => ({
            id: reply.id,
            author: reply.snippet.authorDisplayName,
            authorImageUrl: reply.snippet.authorProfileImageUrl,
            text: reply.snippet.textOriginal,
            likeCount: reply.snippet.likeCount,
            publishedAt: reply.snippet.publishedAt,
            updatedAt: reply.snippet.updatedAt,
            isReply: true,
            parentId: reply.snippet.parentId || item.id,
          }));
        }

        return commentData;
      });
    } catch (error: any) {
      console.error("Error fetching comments:", error);
      throw new Error(error.message || "Failed to fetch comments");
    }
  }

  async getMyVideos(maxResults: number = 50): Promise<Array<{
    id: string;
    title: string;
    description: string;
    videoUrl: string;
    youtubeId: string;
    uploadDate: string;
    status: string;
    privacyStatus: string;
    thumbnailUrl?: string;
  }>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!(await this.isAuthenticated())) {
      throw new Error("Authentication required");
    }

    try {
      const accessToken = await this.getAccessToken();
      
      // Step 1: Get channel info including uploads playlist ID
      // Using uploads playlist ensures we get ALL videos (private, unlisted, public)
      const channelInfo = await this.getMyChannelInfo();
      const uploadsPlaylistId = channelInfo.uploadsPlaylistId;

      // Step 2: Get videos from the uploads playlist (this includes all privacy levels)
      const playlistResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&access_token=${accessToken}`
      );

      if (!playlistResponse.ok) {
        const error = await playlistResponse.json().catch(() => ({}));
        
        if (playlistResponse.status === 403) {
          const errorMessage = error.error?.message || "";
          if (errorMessage.includes("insufficient authentication scopes") || 
              errorMessage.includes("Insufficient Permission")) {
            // Clear token and request re-authentication
            this.accessToken = null;
            localStorage.removeItem("youtube_access_token");
            throw new Error("Token missing read permissions. Please sign in again to grant access to view videos.");
          }
        }
        
        throw new Error(error.error?.message || "Failed to fetch videos");
      }

      const playlistData = await playlistResponse.json();

      if (!playlistData.items || playlistData.items.length === 0) {
        return [];
      }

      // Step 3: Get detailed video information including status and privacy
      // Extract video IDs from playlist items
      const videoIds = playlistData.items
        .map((item: any) => item.contentDetails?.videoId || item.snippet?.resourceId?.videoId)
        .filter((id: string) => id) // Remove any undefined/null values
        .join(",");

      if (!videoIds) {
        return [];
      }
      
      const videosResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${videoIds}&access_token=${accessToken}`
      );

      if (!videosResponse.ok) {
        const error = await videosResponse.json().catch(() => ({}));
        
        if (videosResponse.status === 403) {
          const errorMessage = error.error?.message || "";
          if (errorMessage.includes("insufficient authentication scopes") || 
              errorMessage.includes("Insufficient Permission")) {
            // Clear token and request re-authentication
            this.accessToken = null;
            localStorage.removeItem("youtube_access_token");
            throw new Error("Token missing read permissions. Please sign in again to grant access to view videos.");
          }
        }
        
        throw new Error(error.error?.message || "Failed to fetch video details");
      }

      const videosData = await videosResponse.json();

      // Format videos for display
      return videosData.items.map((video: any) => ({
        id: video.id,
        title: video.snippet.title,
        description: video.snippet.description || "",
        videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
        youtubeId: video.id,
        uploadDate: new Date(video.snippet.publishedAt).toLocaleDateString(),
        status: video.status.uploadStatus === "processed" ? "active" : video.status.uploadStatus,
        privacyStatus: video.status.privacyStatus,
        thumbnailUrl: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
      }));
    } catch (error: any) {
      console.error("Error fetching videos:", error);
      throw error;
    }
  }


  /**
   * Delete a YouTube video
   * @param videoId The ID of the video to delete
   */
  async deleteVideo(videoId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!(await this.isAuthenticated())) {
      throw new Error("Authentication required");
    }

    const accessToken = await this.getAccessToken();
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_CONFIG.API_KEY}`,
      {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("Error deleting video:", error);
      throw new Error(error.error?.message || "Failed to delete video");
    }
  }

  /**
   * Sign out user
   */
  async signOut(): Promise<void> {
    const tokenToRevoke = this.accessToken || localStorage.getItem("youtube_access_token");
    this.accessToken = null;
    localStorage.removeItem("youtube_access_token");
    
    // Revoke token if possible
    if (tokenToRevoke) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${tokenToRevoke}`);
      } catch {
        // Ignore errors during revocation
      }
    }
  }
}

export const youtubeService = YouTubeService.getInstance();
