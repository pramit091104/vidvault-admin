// REMOVED: import { v4 as uuidv4 } from 'uuid'; // Unused and unnecessary

/**
 * Generates a URL-friendly slug from a string
 * @param text - The text to convert to slug
 * @returns URL-friendly slug
 */
export const generateSlug = (text: string): string => {
  if (!text) return '';
  
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // Replace spaces with -
    .replace(/[^a-z0-9-]/g, '')   // Remove all non-alphanumeric chars except -
    .replace(/-+/g, '-')          // Replace multiple - with single -
    .replace(/^-+/, '')           // Trim - from start of text
    .replace(/-+$/, '');          // Trim - from end of text
};

/**
 * Generates a unique slug by appending random string if needed
 * @param baseText - The base text to generate slug from
 * @param existingSlugs - Array of existing slugs to check against
 * @returns Unique slug
 */
export const generateUniqueSlug = (baseText: string, existingSlugs: string[] = []): string => {
  let slug = generateSlug(baseText);
  let attempts = 0;
  const maxAttempts = 100;

  // If the basic slug is taken, append a random short string
  while (existingSlugs.includes(slug) && attempts < maxAttempts) {
    const randomSuffix = Math.random().toString(36).substring(2, 6); // 4 chars is usually enough
    slug = `${generateSlug(baseText)}-${randomSuffix}`;
    attempts++;
  }

  return slug;
};

/**
 * Generates a slug based on client name and video title
 */
export const generateVideoSlug = (
  clientName: string, 
  videoTitle: string, 
  existingSlugs: string[] = []
): string => {
  const baseText = `${clientName}-${videoTitle}`;
  return generateUniqueSlug(baseText, existingSlugs);
};

/**
 * Generates a short random slug for quick sharing
 */
export const generateShortSlug = (length: number = 8): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Validates if a slug is properly formatted
 */
export const isValidSlug = (slug: string): boolean => {
  if (!slug) return false;
  return /^[a-z0-9-]+$/.test(slug) && 
         slug.length >= 3 && 
         slug.length <= 100 && // Increased max length slightly
         !slug.startsWith('-') && 
         !slug.endsWith('-') && 
         !slug.includes('--');
};

/**
 * Creates a full public URL for a video
 * Handles Server-Side Rendering (SSR) safely by checking for window
 */
export const createPublicUrl = (slug: string, baseUrl?: string): string => {
  // If baseUrl provided, use it
  if (baseUrl) return `${baseUrl}/watch/${slug}`;

  // If in browser, use window.location
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/watch/${slug}`;
  }

  // Fallback for SSR or non-browser environments
  return `/watch/${slug}`;
};