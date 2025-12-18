'use client';

import { useState } from 'react';
import { Box, Card, CardContent, Typography, Avatar, Button, IconButton } from '@mui/material';
import {
    PersonAdd as PersonAddIcon,
    Close as CloseIcon,
    MoreHoriz as MoreIcon,
} from '@mui/icons-material';
import Header from '@/components/Header';
import CardFriendShowAllComponent from '@/components/friends/CardFriendShowAll';
import { useAccountsByPage } from '@/queries/useAccountQueries';
import { useAuthStore } from '@/stores/useAuthStore';

// Mock data
const friendRequests = [
    {
        id: 1,
        name: 'Nguyễn Văn A',
        mutualFriends: 5,
        avatar: '/avatar1.jpg',
        time: '1 tuần',
    },
    {
        id: 2,
        name: 'Trần Thị B',
        mutualFriends: 12,
        avatar: '/avatar2.jpg',
        time: '2 ngày',
    },
    {
        id: 3,
        name: 'Lê Văn C',
        mutualFriends: 3,
        avatar: '/avatar3.jpg',
        time: '5 giờ',
    },
];

const pendingRequests = [
    {
        id: 1,
        name: 'Phạm Minh D',
        avatar: '/avatar4.jpg',
        time: '3 ngày',
    },
    {
        id: 2,
        name: 'Hoàng Thị E',
        avatar: '/avatar5.jpg',
        time: '1 tuần',
    },
];

const currentFriends = [
    {
        id: 1,
        name: 'Đức Khoa Quach',
        mutualFriends: 15,
        avatar: '/avatar1.jpg',
    },
    {
        id: 2,
        name: 'Trường Giang',
        mutualFriends: 8,
        avatar: '/avatar2.jpg',
    },
    {
        id: 3,
        name: 'Nghiêm Chí Thiên',
        mutualFriends: 20,
        avatar: '/avatar3.jpg',
    },
    {
        id: 4,
        name: 'Nguyễn Huy Hoàng',
        mutualFriends: 6,
        avatar: '/avatar4.jpg',
    },
    {
        id: 5,
        name: 'Hồ Minh Quân',
        mutualFriends: 11,
        avatar: '/avatar5.jpg',
    },
    {
        id: 6,
        name: 'Nam Nguyeen',
        mutualFriends: 4,
        avatar: '/avatar6.jpg',
    },
];

