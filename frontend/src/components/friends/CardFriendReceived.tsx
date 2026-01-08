'use client';
import { Box, Card, CardContent, Typography, Avatar, Button, CircularProgress } from '@mui/material';
import { FriendType } from '@/types/account';
import { useAuthStore } from '@/stores/useAuthStore';
import { useState } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { useRouter } from 'next/navigation';

export default function CardFriendReceivedComponent({ friend }: { friend: FriendType }) {
    const { user } = useAuthStore();
    const { socketRelationship } = useSocket();
    const router = useRouter();
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
        router.push(`/profile/${friend.username}`);
    };

    // Don't render if rejected
    if (status === 'rejected') {
        return null;
    }

    return (
        <Card
            sx={{
                borderRadius: 2,
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                bgcolor: 'white',
                overflow: 'hidden',
                '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.15)' },
                transition: 'box-shadow 0.2s'
            }}
        >
            <CardContent sx={{ p: 0 }}>
                {/* Square Avatar Image */}
                <Box
                    onClick={navigateToProfile}
                    sx={{
                        position: 'relative',
                        paddingBottom: '100%',
                        cursor: 'pointer',
                        bgcolor: '#e4e6eb',
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
                <Box sx={{ p: 1.5 }}>
                    <Typography
                        onClick={navigateToProfile}
                        fontWeight={600}
                        fontSize={15}
                        color="#050505"
                        sx={{
                            mb: 0.25,
                            cursor: 'pointer',
                            '&:hover': { textDecoration: 'underline' }
                        }}
                    >
                        {friend.firstName} {friend.lastName}
                    </Typography>

                    <Typography variant="body2" color="#65676b" fontSize={13} sx={{ mb: 1.5 }}>
                        {friend.mutualFriends || 0} bạn chung
                    </Typography>

                    {/* Buttons */}
                    {status === 'pending' ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Button
                                onClick={() => handleAcceptFriend(friend._id)}
                                fullWidth
                                variant="contained"
                                disabled={isLoading}
                                sx={{
                                    bgcolor: '#1877f2',
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    py: 1,
                                    fontSize: 14,
                                    borderRadius: 1,
                                    boxShadow: 'none',
                                    '&:hover': {
                                        bgcolor: '#166fe5',
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
                                    bgcolor: '#e4e6eb',
                                    color: '#050505',
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    py: 1,
                                    fontSize: 14,
                                    borderRadius: 1,
                                    boxShadow: 'none',
                                    '&:hover': {
                                        bgcolor: '#d8dadf',
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
                            color="#65676b"
                            fontSize={13}
                            sx={{ textAlign: 'center', py: 1 }}
                        >
                            Đã trở thành bạn bè
                        </Typography>
                    )}
                </Box>
            </CardContent>
        </Card>
    );
}
