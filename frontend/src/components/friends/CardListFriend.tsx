'use client';
import { Box, Card, CardContent, Typography, Avatar, Button } from '@mui/material';
import { FriendType } from '@/types/account';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSocket } from '@/contexts/SocketContext';


export default function CardListFriendComponent({ friend }: { friend: FriendType }) {
    const { user } = useAuthStore();
    const { socketRelationship } = useSocket();
    const handleCancel = (friendId: string) => {
        socketRelationship?.emit("friend:cancel", { userId: user?.id, friendId, status: 'CANCELED' });
    }



    return (
        <Card key={friend._id} sx={{ borderRadius: 2, border: 1, borderColor: "#ddd", boxShadow: '0 1px 2px rgba(0,0,0,0.1)', bgcolor: 'white' }}>
            <CardContent sx={{ p: 0 }}>
                <Box sx={{ position: 'relative', pb: '100%', bgcolor: '#e4e6eb', borderRadius: '8px 8px 0 0', overflow: 'hidden' }}>
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
                    <Typography fontWeight={600} fontSize={15} color="#050505" sx={{ mb: 0.5 }}>
                        {friend.firstName + " " + friend.lastName}
                    </Typography>
                    <Typography variant="body2" color="#65676b" fontSize={13} sx={{ mb: 1.5 }}>
                        0 bạn chung
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Button
                            fullWidth
                            variant="contained"
                            sx={{
                                bgcolor: '#1877f2',
                                textTransform: 'none',
                                fontWeight: 600,
                                py: 1,
                                '&:hover': {
                                    bgcolor: '#166fe5',
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
                                bgcolor: '#e4e6eb',
                                color: '#050505',
                                textTransform: 'none',
                                fontWeight: 600,
                                py: 1,
                                '&:hover': {
                                    bgcolor: '#d8dadf',
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
