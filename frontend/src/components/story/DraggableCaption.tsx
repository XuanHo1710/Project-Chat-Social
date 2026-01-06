'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Box, TextField, IconButton, Popover } from '@mui/material';
import {
    FormatSize as FormatSizeIcon,
    Palette as PaletteIcon,
    FormatColorFill as FillIcon,
    Check as CheckIcon,
} from '@mui/icons-material';
import { CaptionStyle } from '@/types/story';

interface DraggableCaptionProps {
    caption: string;
    onCaptionChange: (caption: string) => void;
    captionStyle: CaptionStyle;
    onStyleChange: (style: CaptionStyle) => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
}

const COLORS = [
    '#FFFFFF', '#000000', '#FF0000', '#FF6B00', '#FFFF00',
    '#00FF00', '#00FFFF', '#0000FF', '#9B00FF', '#FF00FF',
];

const BG_COLORS = [
    'transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)',
    'rgba(255,255,255,0.5)', 'rgba(255,255,255,0.8)',
    '#1877f2', '#42b72a', '#f02849', '#a033ff',
];

const FONT_SIZES = [14, 18, 24, 32, 40];

export default function DraggableCaption({
    caption,
    onCaptionChange,
    captionStyle,
    onStyleChange,
    containerRef,
}: DraggableCaptionProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isEditing, setIsEditing] = useState(!caption);
    const [colorAnchor, setColorAnchor] = useState<HTMLElement | null>(null);
    const [bgColorAnchor, setBgColorAnchor] = useState<HTMLElement | null>(null);
    const [sizeAnchor, setSizeAnchor] = useState<HTMLElement | null>(null);
    const captionRef = useRef<HTMLDivElement>(null);
    const dragOffset = useRef({ x: 0, y: 0 });

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (isEditing) return;

        e.preventDefault();
        setIsDragging(true);

        const rect = captionRef.current?.getBoundingClientRect();
        if (rect) {
            dragOffset.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        }
    }, [isEditing]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging || !containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const newX = ((e.clientX - containerRect.left - dragOffset.current.x) / containerRect.width) * 100;
        const newY = ((e.clientY - containerRect.top - dragOffset.current.y) / containerRect.height) * 100;

        // Clamp values to container
        const clampedX = Math.max(0, Math.min(90, newX));
        const clampedY = Math.max(5, Math.min(85, newY));

        onStyleChange({
            ...captionStyle,
            x: clampedX,
            y: clampedY,
        });
    }, [isDragging, containerRef, captionStyle, onStyleChange]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleDoubleClick = () => {
        setIsEditing(true);
    };

    const handleBlur = () => {
        if (caption.trim()) {
            setIsEditing(false);
        }
    };

    const handleColorChange = (color: string) => {
        onStyleChange({ ...captionStyle, color });
        setColorAnchor(null);
    };

    const handleBgColorChange = (backgroundColor: string) => {
        onStyleChange({ ...captionStyle, backgroundColor });
        setBgColorAnchor(null);
    };

    const handleFontSizeChange = (fontSize: number) => {
        onStyleChange({ ...captionStyle, fontSize });
        setSizeAnchor(null);
    };

    return (
        <>
            {/* Draggable Caption */}
            <Box
                ref={captionRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onDoubleClick={handleDoubleClick}
                sx={{
                    position: 'absolute',
                    left: `${captionStyle.x}%`,
                    top: `${captionStyle.y}%`,
                    transform: 'translate(-50%, -50%)',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    zIndex: 10,
                    maxWidth: '80%',
                    userSelect: 'none',
                }}
            >
                {isEditing ? (
                    <TextField
                        autoFocus
                        multiline
                        value={caption}
                        onChange={(e) => onCaptionChange(e.target.value)}
                        onBlur={handleBlur}
                        placeholder="Nhập chú thích..."
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                color: captionStyle.color || 'white',
                                bgcolor: captionStyle.backgroundColor || 'rgba(0,0,0,0.5)',
                                fontSize: captionStyle.fontSize || 18,
                                borderRadius: 2,
                                '& fieldset': { border: 'none' },
                            },
                            '& .MuiInputBase-input': {
                                textAlign: 'center',
                            },
                        }}
                    />
                ) : caption ? (
                    <Box
                        sx={{
                            px: 2,
                            py: 1,
                            bgcolor: captionStyle.backgroundColor || 'rgba(0,0,0,0.5)',
                            color: captionStyle.color || 'white',
                            fontSize: captionStyle.fontSize || 18,
                            borderRadius: 2,
                            textAlign: 'center',
                            fontWeight: 500,
                            border: isDragging ? '2px dashed #1877f2' : 'none',
                        }}
                    >
                        {caption}
                    </Box>
                ) : null}
            </Box>

            {/* Style Controls */}
            <Box
                sx={{
                    position: 'absolute',
                    top: 60,
                    right: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5,
                    zIndex: 15,
                }}
            >
                {/* Font Size */}
                <IconButton
                    onClick={(e) => setSizeAnchor(e.currentTarget)}
                    sx={{
                        bgcolor: 'rgba(0,0,0,0.5)',
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                    }}
                >
                    <FormatSizeIcon />
                </IconButton>

                {/* Text Color */}
                <IconButton
                    onClick={(e) => setColorAnchor(e.currentTarget)}
                    sx={{
                        bgcolor: 'rgba(0,0,0,0.5)',
                        color: captionStyle.color || 'white',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                    }}
                >
                    <PaletteIcon />
                </IconButton>

                {/* Background Color */}
                <IconButton
                    onClick={(e) => setBgColorAnchor(e.currentTarget)}
                    sx={{
                        bgcolor: 'rgba(0,0,0,0.5)',
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                    }}
                >
                    <FillIcon />
                </IconButton>
            </Box>

            {/* Font Size Popover */}
            <Popover
                open={Boolean(sizeAnchor)}
                anchorEl={sizeAnchor}
                onClose={() => setSizeAnchor(null)}
                anchorOrigin={{ vertical: 'center', horizontal: 'left' }}
                transformOrigin={{ vertical: 'center', horizontal: 'right' }}
            >
                <Box sx={{ p: 1, display: 'flex', gap: 0.5 }}>
                    {FONT_SIZES.map((size) => (
                        <IconButton
                            key={size}
                            onClick={() => handleFontSizeChange(size)}
                            sx={{
                                width: 36,
                                height: 36,
                                fontSize: size * 0.5,
                                fontWeight: 700,
                                border: captionStyle.fontSize === size ? '2px solid #1877f2' : 'none',
                            }}
                        >
                            Aa
                        </IconButton>
                    ))}
                </Box>
            </Popover>

            {/* Text Color Popover */}
            <Popover
                open={Boolean(colorAnchor)}
                anchorEl={colorAnchor}
                onClose={() => setColorAnchor(null)}
                anchorOrigin={{ vertical: 'center', horizontal: 'left' }}
                transformOrigin={{ vertical: 'center', horizontal: 'right' }}
            >
                <Box sx={{ p: 1, display: 'flex', flexWrap: 'wrap', width: 160, gap: 0.5 }}>
                    {COLORS.map((color) => (
                        <IconButton
                            key={color}
                            onClick={() => handleColorChange(color)}
                            sx={{
                                width: 28,
                                height: 28,
                                bgcolor: color,
                                border: color === '#FFFFFF' ? '1px solid #ccc' : 'none',
                                '&:hover': { transform: 'scale(1.1)' },
                            }}
                        >
                            {captionStyle.color === color && (
                                <CheckIcon sx={{ fontSize: 16, color: color === '#FFFFFF' ? '#000' : '#fff' }} />
                            )}
                        </IconButton>
                    ))}
                </Box>
            </Popover>

            {/* Background Color Popover */}
            <Popover
                open={Boolean(bgColorAnchor)}
                anchorEl={bgColorAnchor}
                onClose={() => setBgColorAnchor(null)}
                anchorOrigin={{ vertical: 'center', horizontal: 'left' }}
                transformOrigin={{ vertical: 'center', horizontal: 'right' }}
            >
                <Box sx={{ p: 1, display: 'flex', flexWrap: 'wrap', width: 160, gap: 0.5 }}>
                    {BG_COLORS.map((color) => (
                        <IconButton
                            key={color}
                            onClick={() => handleBgColorChange(color)}
                            sx={{
                                width: 28,
                                height: 28,
                                bgcolor: color === 'transparent' ? 'white' : color,
                                border: '1px solid #ccc',
                                '&:hover': { transform: 'scale(1.1)' },
                            }}
                        >
                            {captionStyle.backgroundColor === color && (
                                <CheckIcon sx={{ fontSize: 16, color: '#1877f2' }} />
                            )}
                        </IconButton>
                    ))}
                </Box>
            </Popover>
        </>
    );
}
