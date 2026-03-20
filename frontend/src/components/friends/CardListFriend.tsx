'use client';
import { Box, Card, CardContent, Typography, Avatar, Button, useTheme } from '@mui/material';
import { FriendType } from '@/types/account';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSocket } from '@/contexts/SocketContext';
import { useRouter } from 'next/navigation';
import { CLIENT_PATH } from '@/constants/paths';


export default function CardListFriendComponent({ friend }: { friend: FriendType }) {
    const { user } = useAuthStore();
    const router = useRouter();
    const { socketRelationship } = useSocket();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const handleCancel = (friendId: string) => {
        socketRelationship?.emit("friend:cancel", { userId: user?.id, friendId, status: 'CANCELED' });
    }

    const hoverBg = isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb';
    const cancelBg = isDark ? 'rgba(255,255,255,0.15)' : '#e4e6eb';

    return (
        <Card key={friend._id} sx={{ borderRadius: 2, boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.1)' }}>
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
                        0 bạn chung
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Button
                            onClick={() => router.push(CLIENT_PATH.PROFILE_BY_USERNAME(friend.username))}
                            fullWidth
                            variant="contained"
                            sx={{
                                bgcolor: 'primary.main',
                                textTransform: 'none',
                                fontWeight: 600,
                                py: 1,
                                boxShadow: 'none',
                                '&:hover': {
                                    bgcolor: 'primary.dark',
                                    boxShadow: 'none',
                                },
                            }}
                        >
                            Xem chi tiết
                        </Button>
                        <Button
                            fullWidth
                            onClick={() => handleCancel(friend._id)}
                            variant="contained"
                            sx={{
                                bgcolor: cancelBg,
                                color: 'text.primary',
                                textTransform: 'none',
                                fontWeight: 600,
                                py: 1,
                                boxShadow: 'none',
                                '&:hover': {
                                    bgcolor: isDark ? 'rgba(255,255,255,0.2)' : '#d8dadf',
                                    boxShadow: 'none',
                                },
                            }}
                        >
                            Hủy kết bạn
                        </Button>
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}
