import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// File size formatting
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Duration formatting (seconds to human readable)
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
}

// Video file validation
export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}

// Get video file extension
export function getVideoFileExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext || '';
}

// Check if video format is web-compatible
export function isWebCompatibleVideo(file: File): boolean {
  const webCompatibleTypes = [
    'video/mp4',
    'video/webm',
    'video/ogg'
  ];
  return webCompatibleTypes.includes(file.type);
}

// Generate compression-safe filename
export function generateCompressedFilename(originalName: string): string {
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
  const timestamp = Date.now();
  return `${nameWithoutExt}_compressed_${timestamp}.mp4`;
}

// Calculate compression ratio percentage
export function calculateCompressionRatio(originalSize: number, compressedSize: number): number {
  if (originalSize === 0) return 0;
  return ((originalSize - compressedSize) / originalSize) * 100;
}

// Estimate compression time based on file size and device performance
export function estimateCompressionTime(fileSize: number): number {
  // Base processing speed (bytes per second)
  // This is conservative for web-based compression
  const baseSpeed = 1.5 * 1024 * 1024; // 1.5 MB/s
  
  // Adjust for device performance if available
  const cores = navigator.hardwareConcurrency || 2;
  const performanceMultiplier = Math.min(cores / 4, 2); // Cap at 2x improvement
  
  const adjustedSpeed = baseSpeed * performanceMultiplier;
  return Math.ceil(fileSize / adjustedSpeed);
}

// Check if device supports video compression
export function supportsVideoCompression(): boolean {
  return (
    typeof Worker !== 'undefined' &&
    'SharedArrayBuffer' in window &&
    typeof WebAssembly !== 'undefined'
  );
}

// Get device performance tier for adaptive compression
export function getDevicePerformanceTier(): 'low' | 'medium' | 'high' {
  const cores = navigator.hardwareConcurrency || 2;
  const memory = (navigator as any).deviceMemory || 4;
  
  if (cores >= 8 && memory >= 8) return 'high';
  if (cores >= 4 && memory >= 4) return 'medium';
  return 'low';
}
