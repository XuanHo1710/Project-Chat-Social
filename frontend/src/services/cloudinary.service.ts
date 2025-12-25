import axios from "@/config/axios";

export interface DeleteMediaItem {
  publicId: string;
  mediaType: "IMAGE" | "VIDEO";
}

export interface DeleteMediaResponse {
  success: boolean;
  message: string;
  results: Array<{
    publicId: string;
    success: boolean;
  }>;
}

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
