"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Box, IconButton, Typography, Modal, Fade, useTheme } from "@mui/material";
import {
    Close as CloseIcon,
    ChevronLeft as PrevIcon,
    ChevronRight as NextIcon,
    ZoomIn as ZoomInIcon,
    ZoomOut as ZoomOutIcon,
    Download as DownloadIcon,
    RestartAlt as ResetIcon,
} from "@mui/icons-material";
import { MediaItem } from "@/types/post";
import Panzoom, { PanzoomObject } from "@panzoom/panzoom";

interface ImageViewerProps {
    open: boolean;
    onClose: () => void;
    media: MediaItem[];
    initialIndex?: number;
}

export default function ImageViewer({ open, onClose, media, initialIndex = 0 }: ImageViewerProps) {
    const theme = useTheme();
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [zoom, setZoom] = useState(1);
    const imageRef = useRef<HTMLImageElement>(null);
    const panzoomRef = useRef<PanzoomObject | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize Panzoom when modal opens or image changes
    useEffect(() => {
        if (open && imageRef.current && media[currentIndex]?.mediaType !== "VIDEO") {
            // Clean up previous instance
            if (panzoomRef.current) {
                panzoomRef.current.destroy();
            }

            const panzoom = Panzoom(imageRef.current, {
                maxScale: 5,
                minScale: 0.5,
                contain: 'outside',
                cursor: 'grab',
            });

            panzoomRef.current = panzoom;

            // Listen for scale changes
            const handlePanzoomChange = (e: Event) => {
                const customEvent = e as CustomEvent;
                setZoom(customEvent.detail.scale);
            };
            imageRef.current.addEventListener('panzoomchange', handlePanzoomChange);

            // Enable mouse wheel zoom
            const parent = imageRef.current.parentElement;
            const handleWheel = (e: WheelEvent) => {
                panzoom.zoomWithWheel(e);
            };
            if (parent) {
                parent.addEventListener('wheel', handleWheel);
            }

            return () => {
                panzoom.destroy();
                panzoomRef.current = null;
                if (parent) {
                    parent.removeEventListener('wheel', handleWheel);
                }
            };
        }
    }, [open, currentIndex, media]);

    // Reset when modal opens
    useEffect(() => {
        if (open) {
            setCurrentIndex(initialIndex);
            setZoom(1);
            if (panzoomRef.current) {
                panzoomRef.current.reset();
            }
        }
    }, [open, initialIndex]);

    // Reset zoom when changing images
    useEffect(() => {
        setZoom(1);
        if (panzoomRef.current) {
            panzoomRef.current.reset();
        }
    }, [currentIndex]);

    // Navigation handlers
    const handlePrev = useCallback(() => {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : media.length - 1));
    }, [media.length]);

    const handleNext = useCallback(() => {
        setCurrentIndex((prev) => (prev < media.length - 1 ? prev + 1 : 0));
    }, [media.length]);

    const handleZoomIn = useCallback(() => {
        if (panzoomRef.current) {
            panzoomRef.current.zoomIn();
        }
    }, []);

    const handleZoomOut = useCallback(() => {
        if (panzoomRef.current) {
            panzoomRef.current.zoomOut();
        }
    }, []);

    const handleReset = useCallback(() => {
        if (panzoomRef.current) {
            panzoomRef.current.reset();
        }
        setZoom(1);
    }, []);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!open) return;

            switch (e.key) {
                case "ArrowLeft":
                    handlePrev();
                    break;
                case "ArrowRight":
                    handleNext();
                    break;
                case "Escape":
                    onClose();
                    break;
                case "+":
                case "=":
                    handleZoomIn();
                    break;
                case "-":
                    handleZoomOut();
                    break;
                case "0":
                    handleReset();
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, handlePrev, handleNext, handleZoomIn, handleZoomOut, handleReset, onClose]);

    const handleDownload = async () => {
        const currentMedia = media[currentIndex];
        if (!currentMedia) return;

        try {
            const response = await fetch(currentMedia.url);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `image-${currentIndex + 1}.${currentMedia.mediaType === "VIDEO" ? "mp4" : "jpg"}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Download failed:", error);
        }
    };

    if (!media.length) return null;

    const currentMedia = media[currentIndex];

    return (
        <Modal
            open={open}
            onClose={onClose}
            closeAfterTransition
            sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <Fade in={open}>
                <Box
                    sx={{
                        position: "fixed",
                        inset: 0,
                        bgcolor: "rgba(0, 0, 0, 0.95)",
                        display: "flex",
                        flexDirection: "column",
                        outline: "none",
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) onClose();
                    }}
                >
                    {/* Header */}
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            p: 2,
                            color: "white",
                        }}
                    >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                            <IconButton onClick={onClose} sx={{ color: "white" }}>
                                <CloseIcon />
                            </IconButton>
                            <Typography sx={{ fontSize: 16 }}>
                                {currentIndex + 1} / {media.length}
                            </Typography>
                        </Box>

                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <IconButton onClick={handleZoomOut} sx={{ color: "white" }}>
                                <ZoomOutIcon />
                            </IconButton>
                            <Typography sx={{ fontSize: 14, minWidth: 50, textAlign: "center" }}>
                                {Math.round(zoom * 100)}%
                            </Typography>
                            <IconButton onClick={handleZoomIn} sx={{ color: "white" }}>
                                <ZoomInIcon />
                            </IconButton>
                            <IconButton onClick={handleReset} sx={{ color: "white" }} title="Reset (0)">
                                <ResetIcon />
                            </IconButton>
                            <IconButton onClick={handleDownload} sx={{ color: "white" }}>
                                <DownloadIcon />
                            </IconButton>
                        </Box>
                    </Box>

                    {/* Zoom hint */}
                    <Typography
                        sx={{
                            position: 'absolute',
                            top: 70,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            color: 'rgba(255,255,255,0.5)',
                            fontSize: 12,
                            pointerEvents: 'none',
                        }}
                    >
                        Lăn chuột để phóng to/thu nhỏ • Kéo để di chuyển • Bấm 0 để reset
                    </Typography>

                    {/* Main Content */}
                    <Box
                        ref={containerRef}
                        sx={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            position: "relative",
                            overflow: "hidden",
                        }}
                    >
                        {/* Previous Button */}
                        {media.length > 1 && (
                            <IconButton
                                onClick={handlePrev}
                                sx={{
                                    position: "absolute",
                                    left: 16,
                                    bgcolor: "rgba(255,255,255,0.1)",
                                    color: "white",
                                    width: 48,
                                    height: 48,
                                    "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
                                    zIndex: 10,
                                }}
                            >
                                <PrevIcon sx={{ fontSize: 32 }} />
                            </IconButton>
                        )}

                        {/* Media Content */}
                        <Box
                            sx={{
                                maxWidth: "90%",
                                maxHeight: "80vh",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            {currentMedia.mediaType === "VIDEO" ? (
                                <video
                                    src={currentMedia.url}
                                    controls
                                    autoPlay
                                    style={{
                                        maxWidth: "100%",
                                        maxHeight: "80vh",
                                        objectFit: "contain",
                                    }}
                                />
                            ) : (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                    ref={imageRef}
                                    src={currentMedia.url}
                                    alt={`Media ${currentIndex + 1}`}
                                    style={{
                                        maxWidth: "100%",
                                        maxHeight: "80vh",
                                        objectFit: "contain",
                                        userSelect: "none",
                                        cursor: "grab",
                                    }}
                                    draggable={false}
                                />
                            )}
                        </Box>

                        {/* Next Button */}
                        {media.length > 1 && (
                            <IconButton
                                onClick={handleNext}
                                sx={{
                                    position: "absolute",
                                    right: 16,
                                    bgcolor: "rgba(255,255,255,0.1)",
                                    color: "white",
                                    width: 48,
                                    height: 48,
                                    "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
                                    zIndex: 10,
                                }}
                            >
                                <NextIcon sx={{ fontSize: 32 }} />
                            </IconButton>
                        )}
                    </Box>

                    {/* Thumbnail Strip */}
                    {media.length > 1 && (
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "center",
                                gap: 1,
                                p: 2,
                                overflowX: "auto",
                            }}
                        >
                            {media.map((item, index) => (
                                <Box
                                    key={index}
                                    onClick={() => {
                                        setCurrentIndex(index);
                                    }}
                                    sx={{
                                        width: 60,
                                        height: 60,
                                        borderRadius: 1,
                                        overflow: "hidden",
                                        cursor: "pointer",
                                        border: index === currentIndex ? `2px solid ${theme.palette.primary.main}` : "2px solid transparent",
                                        opacity: index === currentIndex ? 1 : 0.6,
                                        transition: "all 0.2s",
                                        "&:hover": { opacity: 1 },
                                    }}
                                >
                                    {item.mediaType === "VIDEO" ? (
                                        <video
                                            src={item.url}
                                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                        />
                                    ) : (
                                        <img
                                            src={item.url}
                                            alt={`Thumbnail ${index + 1}`}
                                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                        />
                                    )}
                                </Box>
                            ))}
                        </Box>
                    )}
                </Box>
            </Fade>
        </Modal>
    );
}
