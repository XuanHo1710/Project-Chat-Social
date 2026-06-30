'use client';

import { Avatar, Box, Typography, Tooltip } from '@mui/material';
import { MutualFriendPreviewType } from '@/types/account';

interface MutualFriendsPreviewProps {
    count?: number;
    preview?: MutualFriendPreviewType[];
    compact?: boolean;
}

export default function MutualFriendsPreview({
    count = 0,
    preview = [],
    compact = false,
}: MutualFriendsPreviewProps) {
    const topPreview = preview.slice(0, 3);
    const restCount = Math.max(0, count - topPreview.length);
    const size = compact ? 24 : 28;

    return (
        <Box sx={{ minHeight: size, display: 'flex', alignItems: 'center', mb: compact ? 1 : 1.5 }}>
            {topPreview.length > 0 ? (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {topPreview.map((mutual, index) => {
                        const fullName = `${mutual.firstName || ''} ${mutual.lastName || ''}`.trim() || 'Bạn chung';
                        return (
                            <Tooltip key={mutual._id} title={fullName} arrow placement="top">
                                <Avatar
                                    src={mutual.avatar || ''}
                                    sx={{
                                        width: size,
                                        height: size,
                                        border: '2px solid',
                                        borderColor: 'background.paper',
                                        ml: index === 0 ? 0 : -0.8,
                                        fontSize: compact ? 10 : 12,
                                        zIndex: 10 - index,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {mutual.firstName?.[0] || mutual.lastName?.[0] || '?'}
                                </Avatar>
                            </Tooltip>
                        );
                    })}
                    {restCount > 0 && (
                        <Tooltip title={`và ${restCount} bạn chung khác`} arrow placement="top">
                            <Avatar
                                sx={{
                                    width: size,
                                    height: size,
                                    border: '2px solid',
                                    borderColor: 'background.paper',
                                    ml: -0.8,
                                    fontSize: compact ? 10 : 11,
                                    zIndex: 6,
                                    bgcolor: 'grey.300',
                                    color: 'text.primary',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                }}
                            >
                                +{restCount}
                            </Avatar>
                        </Tooltip>
                    )}
                </Box>
            ) : (
                <Typography variant="body2" color="text.secondary" fontSize={compact ? 12 : 13}>
                    {count} bạn chung
                </Typography>
            )}
        </Box>
    );
}