export default function FriendsPage() {
    const [tabValue, setTabValue] = useState(0);
    const { user } = useAuthStore();

    const { data: allAccounts, isLoading: isLoadingAccounts } = useAccountsByPage(user?.id || "", { page: 1, size: 12 });

    return (
        <Box sx={{ bgcolor: '#f0f2f5', minHeight: '100vh' }}>
            <Header />

            <Box sx={{ pt: '56px', display: 'flex' }}>
                {/* Left Sidebar */}
                <Box
                    sx={{
                        width: 360,
                        height: 'calc(100vh - 56px)',
                        position: 'sticky',
                        top: 56,
                        bgcolor: 'white',
                        boxShadow: '2px 0 4px rgba(0,0,0,0.1)',
                        overflowY: 'auto',
                        p: 2,
                    }}
                >
                    <Typography variant="h5" fontWeight={700} sx={{ mb: 2, color: '#050505', px: 1 }}>
                        Bạn bè
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Box
                            onClick={() => setTabValue(0)}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                p: 1.5,
                                borderRadius: 2,
                                cursor: 'pointer',
                                bgcolor: tabValue === 0 ? '#e7f3ff' : 'transparent',
                                '&:hover': {
                                    bgcolor: tabValue === 0 ? '#e7f3ff' : '#f0f2f5',
                                },
                            }}
                        >
                            <Typography sx={{ fontSize: 15, fontWeight: 600, color: tabValue === 0 ? '#1877f2' : '#050505' }}>
                                Trang chủ
                            </Typography>
                        </Box>

                        <Box
                            onClick={() => setTabValue(1)}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                p: 1.5,
                                borderRadius: 2,
                                cursor: 'pointer',
                                bgcolor: tabValue === 1 ? '#e7f3ff' : 'transparent',
                                '&:hover': {
                                    bgcolor: tabValue === 1 ? '#e7f3ff' : '#f0f2f5',
                                },
                            }}
                        >
                            <Typography sx={{ fontSize: 15, fontWeight: 600, color: tabValue === 1 ? '#1877f2' : '#050505' }}>
                                Lời mời kết bạn
                            </Typography>
                        </Box>

                        <Box
                            onClick={() => setTabValue(2)}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                p: 1.5,
                                borderRadius: 2,
                                cursor: 'pointer',
                                bgcolor: tabValue === 2 ? '#e7f3ff' : 'transparent',
                                '&:hover': {
                                    bgcolor: tabValue === 2 ? '#e7f3ff' : '#f0f2f5',
                                },
                            }}
                        >
                            <Typography sx={{ fontSize: 15, fontWeight: 600, color: tabValue === 2 ? '#1877f2' : '#050505' }}>
                                Gợi ý
                            </Typography>
                        </Box>

                        <Box
                            onClick={() => setTabValue(3)}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                p: 1.5,
                                borderRadius: 2,
                                cursor: 'pointer',
                                bgcolor: tabValue === 3 ? '#e7f3ff' : 'transparent',
                                '&:hover': {
                                    bgcolor: tabValue === 3 ? '#e7f3ff' : '#f0f2f5',
                                },
                            }}
                        >
                            <Typography sx={{ fontSize: 15, fontWeight: 600, color: tabValue === 3 ? '#1877f2' : '#050505' }}>
                                Tất cả bạn bè
                            </Typography>
                        </Box>

                        <Box
                            onClick={() => setTabValue(4)}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                p: 1.5,
                                borderRadius: 2,
                                cursor: 'pointer',
                                bgcolor: tabValue === 4 ? '#e7f3ff' : 'transparent',
                                '&:hover': {
                                    bgcolor: tabValue === 4 ? '#e7f3ff' : '#f0f2f5',
                                },
                            }}
                        >
                            <Typography sx={{ fontSize: 15, fontWeight: 600, color: tabValue === 4 ? '#1877f2' : '#050505' }}>
                                Đang chờ phản hồi
                            </Typography>
                        </Box>
                    </Box>
                </Box>

                {/* Main Content */}
                <Box sx={{ flex: 1, p: 4, maxWidth: 1100, mx: 'auto' }}>
                    <Box sx={{ bgcolor: 'white', borderRadius: 2, p: 3, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                        {/* Tab 0: Trang chủ */}
                        {tabValue === 0 && (
                            <Box>
                                {/* Friend Requests Section */}
                                {!isLoadingAccounts && allAccounts && allAccounts?.items?.length > 0 && (
                                    <Box sx={{ mb: 4 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                            <Typography variant="h5" fontWeight={700} color="#050505" sx={{ mb: 3 }}>
                                                Người dùng khác...
                                            </Typography>
                                            <Button
                                                sx={{
                                                    color: '#1877f2',
                                                    textTransform: 'none',
                                                    fontSize: '15px',
                                                    fontWeight: 500,
                                                }}
                                            >
                                                Xem tất cả
                                            </Button>
                                        </Box>

                                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
                                            {allAccounts.items.map((account, index) => (
                                                <CardFriendShowAllComponent key={index} friend={account} />
                                            ))}
                                        </Box>
                                    </Box>
                                )}
                            </Box>
                        )}

                        {/* Tab 1: Lời mời kết bạn */}
                        {tabValue === 1 && (
                            <Box>
                                {/* Friend Requests Section */}
                                {friendRequests.length > 0 && (
                                    <Box sx={{ mb: 4 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                            <Typography variant="h5" fontWeight={700} color="#050505" sx={{ mb: 3 }}>
                                                Lời mời kết bạn
                                            </Typography>
                                            <Button
                                                sx={{
                                                    color: '#1877f2',
                                                    textTransform: 'none',
                                                    fontSize: '15px',
                                                    fontWeight: 500,
                                                }}
                                            >
                                                Xem tất cả
                                            </Button>
                                        </Box>

                                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
                                            {friendRequests.map((request) => (
                                                <Card key={request.id} sx={{ borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)', bgcolor: 'white' }}>
                                                    <CardContent sx={{ p: 0 }}>
                                                        <Box sx={{ position: 'relative', pb: '100%', bgcolor: '#e4e6eb', borderRadius: '8px 8px 0 0', overflow: 'hidden' }}>
                                                            <Avatar
                                                                src={`https://ui-avatars.com/api/?name=${request.name}&background=1877f2&color=fff&size=200`}
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
                                                                {request.name}
                                                            </Typography>
                                                            <Typography variant="body2" color="#65676b" fontSize={13} sx={{ mb: 1.5 }}>
                                                                {request.mutualFriends} bạn chung
                                                            </Typography>
                                                            <Typography variant="caption" color="#65676b" fontSize={12} sx={{ mb: 2, display: 'block' }}>
                                                                {request.time}
                                                            </Typography>

                                                            <Box sx={{ display: 'flex', gap: 1 }}>
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
                                                                    Xác nhận
                                                                </Button>
                                                                <Button
                                                                    fullWidth
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
                                                                    Xóa
                                                                </Button>
                                                            </Box>
                                                        </Box>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </Box>
                                    </Box>
                                )}

                                {/* All Friends Section */}
                                <Box>
                                    <Typography variant="h6" fontWeight={700} color="#050505" sx={{ mb: 2 }}>
                                        Bạn bè ({currentFriends.length})
                                    </Typography>

                                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
                                        {currentFriends.map((friend) => (
                                            <Card key={friend.id} sx={{ borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)', bgcolor: 'white' }}>
                                                <CardContent sx={{ p: 0 }}>
                                                    <Box sx={{ position: 'relative', pb: '100%', bgcolor: '#e4e6eb', borderRadius: '8px 8px 0 0', overflow: 'hidden' }}>
                                                        <Avatar
                                                            src={`https://ui-avatars.com/api/?name=${friend.name}&background=1877f2&color=fff&size=200`}
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
                                                        <Typography variant="body2" color="#65676b" fontSize={13}>
                                                            {friend.mutualFriends} bạn chung
                                                        </Typography>
                                                    </Box>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </Box>
                                </Box>
                            </Box>
                        )}

                        {/* Tab 2: Gợi ý */}
                        {tabValue === 2 && (
                            <Box>
                                <Typography variant="h5" fontWeight={700} color="#050505" sx={{ mb: 3 }}>
                                    Những người bạn có thể biết
                                </Typography>

                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
                                    {[...friendRequests, ...pendingRequests].map((suggestion, index) => (
                                        <Card key={index} sx={{ borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                                            <CardContent sx={{ p: 0 }}>
                                                <Box sx={{ position: 'relative', pb: '100%', bgcolor: '#f0f2f5' }}>
                                                    <Avatar
                                                        src={`https://ui-avatars.com/api/?name=${suggestion.name}&background=1877f2&color=fff`}
                                                        sx={{
                                                            position: 'absolute',
                                                            top: 0,
                                                            left: 0,
                                                            width: '100%',
                                                            height: '100%',
                                                            borderRadius: 0,
                                                        }}
                                                    />
                                                    <IconButton
                                                        sx={{
                                                            position: 'absolute',
                                                            top: 8,
                                                            right: 8,
                                                            bgcolor: 'white',
                                                            '&:hover': { bgcolor: '#f0f2f5' },
                                                        }}
                                                    >
                                                        <CloseIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                                <Box sx={{ p: 2 }}>
                                                    <Typography fontWeight={600} fontSize={15} color="#050505" sx={{ mb: 0.5 }}>
                                                        {suggestion.name}
                                                    </Typography>
                                                    <Typography variant="body2" color="#65676b" fontSize={13} sx={{ mb: 2 }}>
                                                        {'mutualFriends' in suggestion ? `${suggestion.mutualFriends} bạn chung` : 'Bạn bè gợi ý'}
                                                    </Typography>

                                                    <Button
                                                        fullWidth
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
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </Box>
                            </Box>
                        )}

                        {/* Tab 3: Tất cả bạn bè */}
                        {tabValue === 3 && (
                            <Box>
                                <Typography variant="h5" fontWeight={700} color="#050505" sx={{ mb: 3 }}>
                                    Tất cả bạn bè ({currentFriends.length})
                                </Typography>

                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
                                    {currentFriends.map((friend) => (
                                        <Card key={friend.id} sx={{ borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                                            <CardContent sx={{ p: 0 }}>
                                                <Box sx={{ position: 'relative', pb: '100%', bgcolor: '#f0f2f5' }}>
                                                    <Avatar
                                                        src={`https://ui-avatars.com/api/?name=${friend.name}&background=1877f2&color=fff`}
                                                        sx={{
                                                            position: 'absolute',
                                                            top: 0,
                                                            left: 0,
                                                            width: '100%',
                                                            height: '100%',
                                                            borderRadius: 0,
                                                        }}
                                                    />
                                                    <IconButton
                                                        sx={{
                                                            position: 'absolute',
                                                            top: 8,
                                                            right: 8,
                                                            bgcolor: 'white',
                                                            '&:hover': { bgcolor: '#f0f2f5' },
                                                        }}
                                                    >
                                                        <MoreIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                                <Box sx={{ p: 2 }}>
                                                    <Typography fontWeight={600} fontSize={15} color="#050505" sx={{ mb: 0.5 }}>
                                                        {friend.name}
                                                    </Typography>
                                                    <Typography variant="body2" color="#65676b" fontSize={13}>
                                                        {friend.mutualFriends} bạn chung
                                                    </Typography>
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </Box>
                            </Box>
                        )}

                        {/* Tab 4: Đang chờ phản hồi */}
                        {tabValue === 4 && (
                            <Box>
                                <Typography variant="h5" fontWeight={700} color="#050505" sx={{ mb: 3 }}>
                                    Đang chờ phản hồi
                                </Typography>

                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
                                    {pendingRequests.map((request) => (
                                        <Card key={request.id} sx={{ borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                                            <CardContent sx={{ p: 0 }}>
                                                <Box sx={{ position: 'relative', pb: '100%', bgcolor: '#f0f2f5' }}>
                                                    <Avatar
                                                        src={`https://ui-avatars.com/api/?name=${request.name}&background=1877f2&color=fff`}
                                                        sx={{
                                                            position: 'absolute',
                                                            top: 0,
                                                            left: 0,
                                                            width: '100%',
                                                            height: '100%',
                                                            borderRadius: 0,
                                                        }}
                                                    />
                                                </Box>
                                                <Box sx={{ p: 2 }}>
                                                    <Typography fontWeight={600} fontSize={15} color="#050505" sx={{ mb: 0.5 }}>
                                                        {request.name}
                                                    </Typography>
                                                    <Typography variant="caption" color="#65676b" fontSize={12} sx={{ mb: 2, display: 'block' }}>
                                                        Đã gửi {request.time} trước
                                                    </Typography>

                                                    <Button
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
                                    ))}
                                </Box>
                            </Box>
                        )}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
