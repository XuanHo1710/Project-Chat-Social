'use client';

import { Avatar, Box, Typography } from '@mui/material';
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

    return (
        <Box sx={{ mb: compact ? 1 : 1.5 }}>
            {topPreview.length > 0 ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {topPreview.map((mutual, index) => (
                            <Avatar
                                key={mutual._id}
                                src={mutual.avatar || ''}
                                sx={{
                                    width: compact ? 20 : 22,
                                    height: compact ? 20 : 22,
                                    border: '2px solid',
                                    borderColor: 'background.paper',
                                    ml: index === 0 ? 0 : -0.8,
                                    fontSize: 10,
                                    zIndex: 10 - index,
                                }}
                            >
                                {mutual.firstName?.[0] || mutual.lastName?.[0] || '?'}
                            </Avatar>
                        ))}
                    </Box>
                    <Typography variant="body2" color="text.secondary" fontSize={compact ? 12 : 13}>
                        {topPreview
                            .map((mutual) => mutual.firstName)
                            .filter(Boolean)
                            .join(', ')}
                        {restCount > 0 ? ` và ${restCount}+` : ''} bạn chung
                    </Typography>
                </Box>
            ) : (
                <Typography variant="body2" color="text.secondary" fontSize={compact ? 12 : 13}>
                    {count} bạn chung
                </Typography>
            )}
        </Box>
    );
}
