'use client';

import { useState, useEffect } from 'react';
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Avatar, Divider, Collapse, Skeleton, Typography, useTheme } from '@mui/material';
import {
    Groups as GroupsIcon,
    People as PeopleIcon,
    OndemandVideo as VideoIcon,
    Bookmark as BookmarkIcon,
    KeyboardArrowDown as ArrowDownIcon,
    KeyboardArrowUp as ArrowUpIcon,
    SmartToy as AIIcon,
    Message as MessageIcon,
    Gamepad as GamepadIcon,
} from '@mui/icons-material';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRouter } from 'next/navigation';
import { CLIENT_PATH } from '@/constants/paths';
import { groupService } from '@/services/group.service';
import { conversationService } from '@/services/conversation.service';
import { GroupWithMembership } from '@/types/group';
import { useTranslation } from 'react-i18next';

export default function Sidebar() {
    const { user } = useAuthStore();
    const router = useRouter();
    const theme = useTheme();
    const { t } = useTranslation();
    const isDark = theme.palette.mode === 'dark';
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
        { icon: <PeopleIcon sx={{ fontSize: 28 }} />, label: t('nav.friends'), path: '/friends', color: '#1877f2' },
        { icon: <GroupsIcon sx={{ fontSize: 28 }} />, label: t('nav.groups'), path: '/groups', color: '#1e9f1cff' },
        { icon: <VideoIcon sx={{ fontSize: 28 }} />, label: t('nav.watch'), path: '/reels', color: '#1877f2' },
        { icon: <BookmarkIcon sx={{ fontSize: 28 }} />, label: t('nav.saved'), path: '/saved', color: '#a333c8' },
    ];

    const expandedItems = [
        { icon: <AIIcon sx={{ fontSize: 28 }} />, label: t('nav.aiChat'), path: '/ai-chat', color: '#00a67e' },
        { icon: <MessageIcon sx={{ fontSize: 28 }} />, label: t('nav.messenger'), path: '/chat', color: '#0084ff' },
        { icon: <GamepadIcon sx={{ fontSize: 28 }} />, label: t('nav.gamestore'), path: '/games', color: '#f44336' },
    ];

    const handleItemClick = async (path: string) => {
        if (path === '/ai-chat') {
            try {
                const conversation = await conversationService.createChatbotConversation();
                router.push(`/chat/${conversation._id}`);
            } catch (error) {
                console.error("Failed to create chatbot conversation", error);
            }
        } else {
            router.push(path);
        }
    };

    const handleGroupClick = (groupId: string) => {
        router.push(`/groups/${groupId}`);
    };

    const hoverBgColor = isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb';
    const iconBgColor = isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb';

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
                display: { xs: 'none', md: 'block' },
                '&::-webkit-scrollbar': {
                    width: '8px',
                },
                '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'transparent',
                    borderRadius: '4px',
                },
                '&:hover::-webkit-scrollbar-thumb': {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : '#bcc0c4',
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
                                bgcolor: hoverBgColor,
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
                                        color: item.color || 'primary.main',
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
                                color: 'text.primary',
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
                            bgcolor: hoverBgColor,
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
                                bgcolor: iconBgColor,
                                borderRadius: '50%',
                            }}
                        >
                            {expanded ? <ArrowUpIcon sx={{ color: 'text.primary' }} /> : <ArrowDownIcon sx={{ color: 'text.primary' }} />}
                        </Box>
                    </ListItemIcon>
                    <ListItemText
                        primary={expanded ? t('common.showLess') : t('common.showMore')}
                        primaryTypographyProps={{
                            fontSize: '15px',
                            fontWeight: 500,
                            color: 'text.primary',
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
                                    bgcolor: hoverBgColor,
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
                                    color: 'text.primary',
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
                            color: 'text.secondary',
                        }}
                    >
                        {t('sidebar.yourShortcuts')}
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
                                        bgcolor: hoverBgColor,
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
                                            bgcolor: iconBgColor,
                                        }}
                                    >
                                        <GroupsIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                                    </Avatar>
                                </ListItemIcon>
                                <ListItemText
                                    primary={group.name}
                                    primaryTypographyProps={{
                                        fontSize: '16px',
                                        fontWeight: 500,
                                        color: 'text.primary',
                                        noWrap: true,
                                        sx: {
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }
                                    }}
                                    secondary={t('groups.memberCount', { count: group.memberCount })}
                                />
                            </ListItemButton>
                        ))
                    ) : (
                        <Box sx={{ px: 2, py: 1.5 }}>
                            <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
                                {t('sidebar.noGroupsJoined')}
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
                                    bgcolor: hoverBgColor,
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
                                        bgcolor: iconBgColor,
                                        borderRadius: 1.5,
                                    }}
                                >
                                    <GroupsIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                                </Box>
                            </ListItemIcon>
                            <ListItemText
                                primary={t('sidebar.viewAllGroups')}
                                primaryTypographyProps={{
                                    fontSize: '15px',
                                    fontWeight: 500,
                                    color: 'primary.main',
                                }}
                            />
                        </ListItemButton>
                    )}
                </List>
            </Box>

            {/* Footer */}
            <Box sx={{ px: 2, py: 2, mt: 2 }}>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.5 }}>
                    {t('footer.privacy')} · {t('footer.terms')} · {t('footer.advertising')} · {t('footer.adChoices')} · {t('footer.cookies')} · {t('footer.more')} · Meta © 2024
                </Typography>
            </Box>
        </Box>
    );
}
