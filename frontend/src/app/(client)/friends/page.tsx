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

const menuItems = [
    { id: 0, label: 'Trang chủ', icon: <HomeIcon /> },
    { id: 1, label: 'Lời mời kết bạn', icon: <PersonAddIcon /> },
    { id: 2, label: 'Gợi ý', icon: <LightbulbIcon /> },
    { id: 3, label: 'Tất cả bạn bè', icon: <PeopleIcon /> },
    { id: 4, label: 'Sinh nhật', icon: <CakeIcon /> },
    { id: 5, label: 'Danh sách tùy chỉnh', icon: <SettingsIcon /> },
];

export default function FriendsPage() {
    const [tabValue, setTabValue] = useState(0);
    const { user } = useAuthStore();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const queryClient = useQueryClient();
    const { socketRelationship } = useSocket();

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

            <Box sx={{ pt: '56px', display: 'flex' }}>
                {/* Left Sidebar */}
                <Box
                    sx={{
                        width: 360,
                        height: 'calc(100vh - 56px)',
                        position: 'sticky',
                        top: 56,
                        bgcolor: 'background.paper',
                        boxShadow: isDark ? 'none' : '2px 0 4px rgba(0,0,0,0.1)',
                        overflowY: 'auto',
                        p: 1,
                    }}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1, py: 1.5 }}>
                        <Typography variant="h5" fontWeight={700} sx={{ color: 'text.primary' }}>
                            Bạn bè
                        </Typography>
                        <IconButton sx={{ bgcolor: hoverBg }}>
                            <SettingsIcon />
                        </IconButton>
                    </Box>

                    <List sx={{ p: 0 }}>
                        {menuItems.map((item) => (
                            <ListItemButton
                                key={item.id}
                                onClick={() => setTabValue(item.id)}
                                sx={{
                                    borderRadius: 2,
                                    mb: 0.5,
                                    bgcolor: tabValue === item.id ? (isDark ? 'rgba(24, 119, 242, 0.2)' : '#e7f3ff') : 'transparent',
                                    '&:hover': {
                                        bgcolor: tabValue === item.id ? (isDark ? 'rgba(24, 119, 242, 0.2)' : '#e7f3ff') : hoverBg,
                                    },
                                }}
                            >
                                <ListItemIcon sx={{
                                    minWidth: 36,
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
                <Box sx={{ flex: 1, p: 3, overflowY: 'auto' }}>
                    {/* Tab 0 & 1: Lời mời kết bạn */}
                    {(tabValue === 0 || tabValue === 1) && (
                        <Box sx={{ mb: 4 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6" fontWeight={600} color="text.primary">
                                    Lời mời kết bạn
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
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                    gap: 2
                                }}>
                                    {receivedRequests.data.map((request) => (
                                        <CardFriendReceivedComponent friend={request} key={request._id} />
                                    ))}
                                </Box>
                            ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                    Không có lời mời kết bạn nào
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
                                    Những người bạn có thể biết
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
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                    gap: 2
                                }}>
                                    {allAccounts.items.slice(0, 10).map((account, index) => (
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

                    {/* Tab 2: Gợi ý */}
                    {tabValue === 2 && (
                        <Box>
                            <Typography variant="h6" fontWeight={600} color="text.primary" sx={{ mb: 2 }}>
                                Những người bạn có thể biết
                            </Typography>

                            {!isLoadingAccounts && allAccounts?.items && allAccounts.items.length > 0 ? (
                                <Box sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
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
                                Tất cả bạn bè ({listFriends?.data?.length || 0})
                            </Typography>

                            {!isLoadingListFriends && listFriends?.data && listFriends.data.length > 0 ? (
                                <Box sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                                    gap: 2
                                }}>
                                    {listFriends.data.map(friend => (
                                        <CardListFriendComponent key={friend._id} friend={friend} />
                                    ))}
                                </Box>
                            ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                    Bạn chưa có bạn bè nào
                                </Typography>
                            )}
                        </Box>
                    )}

                    {/* Tab 4: Sinh nhật */}
                    {tabValue === 4 && (
                        <Box>
                            <Typography variant="h6" fontWeight={600} color="text.primary" sx={{ mb: 2 }}>
                                Sinh nhật
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                Không có sinh nhật nào hôm nay
                            </Typography>
                        </Box>
                    )}

                    {/* Tab 5: Đang chờ phản hồi (Danh sách tùy chỉnh) */}
                    {tabValue === 5 && (
                        <Box>
                            <Typography variant="h6" fontWeight={600} color="text.primary" sx={{ mb: 2 }}>
                                Lời mời đã gửi
                            </Typography>

                            {!isLoadingSentRequests && sentRequests?.data && sentRequests.data.length > 0 ? (
                                <Box sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                    gap: 2
                                }}>
                                    {sentRequests.data.map((request) => (
                                        <CardFriendSentRequestComponent key={request._id} friend={request} />
                                    ))}
                                </Box>
                            ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                    Bạn chưa gửi lời mời kết bạn nào
                                </Typography>
                            )}
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
}
