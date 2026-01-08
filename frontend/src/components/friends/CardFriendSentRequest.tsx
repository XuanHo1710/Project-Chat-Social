'use client';
import { Box, Card, CardContent, Typography, Avatar, Button } from '@mui/material';
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
                        Đã gửi {timeAgo(friend.time)}
                    </Typography>
                    <Button
                        onClick={() => handleCancel(friend._id)}
                        fullWidth
                        variant="contained"
                        sx={{
                            bgcolor: '#e4e6eb',
                            color: '#050505',
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: 15,
                            py: 1,
                            boxShadow: 'none',
                            '&:hover': {
                                bgcolor: '#d8dadf',
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
