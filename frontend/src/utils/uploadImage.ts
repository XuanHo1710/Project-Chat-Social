import {
  deleteCloudinaryMedia,
  uploadMedia,
} from "@/services/cloudinary.service";

export interface MediaUploadResult {
  url: string;
  publicId: string;
  mediaType: "IMAGE" | "VIDEO";
  width?: number;
  height?: number;
  duration?: number;
}

const MAX_FILES_PER_REQUEST = 10;

const assertSupportedMedia = (file: File): void => {
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    throw new Error("Only image and video files are supported");
  }
};

/**
 * Upload through the authenticated backend. Cloudinary credentials and
 * unsigned presets never cross the browser boundary.
 */
export const UploadMediaFiles = async function (
  fileList: File[],
  onProgress?: (progress: number) => void,
): Promise<MediaUploadResult[]> {
  if (fileList.length === 0) return [];
  if (fileList.length > MAX_FILES_PER_REQUEST) {
    throw new Error(`A maximum of ${MAX_FILES_PER_REQUEST} files can be uploaded at once`);
  }
  fileList.forEach(assertSupportedMedia);

  const response = await uploadMedia(fileList, onProgress);
  if (!response.success) {
    throw new Error(response.error || "Upload failed");
  }
  if (response.results.length !== fileList.length) {
    throw new Error("The server returned an incomplete upload result");
  }

  return response.results.map((result) => {
    if (result.mediaType === "RAW") {
      throw new Error("The server rejected an unsupported media type");
    }
    return {
      url: result.url,
      publicId: result.publicId,
      mediaType: result.mediaType,
    };
  });
};

export const UploadMediaFile = async function (
  file: File,
): Promise<MediaUploadResult> {
  const [result] = await UploadMediaFiles([file]);
  return result;
};

/** Delete media through the authenticated backend ownership boundary. */
export const DeleteMedia = async function (
  publicId: string,
  mediaType: "IMAGE" | "VIDEO" = "IMAGE",
): Promise<boolean> {
  if (!publicId.trim()) return false;
  const response = await deleteCloudinaryMedia([{ publicId, mediaType }]);
  return response.success && response.results[0]?.success === true;
};

export const DeleteMediaFiles = async function (
  mediaItems: Array<{ publicId: string; mediaType: "IMAGE" | "VIDEO" }>,
): Promise<boolean[]> {
  if (mediaItems.length === 0) return [];
  const response = await deleteCloudinaryMedia(mediaItems);
  const statusByPublicId = new Map(
    response.results.map((result) => [result.publicId, result.success]),
  );
  return mediaItems.map((item) => statusByPublicId.get(item.publicId) === true);
};

// Legacy exports retained while callers migrate to structured results.
export const UploadImages = async function (fileList: File[]): Promise<string[]> {
  const results = await UploadMediaFiles(fileList);
  return results.map((result) => result.url);
};

export const UploadImage = async function (image: File): Promise<string> {
  return (await UploadMediaFile(image)).url;
};
