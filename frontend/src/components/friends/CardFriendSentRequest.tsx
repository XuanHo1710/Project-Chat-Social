'use client';
import { Box, Card, CardContent, Typography, Avatar, Button, useTheme } from '@mui/material';
import { FriendType } from '@/types/account';
import { timeAgo } from '@/utils/formatDate';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSocket } from '@/contexts/SocketContext';
import { useRouter } from 'next/navigation';
import { CLIENT_PATH } from '@/constants/paths';
import MutualFriendsPreview from '@/components/friends/MutualFriendsPreview';


export default function CardFriendSentRequestComponent({ friend }: { friend: FriendType }) {
    const { socketRelationship } = useSocket();
    const { user } = useAuthStore();
    const router = useRouter();

    const handleCancel = (friendId: string) => {
        socketRelationship?.emit("friend:cancel", { userId: user?.id, friendId, status: 'CANCELED' });
    }

    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const hoverBg = isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb';
    const cancelBg = isDark ? 'rgba(255,255,255,0.15)' : '#e4e6eb';

    const navigateToProfile = () => {
        if (!friend.username) return;
        router.push(CLIENT_PATH.PROFILE_BY_USERNAME(friend.username));
    };



    return (
        <Card key={friend._id} sx={{ borderRadius: 2, border: 1, borderColor: theme.palette.divider, boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.1)', bgcolor: 'background.paper' }}>
            <CardContent sx={{ p: 0 }}>
                <Box sx={{ position: 'relative', pb: '100%', bgcolor: hoverBg, borderRadius: '8px 8px 0 0', overflow: 'hidden' }}>
                    <Avatar
                        onClick={navigateToProfile}
                        src={friend.avatar || ""}
                        sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            borderRadius: '8px 8px 0 0',
                            cursor: 'pointer',
                        }}
                    />
                </Box>
                <Box sx={{ p: 2 }}>
                    <Typography
                        onClick={navigateToProfile}
                        fontWeight={600}
                        fontSize={15}
                        color="text.primary"
                        sx={{ mb: 0.5, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                    >
                        {friend.firstName + " " + friend.lastName}
                    </Typography>
                    <MutualFriendsPreview
                        count={friend.mutualFriends || 0}
                        preview={friend.mutualFriendPreview || []}
                        compact
                    />
                    <Typography variant="body2" color="text.secondary" fontSize={13} sx={{ mb: 1.5 }}>
                        Đã gửi {timeAgo(friend.time)}
                    </Typography>
                    <Button
                        onClick={() => handleCancel(friend._id)}
                        fullWidth
                        variant="contained"
                        sx={{
                            bgcolor: cancelBg,
                            color: 'text.primary',
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: 15,
                            py: 1,
                            boxShadow: 'none',
                            '&:hover': {
                                bgcolor: isDark ? 'rgba(255,255,255,0.2)' : '#d8dadf',
                                boxShadow: 'none',
                            },
                        }}
                    >
                        Hủy lời mời
                    </Button>
                </Box>
            </CardContent>
        </Card>
    );
}
