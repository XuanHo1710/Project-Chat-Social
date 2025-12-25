const PRESET_KEY = process.env.NEXT_PUBLIC_PRESET_KEY;
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;

// Type definitions
export interface MediaUploadResult {
  url: string;
  publicId: string;
  mediaType: "IMAGE" | "VIDEO";
  width?: number;
  height?: number;
  duration?: number; // For videos
}

export interface CloudinaryResponse {
  secure_url: string;
  public_id: string;
  resource_type: string;
  width: number;
  height: number;
  duration?: number;
}

// Helper function to determine media type
const getMediaType = (file: File): "IMAGE" | "VIDEO" => {
  return file.type.startsWith("video/") ? "VIDEO" : "IMAGE";
};

// Helper function to get upload endpoint based on media type
const getUploadEndpoint = (mediaType: "IMAGE" | "VIDEO"): string => {
  const resourceType = mediaType === "VIDEO" ? "video" : "image";
  return `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
};

/**
 * Upload multiple media files (images/videos) with optimized parallel processing
 * Returns array of MediaUploadResult with publicId for deletion support
 */
export const UploadMediaFiles = async function (
  fileList: Array<File>,
  onProgress?: (progress: number) => void
): Promise<Array<MediaUploadResult>> {
  const totalFiles = fileList.length;
  let completedFiles = 0;

  const uploadPromises = fileList.map(async (file) => {
    const mediaType = getMediaType(file);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", PRESET_KEY!);

    const response = await fetch(getUploadEndpoint(mediaType), {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const data: CloudinaryResponse = await response.json();

    // Update progress
    completedFiles++;
    if (onProgress) {
      onProgress(Math.round((completedFiles / totalFiles) * 100));
    }

    return {
      url: data.secure_url,
      publicId: data.public_id,
      mediaType,
      width: data.width,
      height: data.height,
      duration: data.duration,
    } as MediaUploadResult;
  });

  return Promise.all(uploadPromises);
};

/**
 * Upload single media file (image/video)
 * Returns MediaUploadResult with publicId for deletion support
 */
export const UploadMediaFile = async function (
  file: File
): Promise<MediaUploadResult> {
  const mediaType = getMediaType(file);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", PRESET_KEY!);

  const response = await fetch(getUploadEndpoint(mediaType), {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  const data: CloudinaryResponse = await response.json();

  return {
    url: data.secure_url,
    publicId: data.public_id,
    mediaType,
    width: data.width,
    height: data.height,
    duration: data.duration,
  };
};

/**
 * Delete media from Cloudinary by publicId
 * Note: This requires signature generation from backend for security
 * For client-side deletion, use unsigned preset with delete enabled
 */
export const DeleteMedia = async function (
  publicId: string,
  mediaType: "IMAGE" | "VIDEO" = "IMAGE"
): Promise<boolean> {
  try {
    const resourceType = mediaType === "VIDEO" ? "video" : "image";
    const timestamp = Math.round(new Date().getTime() / 1000);

    // For client-side deletion, we'll use the destroy endpoint
    // Note: You need to enable "Allow unsigned destroying" in Cloudinary settings
    // Or implement a backend endpoint for secure deletion
    const formData = new FormData();
    formData.append("public_id", publicId);
    formData.append("api_key", CLOUDINARY_API_KEY!);
    formData.append("timestamp", timestamp.toString());

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/destroy`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();
    return data.result === "ok";
  } catch (error) {
    console.error("Failed to delete media:", error);
    return false;
  }
};

/**
 * Delete multiple media files from Cloudinary
 * Optimized with Promise.all for parallel deletion
 */
export const DeleteMediaFiles = async function (
  mediaItems: Array<{ publicId: string; mediaType: "IMAGE" | "VIDEO" }>
): Promise<boolean[]> {
  const deletePromises = mediaItems.map((item) =>
    DeleteMedia(item.publicId, item.mediaType)
  );
  return Promise.all(deletePromises);
};

// Legacy functions for backward compatibility
export const UploadImages = async function (
  fileList: Array<File>
): Promise<Array<string>> {
  const results = await UploadMediaFiles(fileList);
  return results.map((r) => r.url);
};

export const UploadImage = async function (img: File): Promise<string> {
  const result = await UploadMediaFile(img);
  return result.url;
};
