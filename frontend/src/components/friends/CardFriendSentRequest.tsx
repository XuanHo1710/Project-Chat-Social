'use client';
import { Box, Card, CardContent, Typography, Avatar, Button, useTheme } from '@mui/material';
import { FriendType } from '@/types/account';
import { timeAgo } from '@/utils/formatDate';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSocket } from '@/contexts/SocketContext';


export default function CardFriendSentRequestComponent({ friend }: { friend: FriendType }) {
    const { socketRelationship } = useSocket();
    const { user } = useAuthStore();

    const handleCancel = (friendId: string) => {
        socketRelationship?.emit("friend:cancel", { userId: user?.id, friendId, status: 'CANCELED' });
    }

    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const hoverBg = isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb';
    const cancelBg = isDark ? 'rgba(255,255,255,0.15)' : '#e4e6eb';



    return (
        <Card key={friend._id} sx={{ borderRadius: 2, border: 1, borderColor: theme.palette.divider, boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.1)', bgcolor: 'background.paper' }}>
            <CardContent sx={{ p: 0 }}>
                <Box sx={{ position: 'relative', pb: '100%', bgcolor: hoverBg, borderRadius: '8px 8px 0 0', overflow: 'hidden' }}>
                    <Avatar
                        src={friend.avatar || ""}
                        sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            borderRadius: '8px 8px 0 0',
                        }}
                    />
                </Box>
                <Box sx={{ p: 2 }}>
                    <Typography fontWeight={600} fontSize={15} color="text.primary" sx={{ mb: 0.5 }}>
                        {friend.firstName + " " + friend.lastName}
                    </Typography>
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
