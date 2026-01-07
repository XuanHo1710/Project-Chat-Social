'use client';
import { Box, Card, CardContent, Typography, Avatar, Button, CircularProgress } from '@mui/material';

import {
    PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { AccountCardFriendType } from '@/types/account';
import { useState } from 'react';
// import { useAddFriendMutation } from '@/queries/useRelationshipQueries';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSocket } from '@/contexts/SocketContext';
import { toast } from 'sonner';



export default function CardFriendShowAllComponent({ friend }: { friend: AccountCardFriendType }) {
    const { user } = useAuthStore();
    const [addFriend, setAddFriend] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const { socketRelationship } = useSocket();

    const handleAddFriend = (friendId: string) => {
        if (isLoading || !socketRelationship) return;

        setIsLoading(true);
        // Optimistic update
        setAddFriend(true);

        socketRelationship.emit("friend:request", { userId: user?.id, friendId }, (response: { success: boolean; error?: string }) => {
            setIsLoading(false);
            if (!response?.success) {
                // Revert on error
                setAddFriend(false);
                toast.error(response?.error || 'Không thể gửi lời mời kết bạn');
            } else {
                toast.success('Đã gửi lời mời kết bạn');
            }
        });
    };

    const handleCancelAddFriend = (friendId: string) => {
        if (isLoading || !socketRelationship) return;

        setIsLoading(true);
        // Optimistic update
        setAddFriend(false);

        socketRelationship.emit("friend:cancel", { userId: user?.id, friendId, status: 'CANCELED' }, (response: { success: boolean; error?: string }) => {
            setIsLoading(false);
            if (!response?.success) {
                // Revert on error
                setAddFriend(true);
                toast.error(response?.error || 'Không thể hủy lời mời');
            } else {
                toast.success('Đã hủy lời mời kết bạn');
            }
        });
    };


    return (
        <Card key={friend.id} sx={{ borderRadius: 2, border: 1, borderColor: "#ddd", boxShadow: '0 1px 2px rgba(0,0,0,0.1)', bgcolor: 'white' }}>
            <CardContent sx={{ p: 0 }}>
                <Box sx={{ position: 'relative', pb: '100%', bgcolor: '#e4e6eb', borderRadius: '8px 8px 0 0', overflow: 'hidden' }}>
                    <Avatar
                        src={`https://ui-avatars.com/api/?name=${friend.name.charAt(0)}&background=1877f2&color=fff&size=200`}
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
                        {friend.name}
                    </Typography>
                    <Typography variant="body2" color="#65676b" fontSize={13} sx={{ mb: 1.5 }}>
                        {friend.mutualFriends} bạn chung
                    </Typography>


                    {!addFriend ?
                        // Chưa kết bạn
                        <Button
                            fullWidth
                            onClick={() => handleAddFriend(friend.id)}
                            disabled={isLoading}
                            variant="contained"
                            startIcon={isLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <PersonAddIcon />}
                            sx={{
                                bgcolor: '#1877f2',
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: 15,
                                py: 1,
                                boxShadow: 'none',
                                '&:hover': {
                                    bgcolor: '#166fe5',
                                    boxShadow: 'none',
                                },
                                '&.Mui-disabled': {
                                    bgcolor: '#1877f2',
                                    color: 'white',
                                    opacity: 0.7,
                                },
                            }}
                        >
                            {isLoading ? 'Đang gửi...' : 'Thêm bạn bè'}
                        </Button>
                        :
                        // Đã gửi lời mời
                        <Button
                            fullWidth
                            onClick={() => handleCancelAddFriend(friend.id)}
                            disabled={isLoading}
                            variant="contained"
                            startIcon={isLoading ? <CircularProgress size={16} sx={{ color: '#050505' }} /> : null}
                            sx={{
                                bgcolor: '#e4e6eb',
                                color: '#050505',
                                textTransform: 'none',
                                fontWeight: 600,
                                py: 1,
                                '&:hover': {
                                    bgcolor: '#d8dadf',
                                },
                                '&.Mui-disabled': {
                                    bgcolor: '#e4e6eb',
                                    color: '#050505',
                                    opacity: 0.7,
                                },
                            }}
                        >
                            {isLoading ? 'Đang hủy...' : 'Hủy lời mời'}
                        </Button>
                    }



                </Box>
            </CardContent>
        </Card>
    );
}
