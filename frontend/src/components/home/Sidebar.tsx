'use client';

import { useState, useEffect } from 'react';
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Avatar, Divider, Collapse, Skeleton, Typography } from '@mui/material';
import {
    Group as GroupIcon,
    People as PeopleIcon,
    OndemandVideo as VideoIcon,
    Bookmark as BookmarkIcon,
    KeyboardArrowDown as ArrowDownIcon,
    KeyboardArrowUp as ArrowUpIcon,
    SmartToy as AIIcon,
    Message as MessageIcon,
} from '@mui/icons-material';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRouter } from 'next/navigation';
import { CLIENT_PATH } from '@/constants/paths';
import { groupService } from '@/services/group.service';
import { GroupWithMembership } from '@/types/group';

export default function Sidebar() {
    const { user } = useAuthStore();
    const router = useRouter();
    const [expanded, setExpanded] = useState(false);
    const [userGroups, setUserGroups] = useState<GroupWithMembership[]>([]);
    const [loadingGroups, setLoadingGroups] = useState(true);

    // Fetch user's joined groups
    useEffect(() => {
        const fetchGroups = async () => {
            if (!user?.id) return;
            try {
                setLoadingGroups(true);
                const response = await groupService.getMyGroups();
                setUserGroups(response || []);
            } catch (error) {
                console.error('Failed to fetch groups:', error);
            } finally {
                setLoadingGroups(false);
            }
        };
        fetchGroups();
    }, [user?.id]);

    const mainMenuItems = [
        {
            icon: null,
            label: user?.fullName || user?.username || 'User',
            avatar: true,
            avatarSrc: user?.avatar,
            path: user?.username ? CLIENT_PATH.PROFILE_BY_USERNAME(user.username) : '/'
        },
        { icon: <PeopleIcon sx={{ fontSize: 28 }} />, label: 'Bạn bè', path: '/friends', color: '#1877f2' },
        { icon: <GroupIcon sx={{ fontSize: 28 }} />, label: 'Nhóm', path: '/groups', color: '#1877f2' },
        { icon: <VideoIcon sx={{ fontSize: 28 }} />, label: 'Watch', path: '/reels', color: '#1877f2' },
        { icon: <BookmarkIcon sx={{ fontSize: 28 }} />, label: 'Đã lưu', path: '/saved', color: '#a333c8' },
    ];

    const expandedItems = [
        { icon: <AIIcon sx={{ fontSize: 28 }} />, label: 'Chat với AI', path: '/ai-chat', color: '#00a67e' },
        { icon: <MessageIcon sx={{ fontSize: 28 }} />, label: 'Messenger', path: '/chat', color: '#0084ff' },
    ];

    const handleItemClick = (path: string) => {
        router.push(path);
    };

    const handleGroupClick = (groupId: string) => {
        router.push(`/groups/${groupId}`);
    };

    return (
        <Box
            sx={{
                width: 280,
                height: 'calc(100vh - 56px)',
                position: 'fixed',
                left: 0,
                top: 56,
                overflowY: 'auto',
                pt: 1,
                px: 1,
                display: { xs: 'none', lg: 'block' },
                '&::-webkit-scrollbar': {
                    width: '8px',
                },
                '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'transparent',
                    borderRadius: '4px',
                },
                '&:hover::-webkit-scrollbar-thumb': {
                    backgroundColor: '#bcc0c4',
                },
            }}
        >
            <List sx={{ p: 0 }}>
                {mainMenuItems.map((item, index) => (
                    <ListItemButton
                        key={index}
                        onClick={() => handleItemClick(item.path)}
                        sx={{
                            borderRadius: 2,
                            py: 1,
                            '&:hover': {
                                bgcolor: '#e4e6eb',
                            },
                        }}
                    >
                        {item.avatar ? (
                            <ListItemIcon sx={{ minWidth: 44 }}>
                                <Avatar
                                    sx={{ width: 36, height: 36 }}
                                    src={item.avatarSrc || '/avatar-placeholder.jpg'}
                                />
                            </ListItemIcon>
                        ) : (
                            <ListItemIcon sx={{ minWidth: 44 }}>
                                <Box
                                    sx={{
                                        width: 36,
                                        height: 36,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: item.color || '#1877f2',
                                    }}
                                >
                                    {item.icon}
                                </Box>
                            </ListItemIcon>
                        )}
                        <ListItemText
                            primary={item.label}
                            primaryTypographyProps={{
                                fontSize: '15px',
                                fontWeight: 500,
                                color: '#050505',
                            }}
                        />
                    </ListItemButton>
                ))}

                {/* See More / See Less Toggle */}
                <ListItemButton
                    onClick={() => setExpanded(!expanded)}
                    sx={{
                        borderRadius: 2,
                        py: 1,
                        '&:hover': {
                            bgcolor: '#e4e6eb',
                        },
                    }}
                >
                    <ListItemIcon sx={{ minWidth: 44 }}>
                        <Box
                            sx={{
                                width: 36,
                                height: 36,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: '#e4e6eb',
                                borderRadius: '50%',
                            }}
                        >
                            {expanded ? <ArrowUpIcon /> : <ArrowDownIcon />}
                        </Box>
                    </ListItemIcon>
                    <ListItemText
                        primary={expanded ? "Thu gọn" : "Xem thêm"}
                        primaryTypographyProps={{
                            fontSize: '15px',
                            fontWeight: 500,
                            color: '#050505',
                        }}
                    />
                </ListItemButton>

                {/* Expanded Items */}
                <Collapse in={expanded} timeout="auto" unmountOnExit>
                    {expandedItems.map((item, index) => (
                        <ListItemButton
                            key={index}
                            onClick={() => handleItemClick(item.path)}
                            sx={{
                                borderRadius: 2,
                                py: 1,
                                '&:hover': {
                                    bgcolor: '#e4e6eb',
                                },
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 44 }}>
                                <Box
                                    sx={{
                                        width: 36,
                                        height: 36,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: item.color || '#1877f2',
                                    }}
                                >
                                    {item.icon}
                                </Box>
                            </ListItemIcon>
                            <ListItemText
                                primary={item.label}
                                primaryTypographyProps={{
                                    fontSize: '15px',
                                    fontWeight: 500,
                                    color: '#050505',
                                }}
                            />
                        </ListItemButton>
                    ))}
                </Collapse>
            </List>

            <Divider sx={{ my: 1.5, mx: 1 }} />

            {/* Your Groups Section */}
            <Box sx={{ px: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, px: 1 }}>
                    <Typography
                        sx={{
                            fontSize: '17px',
                            fontWeight: 600,
                            color: '#65676b',
                        }}
                    >
                        Lối tắt của bạn
                    </Typography>
                </Box>

                {/* Groups List */}
                <List sx={{ p: 0 }}>
                    {loadingGroups ? (
                        // Loading skeleton
                        [...Array(3)].map((_, index) => (
                            <ListItemButton key={index} sx={{ borderRadius: 2, py: 1 }}>
                                <ListItemIcon sx={{ minWidth: 44 }}>
                                    <Skeleton variant="rounded" width={36} height={36} sx={{ borderRadius: 1.5 }} />
                                </ListItemIcon>
                                <ListItemText>
                                    <Skeleton variant="text" width="70%" height={20} />
                                </ListItemText>
                            </ListItemButton>
                        ))
                    ) : userGroups.length > 0 ? (
                        userGroups.map((group) => (
                            <ListItemButton
                                key={group._id}
                                onClick={() => handleGroupClick(group._id)}
                                sx={{
                                    borderRadius: 2,
                                    py: 1,
                                    '&:hover': {
                                        bgcolor: '#e4e6eb',
                                    },
                                }}
                            >
                                <ListItemIcon sx={{ minWidth: 44 }}>
                                    <Avatar
                                        src={group.avatar || '/group-placeholder.jpg'}
                                        variant="rounded"
                                        sx={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: 1.5,
                                            bgcolor: '#e4e6eb',
                                        }}
                                    >
                                        <GroupIcon sx={{ fontSize: 20, color: '#65676b' }} />
                                    </Avatar>
                                </ListItemIcon>
                                <ListItemText
                                    primary={group.name}
                                    primaryTypographyProps={{
                                        fontSize: '16px',
                                        fontWeight: 500,
                                        color: '#050505',
                                        noWrap: true,
                                        sx: {
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }
                                    }}
                                    secondary={"Số thành viên:" + group.memberCount}
                                />
                            </ListItemButton>
                        ))
                    ) : (
                        <Box sx={{ px: 2, py: 1.5 }}>
                            <Typography sx={{ fontSize: 14, color: '#65676b' }}>
                                Chưa tham gia nhóm nào
                            </Typography>
                        </Box>
                    )}

                    {/* View All Groups Link */}
                    {userGroups.length > 0 && (
                        <ListItemButton
                            onClick={() => router.push('/groups')}
                            sx={{
                                borderRadius: 2,
                                py: 1,
                                '&:hover': {
                                    bgcolor: '#e4e6eb',
                                },
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 44 }}>
                                <Box
                                    sx={{
                                        width: 36,
                                        height: 36,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        bgcolor: '#e4e6eb',
                                        borderRadius: 1.5,
                                    }}
                                >
                                    <GroupIcon sx={{ fontSize: 20, color: '#65676b' }} />
                                </Box>
                            </ListItemIcon>
                            <ListItemText
                                primary="Xem tất cả nhóm"
                                primaryTypographyProps={{
                                    fontSize: '15px',
                                    fontWeight: 500,
                                    color: '#1877f2',
                                }}
                            />
                        </ListItemButton>
                    )}
                </List>
            </Box>

            {/* Footer */}
            <Box sx={{ px: 2, py: 2, mt: 2 }}>
                <Typography sx={{ fontSize: 12, color: '#65676b', lineHeight: 1.5 }}>
                    Quyền riêng tư · Điều khoản · Quảng cáo · Lựa chọn quảng cáo · Cookie · Xem thêm · Meta © 2024
                </Typography>
            </Box>
        </Box>
    );
}
