'use client';

import { useEffect, useState } from 'react';
import { Box, Typography, IconButton, Divider, List, ListItemButton, ListItemIcon, ListItemText, useTheme } from '@mui/material';
import {
    Home as HomeIcon,
    PersonAdd as PersonAddIcon,
    Lightbulb as LightbulbIcon,
    People as PeopleIcon,
    Cake as CakeIcon,
    Settings as SettingsIcon,
} from '@mui/icons-material';
import Header from '@/components/home/Header';
import CardFriendShowAllComponent from '@/components/friends/CardFriendShowAll';
import { useAccountsByPage } from '@/queries/useAccountQueries';
import { useAuthStore } from '@/stores/useAuthStore';
import { useDisplayListFriends, useReceivedRequestFriends, useSentRequestFriends } from '@/queries/useRelationshipQueries';
import CardFriendSentRequestComponent from '@/components/friends/CardFriendSentRequest';
import { QUERY_KEYS } from '@/constants/query-keys';
import { useQueryClient } from '@tanstack/react-query';
import CardListFriendComponent from '@/components/friends/CardListFriend';
import CardFriendReceivedComponent from '@/components/friends/CardFriendReceived';
import { useSocket } from '@/contexts/SocketContext';
import { FriendType } from '@/types/account';
import { APIResponse } from '@/types/common';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export default function FriendsPage() {
    const [tabValue, setTabValue] = useState(0);
    const { user } = useAuthStore();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const queryClient = useQueryClient();
    const { socketRelationship } = useSocket();
    const { t } = useTranslation();

    const menuItems = [
        { id: 0, label: t('friends.home'), icon: <HomeIcon /> },
        { id: 1, label: t('friends.friend_requests'), icon: <PersonAddIcon /> },
        { id: 2, label: t('friends.suggestions'), icon: <LightbulbIcon /> },
        { id: 3, label: t('friends.all_friends'), icon: <PeopleIcon /> },
        { id: 4, label: t('friends.birthdays'), icon: <CakeIcon /> },
        { id: 5, label: t('friends.custom_lists'), icon: <SettingsIcon /> },
    ];

    const { data: allAccounts, isLoading: isLoadingAccounts } = useAccountsByPage(user?.id || "", { page: 1, size: 12 });
    const { data: sentRequests, isLoading: isLoadingSentRequests } = useSentRequestFriends(user?.id || "");
    const { data: listFriends, isLoading: isLoadingListFriends } = useDisplayListFriends(user?.id || "");
    const { data: receivedRequests, isLoading: isLoadingReceivedRequests } = useReceivedRequestFriends(user?.id || "");

    useEffect(() => {
        queryClient.invalidateQueries({
            queryKey: [QUERY_KEYS.ACCOUNTS_PAGINATED],
        });
    }, [tabValue, queryClient]);

    // Listen for friend events via socket
    useEffect(() => {
        if (!socketRelationship) return;

        const handleNewReceivedRequest = (data: FriendType[]) => {
            queryClient.setQueryData<APIResponse<FriendType[]>>(
                [QUERY_KEYS.RECEIVED_REQUEST_FRIENDS, user?.id || ""],
                () => ({ ...data, data: [...data] })
            );
        };

        const handleNewSentRequest = (data: FriendType[]) => {
            queryClient.setQueryData<APIResponse<FriendType[]>>(
                [QUERY_KEYS.SENT_REQUEST_FRIENDS, user?.id || ""],
                () => ({ ...data, data: [...data] })
            );
        };

        const handleListFriendsUpdate = (data: FriendType[]) => {
            queryClient.setQueryData<APIResponse<FriendType[]>>(
                [QUERY_KEYS.FRIENDS, user?.id || ""],
                () => ({ ...data, data: [...data] })
            );
        };

        socketRelationship.on("friend:received", handleNewReceivedRequest);
        socketRelationship.on("friend:sent", handleNewSentRequest);
        socketRelationship.on("friend:friends", handleListFriendsUpdate);

        return () => {
            socketRelationship.off("friend:received", handleNewReceivedRequest);
            socketRelationship.off("friend:sent", handleNewSentRequest);
            socketRelationship.off("friend:friends", handleListFriendsUpdate);
        };
    }, [socketRelationship, user, queryClient]);

    const hoverBg = isDark ? 'rgba(255,255,255,0.1)' : '#f0f2f5';

    return (
        <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
            <Header />

            <Box sx={{ pt: '56px', display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
                {/* Left Sidebar */}
                <Box
                    sx={{
                        width: { xs: '100%', md: 360 },
                        height: { xs: 'auto', md: 'calc(100vh - 56px)' },
                        position: { xs: 'sticky', md: 'sticky' },
                        top: 56,
                        bgcolor: 'background.paper',
                        boxShadow: isDark ? 'none' : '2px 0 4px rgba(0,0,0,0.1)',
                        zIndex: 10,
                    }}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5 }}>
                        <Typography variant="h5" fontWeight={700} sx={{ color: 'text.primary' }}>
                            {t('nav.friends')}
                        </Typography>
                        <IconButton sx={{ bgcolor: hoverBg }}>
                            <SettingsIcon />
                        </IconButton>
                    </Box>

                    <List sx={{
                        p: { xs: 1, md: 0 },
                        display: { xs: 'flex', md: 'block' },
                        overflowX: { xs: 'auto', md: 'visible' },
                        '&::-webkit-scrollbar': { display: 'none' }, // Hide scrollbar for cleaner look
                        scrollbarWidth: 'none'
                    }}>
                        {menuItems.map((item) => (
                            <ListItemButton
                                key={item.id}
                                onClick={() => setTabValue(item.id)}
                                sx={{
                                    borderRadius: 2,
                                    mb: { xs: 0, md: 0.5 },
                                    mr: { xs: 1, md: 0 },
                                    bgcolor: tabValue === item.id ? (isDark ? 'rgba(24, 119, 242, 0.2)' : '#e7f3ff') : 'transparent',
                                    '&:hover': {
                                        bgcolor: tabValue === item.id ? (isDark ? 'rgba(24, 119, 242, 0.2)' : '#e7f3ff') : hoverBg,
                                    },
                                    minWidth: { xs: 'auto', md: '100%' },
                                    whiteSpace: 'nowrap',
                                    px: { xs: 2, md: 2 }
                                }}
                            >
                                <ListItemIcon sx={{
                                    minWidth: { xs: 0, md: 36 },
                                    mr: { xs: 1, md: 0 },
                                    color: tabValue === item.id ? 'primary.main' : 'text.primary'
                                }}>
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText
                                    primary={item.label}
                                    primaryTypographyProps={{
                                        fontWeight: 500,
                                        fontSize: 15,
                                        color: tabValue === item.id ? 'primary.main' : 'text.primary'
                                    }}
                                />
                            </ListItemButton>
                        ))}
                    </List>
                </Box>

                {/* Main Content */}
                <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, overflowY: 'auto' }}>
                    {/* Tab 0 & 1: Lời mời kết bạn */}
                    {(tabValue === 0 || tabValue === 1) && (
                        <Box sx={{ mb: 4 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6" fontWeight={600} color="text.primary">
                                    {t('friends.friend_requests')}
                                </Typography>
                                <Link href="/friends?tab=received" style={{ textDecoration: 'none' }}>
                                    <Typography
                                        sx={{
                                            color: 'primary.main',
                                            fontSize: 15,
                                            cursor: 'pointer',
                                            '&:hover': { textDecoration: 'underline' }
                                        }}
                                    >
                                        Xem tất cả
                                    </Typography>
                                </Link>
                            </Box>

                            {!isLoadingReceivedRequests && receivedRequests?.data && receivedRequests.data.length > 0 ? (
                                <Box sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                                    gap: 2
                                }}>
                                    {receivedRequests.data.map((request) => (
                                        <CardFriendReceivedComponent friend={request} key={request._id} />
                                    ))}
                                </Box>
                            ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                    {t('friends.no_friend_requests')}
                                </Typography>
                            )}
                        </Box>
                    )}

                    {/* Tab 0: Những người bạn có thể biết */}
                    {tabValue === 0 && (
                        <Box sx={{ mb: 4 }}>
                            <Divider sx={{ my: 3 }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6" fontWeight={600} color="text.primary">
                                    {t('friends.people_you_may_know')}
                                </Typography>
                                <Link href="/friends?tab=suggestions" style={{ textDecoration: 'none' }}>
                                    <Typography
                                        sx={{
                                            color: 'primary.main',
                                            fontSize: 15,
                                            cursor: 'pointer',
                                            '&:hover': { textDecoration: 'underline' }
                                        }}
                                    >
                                        Xem tất cả
                                    </Typography>
                                </Link>
                            </Box>

                            {!isLoadingAccounts && allAccounts?.items && allAccounts.items.length > 0 ? (
                                <Box sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                                    gap: 2
                                }}>
                                    {allAccounts.items.slice(0, 10).map((account, index) => (
                                        <CardFriendShowAllComponent key={index} friend={account} />
                                    ))}
                                </Box>
                            ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                    {t('friends.no_suggestions')}
                                </Typography>
                            )}
                        </Box>
                    )}

                    {/* Tab 2: Gợi ý */}
                    {tabValue === 2 && (
                        <Box>
                            <Typography variant="h6" fontWeight={600} color="text.primary" sx={{ mb: 2 }}>
                                {t('friends.people_you_may_know')}
                            </Typography>

                            {!isLoadingAccounts && allAccounts?.items && allAccounts.items.length > 0 ? (
                                <Box sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                                    gap: 2
                                }}>
                                    {allAccounts.items.map((account, index) => (
                                        <CardFriendShowAllComponent key={index} friend={account} />
                                    ))}
                                </Box>
                            ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                    Không có gợi ý nào
                                </Typography>
                            )}
                        </Box>
                    )}

                    {/* Tab 3: Tất cả bạn bè */}
                    {tabValue === 3 && (
                        <Box>
                            <Typography variant="h6" fontWeight={600} color="text.primary" sx={{ mb: 2 }}>
                                {t('friends.all_friends')} ({listFriends?.data?.length || 0})
                            </Typography>

                            {!isLoadingListFriends && listFriends?.data && listFriends.data.length > 0 ? (
                                <Box sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                                    gap: 2
                                }}>
                                    {listFriends.data.map(friend => (
                                        <CardListFriendComponent key={friend._id} friend={friend} />
                                    ))}
                                </Box>
                            ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                    {t('friends.no_friends')}
                                </Typography>
                            )}
                        </Box>
                    )}

                    {/* Tab 4: Sinh nhật */}
                    {tabValue === 4 && (
                        <Box>
                            <Typography variant="h6" fontWeight={600} color="text.primary" sx={{ mb: 2 }}>
                                {t('friends.birthdays')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                {t('friends.no_birthdays_today')}
                            </Typography>
                        </Box>
                    )}

                    {/* Tab 5: Đang chờ phản hồi (Danh sách tùy chỉnh) */}
                    {tabValue === 5 && (
                        <Box>
                            <Typography variant="h6" fontWeight={600} color="text.primary" sx={{ mb: 2 }}>
                                {t('friends.sent_requests')}
                            </Typography>

                            {!isLoadingSentRequests && sentRequests?.data && sentRequests.data.length > 0 ? (
                                <Box sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                                    gap: 2
                                }}>
                                    {sentRequests.data.map((request) => (
                                        <CardFriendSentRequestComponent key={request._id} friend={request} />
                                    ))}
                                </Box>
                            ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                    {t('friends.no_sent_requests')}
                                </Typography>
                            )}
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
}
