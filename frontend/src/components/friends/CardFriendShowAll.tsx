'use client';
import { Box, Card, CardContent, Typography, Avatar, Button, CircularProgress, useTheme } from '@mui/material';

import {
    PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { AccountCardFriendType } from '@/types/account';
import { useState } from 'react';
// import { useAddFriendMutation } from '@/queries/useRelationshipQueries';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSocket } from '@/contexts/SocketContext';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { CLIENT_PATH } from '@/constants/paths';
import MutualFriendsPreview from '@/components/friends/MutualFriendsPreview';
import { useTranslation } from 'react-i18next';



export default function CardFriendShowAllComponent({ friend }: { friend: AccountCardFriendType }) {
    const { user } = useAuthStore();
    const { t } = useTranslation();
    const router = useRouter();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
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
                toast.error(response?.error || t('card_friend.request_error'));
            } else {
                toast.success(t('card_friend.request_sent'));
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
                toast.error(response?.error || t('card_friend.cancel_error'));
            } else {
                toast.success(t('card_friend.cancel_success'));
            }
        });
    };


    const hoverBg = isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb';
    const cancelBg = isDark ? 'rgba(255,255,255,0.15)' : '#e4e6eb';

    const navigateToProfile = () => {
        if (!friend.username) return;
        router.push(CLIENT_PATH.PROFILE_BY_USERNAME(friend.username));
    };

    return (
        <Card key={friend.id} sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 2, boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.1)' }}>
            <CardContent sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
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
                <Box sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
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
                        {friend.name || 'Người dùng'}
                    </Typography>
                    <MutualFriendsPreview
                        count={friend.mutualFriends || 0}
                        preview={friend.mutualFriendPreview || []}
                    />

                    <Box sx={{ mt: 'auto' }}>
                        {!addFriend ? (
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
                                    fontSize: 14,
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
                                {isLoading ? t('card_friend.sending') : t('card_friend.add_friend')}
                            </Button>
                        ) : (
                            // Đã gửi lời mời
                            <Button
                                fullWidth
                                onClick={() => handleCancelAddFriend(friend.id)}
                                disabled={isLoading}
                                variant="contained"
                                startIcon={isLoading ? <CircularProgress size={16} sx={{ color: 'text.primary' }} /> : null}
                                sx={{
                                    bgcolor: cancelBg,
                                    color: 'text.primary',
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    fontSize: 14,
                                    py: 1,
                                    boxShadow: 'none',
                                    '&:hover': {
                                        bgcolor: isDark ? 'rgba(255,255,255,0.2)' : '#d8dadf',
                                        boxShadow: 'none',
                                    },
                                    '&.Mui-disabled': {
                                        bgcolor: cancelBg,
                                        color: 'text.primary',
                                        opacity: 0.7,
                                    },
                                }}
                            >
                                {isLoading ? t('card_friend.canceling') : t('card_friend.cancel')}
                            </Button>
                        )}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}
