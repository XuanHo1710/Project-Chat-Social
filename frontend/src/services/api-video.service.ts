/**
 * api.video Service for Frontend
 * 
 * Uses api.video's delegated upload tokens for secure browser uploads
 * Free tier: 100GB storage, 1TB bandwidth per month
 * 
 * To set up:
 * 1. Create account at https://dashboard.api.video/
 * 2. Get your API key from the dashboard
 * 3. Set NEXT_PUBLIC_API_VIDEO_KEY in .env
 */

const API_VIDEO_UPLOAD_URL = 'https://ws.api.video/';
// Note: For production, use delegated upload tokens from your backend
// For now, we'll use direct upload which requires the API key

export interface ApiVideoUploadResult {
    videoId: string;
    title: string;
    playbackUrl: string;      // HLS streaming URL
    thumbnailUrl: string;     // Thumbnail image
    mp4Url?: string;          // Direct MP4 download (if mp4Support enabled)
    iframe: string;           // Embed iframe code
    duration?: number;
}

/**
 * Upload video to api.video using their uploader widget
 * This is the recommended approach for browser uploads
 */
export async function uploadToApiVideo(
    file: File,
    title: string,
    onProgress?: (progress: number) => void
): Promise<ApiVideoUploadResult | null> {
    const apiKey = process.env.NEXT_PUBLIC_API_VIDEO_KEY;

    if (!apiKey) {
        console.warn('[api.video] API key not configured, falling back to Cloudinary');
        return null;
    }

    try {
        // Step 1: Create video object
        const createResponse = await fetch('https://ws.api.video/videos', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: title,
                description: 'Livestream recording',
                public: true,
                mp4Support: true,
            }),
        });

        if (!createResponse.ok) {
            const error = await createResponse.text();
            console.error('[api.video] Failed to create video:', error);
            return null;
        }

        const videoData = await createResponse.json();
        const videoId = videoData.videoId;
        console.log('[api.video] Created video:', videoId);

        // Step 2: Upload the file using chunked upload for large files
        const uploadUrl = `https://ws.api.video/videos/${videoId}/source`;

        // For files < 200MB, use simple upload
        if (file.size < 200 * 1024 * 1024) {
            const formData = new FormData();
            formData.append('file', file);

            const uploadResponse = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: formData,
            });

            if (!uploadResponse.ok) {
                const error = await uploadResponse.text();
                console.error('[api.video] Failed to upload video:', error);
                return null;
            }

            const uploadedVideo = await uploadResponse.json();
            console.log('[api.video] Upload completed:', uploadedVideo.videoId);

            return {
                videoId: uploadedVideo.videoId,
                title: uploadedVideo.title || title,
                playbackUrl: uploadedVideo.assets?.hls || `https://vod.api.video/vod/${videoId}/hls/manifest.m3u8`,
                thumbnailUrl: uploadedVideo.assets?.thumbnail || `https://vod.api.video/vod/${videoId}/thumbnail.jpg`,
                mp4Url: uploadedVideo.assets?.mp4,
                iframe: `<iframe src="https://embed.api.video/vod/${videoId}" width="100%" height="100%" frameborder="0" scrolling="no" allowfullscreen="true"></iframe>`,
            };
        } else {
            // For large files, use chunked upload
            console.warn('[api.video] Large file detected, chunked upload not yet implemented');
            return null;
        }
    } catch (error) {
        console.error('[api.video] Upload error:', error);
        return null;
    }
}

/**
 * Alternative: Upload video using Cloudinary (fallback)
 * This uses the existing Cloudinary infrastructure
 */
export async function uploadVideoToCloudinary(
    file: File,
    onProgress?: (progress: number) => void
): Promise<{ url: string; publicId: string; duration?: number } | null> {
    // Use existing cloudinary upload service
    const { UploadMediaFiles } = await import('@/utils/uploadImage');

    try {
        const result = await UploadMediaFiles([file], onProgress);
        if (result && result.length > 0) {
            return {
                url: result[0].url,
                publicId: result[0].publicId,
                duration: result[0].duration,
            };
        }
        return null;
    } catch (error) {
        console.error('[Cloudinary] Upload error:', error);
        return null;
    }
}

/**
 * Smart upload - tries api.video first, falls back to Cloudinary
 */
export async function uploadLivestreamVideo(
    file: File,
    title: string,
    onProgress?: (progress: number) => void
): Promise<{
    provider: 'api.video' | 'cloudinary';
    url: string;
    publicId: string;
    thumbnailUrl?: string;
    duration?: number;
} | null> {
    // Try api.video first (better for video streaming)
    const apiVideoResult = await uploadToApiVideo(file, title, onProgress);
    if (apiVideoResult) {
        return {
            provider: 'api.video',
            url: apiVideoResult.mp4Url || apiVideoResult.playbackUrl,
            publicId: apiVideoResult.videoId,
            thumbnailUrl: apiVideoResult.thumbnailUrl,
        };
    }

    // Fallback to Cloudinary
    console.log('[Upload] Falling back to Cloudinary');
    const cloudinaryResult = await uploadVideoToCloudinary(file, onProgress);
    if (cloudinaryResult) {
        return {
            provider: 'cloudinary',
            url: cloudinaryResult.url,
            publicId: cloudinaryResult.publicId,
            duration: cloudinaryResult.duration,
        };
    }

    return null;
}
