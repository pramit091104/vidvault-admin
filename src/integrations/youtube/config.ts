// YouTube API Configuration
export const YOUTUBE_CONFIG = {
  API_KEY: import.meta.env.VITE_YOUTUBE_API_KEY || "",
  CLIENT_ID: import.meta.env.VITE_YOUTUBE_CLIENT_ID || "",
  DISCOVERY_DOCS: ["https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest"],
  SCOPES: [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.force-ssl',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/youtubepartner',
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.channel-memberships.creator',
    'https://www.googleapis.com/auth/youtube.upload'
  ].join(' '),
};

// YouTube API endpoints
export const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
