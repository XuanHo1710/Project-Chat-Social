import axios, { unwrap } from "@/config/axios";
import { AxiosError, AxiosProgressEvent } from "axios";

export interface DeleteMediaItem {
  publicId: string;
  mediaType: "IMAGE" | "VIDEO" | "RAW";
}

export interface DeleteMediaResponse {
  success: boolean;
  message: string;
  results: Array<{
    publicId: string;
    success: boolean;
  }>;
}

export interface UploadMediaResult {
  url: string;
  publicId: string;
  mediaType: "IMAGE" | "VIDEO" | "RAW";
  fileName: string;
  fileSize: number;
}

export interface UploadMediaResponse {
  success: boolean;
  message?: string;
  error?: string;
  results: UploadMediaResult[];
}

const uploadMediaToEndpoint = async (
  files: File[],
  endpoint: string,
  onProgress?: (progress: number) => void,
): Promise<UploadMediaResponse> => {
  if (!files || files.length === 0) {
    return { success: true, message: "No files to upload", results: [] };
  }

  try {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    const response = await axios.post(endpoint, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 180000, // 3 minutes for large video uploads
      onUploadProgress: (event: AxiosProgressEvent) => {
        if (!onProgress || !event.total) return;
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      },
    });

    // Handle wrapped response: { data: { success, results } }
    const result = unwrap<UploadMediaResponse>(response.data);
    return {
      success: result.success,
      message: result.message,
      results: result.results || [],
    };
  } catch (error) {
    const axiosError = error as AxiosError<{
      message?: string | string[];
      error?: string;
    }>;
    const rawMessage = axiosError.response?.data?.message;
    const normalizedMessage = Array.isArray(rawMessage)
      ? rawMessage.join(", ")
      : rawMessage;
    const backendMessage =
      normalizedMessage || axiosError.response?.data?.error || undefined;

    console.error("Failed to upload media:", error);
    return {
      success: false,
      error: backendMessage || "Upload failed",
      results: [],
    };
  }
};

/**
 * Upload media for post/story without chat file-size restriction.
 */
export const uploadMedia = async (
  files: File[],
  onProgress?: (progress: number) => void,
): Promise<UploadMediaResponse> => {
  return uploadMediaToEndpoint(files, "/cloudinary/upload", onProgress);
};

/**
 * Upload media for user-to-user chat with strict backend size limit.
 */
export const uploadChatMedia = async (
  files: File[],
  onProgress?: (progress: number) => void,
): Promise<UploadMediaResponse> => {
  return uploadMediaToEndpoint(files, "/cloudinary/upload/chat", onProgress);
};

/**
 * Delete media files from Cloudinary via backend API
 * This is the secure way to delete media - uses server-side API secret
 */
export const deleteCloudinaryMedia = async (
  media: DeleteMediaItem[],
): Promise<DeleteMediaResponse> => {
  if (!media || media.length === 0) {
    return { success: true, message: "No media to delete", results: [] };
  }

  try {
    const response = await axios.post<
      DeleteMediaResponse | { data: DeleteMediaResponse }
    >(
      "/cloudinary/delete",
      {
        media,
      },
    );
    return unwrap<DeleteMediaResponse>(response.data);
  } catch (error) {
    console.error("Failed to delete media from Cloudinary:", error);
    return {
      success: false,
      message: "Failed to delete media",
      results: media.map((m) => ({ publicId: m.publicId, success: false })),
    };
  }
};
