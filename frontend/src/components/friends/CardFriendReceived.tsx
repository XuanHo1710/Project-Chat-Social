'use client';
import { Box, Card, CardContent, Typography, Avatar, Button } from '@mui/material';
import { FriendType } from '@/types/account';
import { timeAgo } from '@/utils/formatDate';
import { useAceeptFriendMutation, useUpdateStatusRelationshipMutation } from '@/queries/useRelationshipQueries';
import { useAuthStore } from '@/stores/useAuthStore';
import { useState } from 'react';


export default function CardFriendReceivedComponent({ friend }: { friend: FriendType }) {
    const { user } = useAuthStore();
    const [isFriend, setIsFriend] = useState(false);
    const cancelMutation = useUpdateStatusRelationshipMutation(user?.id || "");
    const acceptMutation = useAceeptFriendMutation(user?.id || "");

    const handleReject = (friendId: string) => {
        cancelMutation.mutate({
            userId: user?.id || "",
            friendId: friendId,
            status: 'REJECTED'
        })
    }

    const handleAcceptFriend = (friendId: string) => {
        acceptMutation.mutate({
            userId: user?.id || "",
            friendId: friendId
        })
        setIsFriend(true);
    }



    return (
        <Card key={friend._id} sx={{ borderRadius: 2, border: 1, borderColor: "#ddd", boxShadow: '0 1px 2px rgba(0,0,0,0.1)', bgcolor: 'white' }}>
            <CardContent sx={{ p: 0 }}>
                <Box sx={{ position: 'relative', pb: '100%', bgcolor: '#e4e6eb', borderRadius: '8px 8px 0 0', overflow: 'hidden' }}>
                    <Avatar
                        src={`https://ui-avatars.com/api/?name=${friend.firstName.charAt(0)}&background=1877f2&color=fff&size=200`}
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
                    <Typography variant="caption" color="#65676b" fontSize={12} sx={{ mb: 2, display: 'block' }}>
                        Đã gửi {timeAgo(friend.time)}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1 }}>
                        {!isFriend ? (
                            <>
                                <Button
                                    onClick={() => handleAcceptFriend(friend._id)}
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
                                    Chấp nhận
                                </Button>
                                <Button
                                    fullWidth
                                    variant="contained"
                                    onClick={() => handleReject(friend._id)}
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
                                    Từ chối
                                </Button>

                            </>
                        ) :
                            <Typography variant="caption" color="#65676b" fontSize={12} sx={{ mb: 2, display: 'block', textAlign: "center" }}>
                                Bạn đã là bạn bè
                            </Typography>
                        }
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}
