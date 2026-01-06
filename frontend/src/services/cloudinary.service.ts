import axios from "@/config/axios";

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

/**
 * Upload media files to Cloudinary via backend API
 * This is faster and more secure than direct Cloudinary upload
 */
export const uploadChatMedia = async (
  files: File[]
): Promise<UploadMediaResponse> => {
  if (!files || files.length === 0) {
    return { success: true, message: "No files to upload", results: [] };
  }

  try {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    const response = await axios.post("/cloudinary/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 180000, // 3 minutes for large video uploads
    });

    // Handle wrapped response: { data: { success, results } }
    const result = response.data?.data || response.data;
    return {
      success: result.success,
      message: result.message,
      results: result.results || [],
    };
  } catch (error) {
    console.error("Failed to upload media:", error);
    return {
      success: false,
      error: "Upload failed",
      results: [],
    };
  }
};

/**
 * Delete media files from Cloudinary via backend API
 * This is the secure way to delete media - uses server-side API secret
 */
export const deleteCloudinaryMedia = async (
  media: DeleteMediaItem[]
): Promise<DeleteMediaResponse> => {
  if (!media || media.length === 0) {
    return { success: true, message: "No media to delete", results: [] };
  }

  try {
    const response = await axios.post<DeleteMediaResponse>(
      "/cloudinary/delete",
      {
        media,
      }
    );
    return response.data;
  } catch (error) {
    console.error("Failed to delete media from Cloudinary:", error);
    return {
      success: false,
      message: "Failed to delete media",
      results: media.map((m) => ({ publicId: m.publicId, success: false })),
    };
  }
};
