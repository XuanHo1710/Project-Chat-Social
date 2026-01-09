"use client";
import { uploadChatMedia, UploadMediaResult } from '@/services/cloudinary.service';
import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

export interface MediaUploadResult {
    url: string;
    publicId: string;
    mediaType: 'IMAGE' | 'VIDEO';
    width?: number;
    height?: number;
    duration?: number;
}

export interface PendingMediaItem {
    id: string;
    file: File;
    preview: string;
    mediaType: 'IMAGE' | 'VIDEO';
    uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'error';
    url?: string;
    publicId?: string;
    width?: number;
    height?: number;
    duration?: number;
}

interface MediaUploadContextType {
    // States
    pendingMedia: PendingMediaItem[];
    isUploading: boolean;
    uploadProgress: number;
    uploadedMedia: MediaUploadResult[];

    // File input ref  
    fileInputRef: React.RefObject<HTMLInputElement | null>;

    // Methods
    handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
    handleRemovePendingMedia: (mediaId: string) => Promise<void>;
    uploadAllMedia: () => Promise<MediaUploadResult[]>;
    resetMedia: () => void;

    // Emoji
    handleEmojiSelect: (emoji: { native: string }, contentSetter: (updater: (prev: string) => string) => void) => void;
}

const MediaUploadContext = createContext<MediaUploadContextType | undefined>(undefined);

export function MediaUploadProvider({ children }: { children: ReactNode }) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [pendingMedia, setPendingMedia] = useState<PendingMediaItem[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadedMedia, setUploadedMedia] = useState<MediaUploadResult[]>([]);

    // Handle file selection
    const handleFileSelect = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const files = event.target.files;
            if (!files) return;

            const newMedia: PendingMediaItem[] = Array.from(files).map((file) => ({
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                file,
                preview: URL.createObjectURL(file),
                mediaType: file.type.startsWith("video/") ? "VIDEO" : "IMAGE",
                uploadStatus: "pending" as const,
            }));

            setPendingMedia((prev) => [...prev, ...newMedia]);

            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        },
        []
    );

    // Handle remove pending media
    const handleRemovePendingMedia = useCallback(
        async (mediaId: string) => {
            const mediaItem = pendingMedia.find((m) => m.id === mediaId);
            if (!mediaItem) return;

            // Revoke object URL to free memory
            URL.revokeObjectURL(mediaItem.preview);

            // If already uploaded, delete from Cloudinary via backend
            if (mediaItem.uploadStatus === "uploaded" && mediaItem.publicId) {
                // For simplicity, we don't delete from cloudinary on remove 
                // since backend handles cleanup or you can implement deleteCloudinaryMedia
                setUploadedMedia((prev) =>
                    prev.filter((m) => m.publicId !== mediaItem.publicId)
                );
            }

            setPendingMedia((prev) => prev.filter((m) => m.id !== mediaId));
        },
        [pendingMedia]
    );

    // Upload all pending media using backend API
    const uploadAllMedia = useCallback(async (): Promise<MediaUploadResult[]> => {
        const pendingFiles = pendingMedia.filter(
            (m) => m.uploadStatus === "pending"
        );
        if (pendingFiles.length === 0) return uploadedMedia;

        setIsUploading(true);
        setUploadProgress(0);

        try {
            // Update status to uploading
            setPendingMedia((prev) =>
                prev.map((m) =>
                    m.uploadStatus === "pending" ? { ...m, uploadStatus: "uploading" } : m
                )
            );

            // Use backend API for upload (supports both images and videos)
            const response = await uploadChatMedia(pendingFiles.map((m) => m.file));

            if (!response.success) {
                throw new Error(response.error || 'Upload failed');
            }

            setUploadProgress(100);

            // Convert backend response to MediaUploadResult format
            const results: MediaUploadResult[] = response.results.map((r: UploadMediaResult) => ({
                url: r.url,
                publicId: r.publicId,
                mediaType: r.mediaType === 'VIDEO' ? 'VIDEO' : 'IMAGE',
                width: undefined,
                height: undefined,
                duration: undefined,
            }));

            // Update pending media with upload results
            setPendingMedia((prev) =>
                prev.map((m) => {
                    const pendingIndex = pendingFiles.findIndex((p) => p.id === m.id);
                    if (pendingIndex !== -1 && results[pendingIndex]) {
                        const result = results[pendingIndex];
                        return {
                            ...m,
                            uploadStatus: "uploaded" as const,
                            url: result.url,
                            publicId: result.publicId,
                            width: result.width,
                            height: result.height,
                            duration: result.duration,
                        };
                    }
                    return m;
                })
            );

            const allUploaded = [...uploadedMedia, ...results];
            setUploadedMedia(allUploaded);
            return allUploaded;
        } catch (error) {
            console.error('Upload error:', error);
            // Mark as error
            setPendingMedia((prev) =>
                prev.map((m) =>
                    m.uploadStatus === "uploading" ? { ...m, uploadStatus: "error" } : m
                )
            );
            throw error;
        } finally {
            setIsUploading(false);
        }
    }, [pendingMedia, uploadedMedia]);



    const resetMedia = useCallback(() => {
        // Revoke all object URLs using functional state
        setPendingMedia(prev => {
            prev.forEach(m => URL.revokeObjectURL(m.preview));
            return [];
        });

        setUploadedMedia([]);
        setUploadProgress(0);
        setIsUploading(false);

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, []);


    // Handle emoji select
    const handleEmojiSelect = useCallback(
        (emoji: { native: string }, contentSetter: (updater: (prev: string) => string) => void) => {
            contentSetter((prev) => prev + emoji.native);
        },
        []
    );

    const value: MediaUploadContextType = {
        pendingMedia,
        isUploading,
        uploadProgress,
        uploadedMedia,
        fileInputRef,
        handleFileSelect,
        handleRemovePendingMedia,
        uploadAllMedia,
        resetMedia,
        handleEmojiSelect,
    };

    return (
        <MediaUploadContext.Provider value={value}>
            {children}
        </MediaUploadContext.Provider>
    );
}

export function useMediaUpload() {
    const context = useContext(MediaUploadContext);
    if (context === undefined) {
        throw new Error('useMediaUpload must be used within a MediaUploadProvider');
    }
    return context;
}
