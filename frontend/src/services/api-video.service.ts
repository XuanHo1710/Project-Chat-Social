import { uploadMedia } from "@/services/cloudinary.service";

export interface ApiVideoUploadResult {
  videoId: string;
  title: string;
  playbackUrl: string;
  thumbnailUrl: string;
  mp4Url?: string;
  iframe: string;
  duration?: number;
}

/**
 * Browser-side api.video authentication has intentionally been removed.
 * A provider-specific upload can be restored only after the backend exposes a
 * short-lived delegated upload token or a server-side upload endpoint.
 */
export async function uploadToApiVideo(
  _file: File,
  _title: string,
  _onProgress?: (progress: number) => void,
): Promise<ApiVideoUploadResult | null> {
  void _file;
  void _title;
  void _onProgress;
  return null;
}

export async function uploadVideoToCloudinary(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<{ url: string; publicId: string; duration?: number } | null> {
  if (!file.type.startsWith("video/")) {
    throw new Error("Only video files can be uploaded as livestream recordings");
  }

  const response = await uploadMedia([file], onProgress);
  if (!response.success || response.results.length !== 1) {
    return null;
  }
  const result = response.results[0];
  if (result.mediaType !== "VIDEO") {
    return null;
  }
  return { url: result.url, publicId: result.publicId };
}

/** Upload recordings through the authenticated backend Cloudinary endpoint. */
export async function uploadLivestreamVideo(
  file: File,
  _title: string,
  onProgress?: (progress: number) => void,
): Promise<{
  provider: "api.video" | "cloudinary";
  url: string;
  publicId: string;
  thumbnailUrl?: string;
  duration?: number;
} | null> {
  const result = await uploadVideoToCloudinary(file, onProgress);
  return result
    ? {
        provider: "cloudinary",
        url: result.url,
        publicId: result.publicId,
        duration: result.duration,
      }
    : null;
}
