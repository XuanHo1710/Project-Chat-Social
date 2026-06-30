'use client';
import { Box, Card, CardContent, Typography, Avatar, Button, CircularProgress, useTheme } from '@mui/material';
import { FriendType } from '@/types/account';
import { useAuthStore } from '@/stores/useAuthStore';
import { useState } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { useRouter } from 'next/navigation';
import { CLIENT_PATH } from '@/constants/paths';
import MutualFriendsPreview from '@/components/friends/MutualFriendsPreview';

export default function CardFriendReceivedComponent({ friend }: { friend: FriendType }) {
    const { user } = useAuthStore();
    const { socketRelationship } = useSocket();
    const router = useRouter();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [status, setStatus] = useState<'pending' | 'accepted' | 'rejected'>('pending');
    const [isLoading, setIsLoading] = useState(false);

    const handleReject = (friendId: string) => {
        setIsLoading(true);
        socketRelationship?.emit("friend:cancel", { userId: user?.id, friendId, status: 'REJECTED' }, () => {
            setStatus('rejected');
            setIsLoading(false);
        });
    };

    const handleAcceptFriend = (friendId: string) => {
        setIsLoading(true);
        socketRelationship?.emit("friend:accept", { userId: user?.id, friendId }, () => {
            setStatus('accepted');
            setIsLoading(false);
        });
    };

    const navigateToProfile = () => {
        if (!friend.username) return;
        router.push(CLIENT_PATH.PROFILE_BY_USERNAME(friend.username));
    };

    const hoverBg = isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb';
    const cancelBg = isDark ? 'rgba(255,255,255,0.15)' : '#e4e6eb';

    // Don't render if rejected
    if (status === 'rejected') {
        return null;
    }

    const friendName = friend.firstName || friend.lastName
        ? `${friend.firstName || ''} ${friend.lastName || ''}`.trim()
        : 'Người dùng';

    return (
        <Card
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 2,
                boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.1)',
                overflow: 'hidden',
                transition: 'box-shadow 0.2s'
            }}
        >
            <CardContent sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                {/* Square Avatar Image */}
                <Box
                    onClick={navigateToProfile}
                    sx={{
                        position: 'relative',
                        paddingBottom: '100%',
                        cursor: 'pointer',
                        bgcolor: hoverBg,
                        overflow: 'hidden'
                    }}
                >
                    <Avatar
                        src={friend.avatar || ""}
                        sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            borderRadius: 0,
                        }}
                    />
                </Box>

                {/* Info Section */}
                <Box sx={{ p: 1.5, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    <Typography
                        onClick={navigateToProfile}
                        fontWeight={600}
                        fontSize={15}
                        color="text.primary"
                        sx={{
                            mb: 1,
                            cursor: 'pointer',
                            '&:hover': { textDecoration: 'underline' },
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            height: '40px',
                            lineHeight: '20px',
                        }}
                    >
                        {friendName}
                    </Typography>

                    <MutualFriendsPreview
                        count={friend.mutualFriends || 0}
                        preview={friend.mutualFriendPreview || []}
                    />

                    {/* Buttons */}
                    <Box sx={{ mt: 'auto' }}>
                        {status === 'pending' ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Button
                                    onClick={() => handleAcceptFriend(friend._id)}
                                    fullWidth
                                    variant="contained"
                                    disabled={isLoading}
                                    sx={{
                                        bgcolor: 'primary.main',
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        py: 1,
                                        fontSize: 14,
                                        borderRadius: 1,
                                        boxShadow: 'none',
                                        '&:hover': {
                                            bgcolor: 'primary.dark',
                                            boxShadow: 'none',
                                        },
                                    }}
                                >
                                    {isLoading ? <CircularProgress size={20} color="inherit" /> : 'Xác nhận'}
                                </Button>
                                <Button
                                    fullWidth
                                    variant="contained"
                                    onClick={() => handleReject(friend._id)}
                                    disabled={isLoading}
                                    sx={{
                                        bgcolor: cancelBg,
                                        color: 'text.primary',
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        py: 1,
                                        fontSize: 14,
                                        borderRadius: 1,
                                        boxShadow: 'none',
                                        '&:hover': {
                                            bgcolor: isDark ? 'rgba(255,255,255,0.2)' : '#d8dadf',
                                            boxShadow: 'none',
                                        },
                                    }}
                                >
                                    Xóa
                                </Button>
                            </Box>
                        ) : (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                fontSize={13}
                                sx={{ textAlign: 'center', py: 1 }}
                            >
                                Đã trở thành bạn bè
                            </Typography>
                        )}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}
