'use client';
import { Box, Card, CardContent, Typography, Avatar, Button } from '@mui/material';

import {
    PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { AccountCardFriendType } from '@/types/account';
import { useState } from 'react';
import { useAddFriendMutation } from '@/queries/useRelationshipQueries';
import { useAuthStore } from '@/stores/useAuthStore';



export default function CardFriendShowAllComponent({ friend }: { friend: AccountCardFriendType }) {
    const { user } = useAuthStore();
    const addFriendMutation = useAddFriendMutation(user?.id || "");
    const [addFriend, setAddFriend] = useState<boolean>(false);
    const handleAddFriend = (friendId: string) => {
        addFriendMutation.mutate({ userId: user?.id || "", friendId: friendId });
        setAddFriend(true);
    };

    const handleCancelAddFriend = (friendId: string) => {
        console.log(`Hủy kết bạn với ID: ${friendId}`);
        setAddFriend(false);
    }


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
                            variant="contained"
                            startIcon={<PersonAddIcon />}
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
                            }}
                        >
                            Thêm bạn bè
                        </Button>
                        :
                        // Đã kết bạn
                        <Button
                            fullWidth
                            onClick={() => handleCancelAddFriend(friend.id)}
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
                            Hủy
                        </Button>
                    }



                </Box>
            </CardContent>
        </Card>
    );
}
