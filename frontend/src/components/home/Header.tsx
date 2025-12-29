'use client';

import { useState } from 'react';
import { AppBar, Toolbar, Box, InputBase, IconButton, Avatar, Badge, ClickAwayListener } from '@mui/material';
import {
    Search as SearchIcon,
    Home as HomeIcon,
    People as PeopleIcon,
    Storefront as StorefrontIcon,
    Group as GroupIcon,
    Gamepad as GamepadIcon,
    Apps as AppsIcon,
    Message as MessageIcon,
    Notifications as NotificationsIcon
} from '@mui/icons-material';
import Link from 'next/link';
import { useAuthStore } from '@/stores/useAuthStore';
import { useConversationByUserId } from '@/queries/useConversationQueries';

import AvatarMenu from '../AvatarMenu';
import ChatPopup from '@/components/chats/ChatPopup';
import NotificationPopup from '@/components/NotificationPopup';
import { usePathname } from 'next/navigation';

export default function Header() {
    const { user } = useAuthStore();
    const pathname = usePathname();
    const [showChatPopup, setShowChatPopup] = useState(false);
    const [showNotificationPopup, setShowNotificationPopup] = useState(false);
    const [showAvatarMenu, setShowAvatarMenu] = useState(false);

    const { data: listConversation, isLoading: isLoadingConversations } = useConversationByUserId(user?.id || "");

    return (
        <AppBar
            position="fixed"
            sx={{
                bgcolor: 'white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                borderBottom: '1px solid #e4e6eb'
            }}
        >
            <Toolbar sx={{ justifyContent: 'space-between', py: 0.5 }}>
                {/* Left Section - Logo & Search */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                    <Link href="/" style={{ textDecoration: 'none' }}>
                        <Box
                            sx={{
                                width: 40,
                                height: 40,
                                borderRadius: '50%',
                                bgcolor: '#1877f2',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '24px',
                                fontWeight: 'bold',
                                color: 'white',
                                cursor: 'pointer',
                                '&:hover': {
                                    opacity: 0.9
                                }
                            }}
                        >
                            f
                        </Box>
                    </Link>

                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            bgcolor: '#f0f2f5',
                            borderRadius: '50px',
                            px: 2,
                            py: 1,
                            maxWidth: 240,
                            width: '100%'
                        }}
                    >
                        <SearchIcon sx={{ color: '#65676b', mr: 1 }} />
                        <InputBase
                            placeholder="Tìm kiếm trên Facebook"
                            sx={{
                                flex: 1,
                                color: '#050505',
                                '& input::placeholder': {
                                    color: '#65676b',
                                    opacity: 1
                                }
                            }}
                        />
                    </Box>
                </Box>

                {/* Center Section - Navigation */}
                <Box
                    sx={{
                        display: { xs: 'none', md: 'flex' },
                        gap: 1,
                        flex: 2,
                        justifyContent: 'center'
                    }}
                >
                    <Link href="/" style={{ textDecoration: 'none' }}>
                        <IconButton
                            sx={{
                                px: 4,
                                borderRadius: pathname === '/' ? 0 : 2,
                                borderBottom: pathname === '/' ? '3px solid #1877f2' : 'none',
                                color: pathname === '/' ? '#1877f2' : '#65676b',
                                '&:hover': { bgcolor: '#f0f2f5' }
                            }}
                        >
                            <HomeIcon />
                        </IconButton>
                    </Link>
                    <Link href="/friends" style={{ textDecoration: 'none' }}>
                        <IconButton
                            sx={{
                                px: 4,
                                borderRadius: pathname === '/friends' ? 0 : 2,
                                borderBottom: pathname === '/friends' ? '3px solid #1877f2' : 'none',
                                color: pathname === '/friends' ? '#1877f2' : '#65676b',
                                '&:hover': { bgcolor: '#f0f2f5' }
                            }}
                        >
                            <PeopleIcon />
                        </IconButton>
                    </Link>
                    <IconButton
                        sx={{
                            px: 4,
                            borderRadius: 2,
                            color: '#65676b',
                            '&:hover': { bgcolor: '#f0f2f5' }
                        }}
                    >
                        <StorefrontIcon />
                    </IconButton>
                    <IconButton
                        sx={{
                            px: 4,
                            borderRadius: 2,
                            color: '#65676b',
                            '&:hover': { bgcolor: '#f0f2f5' }
                        }}
                    >
                        <GroupIcon />
                    </IconButton>
                    <IconButton
                        sx={{
                            px: 4,
                            borderRadius: 2,
                            color: '#65676b',
                            '&:hover': { bgcolor: '#f0f2f5' }
                        }}
                    >
                        <GamepadIcon />
                    </IconButton>
                </Box>

                {/* Right Section - Icons & Avatar */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        flex: 1,
                        justifyContent: 'flex-end',
                        position: 'relative'
                    }}
                >
                    <IconButton
                        sx={{
                            bgcolor: '#e4e6eb',
                            width: 40,
                            height: 40,
                            '&:hover': { bgcolor: '#d8dadf' }
                        }}
                    >
                        <AppsIcon sx={{ color: '#050505' }} />
                    </IconButton>

                    <Box sx={{ position: 'relative' }}>
                        <IconButton
                            onClick={() => {
                                setShowChatPopup(!showChatPopup);
                                setShowNotificationPopup(false);
                            }}
                            sx={{
                                bgcolor: showChatPopup ? '#d8dadf' : '#e4e6eb',
                                width: 40,
                                height: 40,
                                '&:hover': { bgcolor: '#d8dadf' }
                            }}
                        >
                            <Badge badgeContent={4} color="error">
                                <MessageIcon sx={{ color: '#050505' }} />
                            </Badge>
                        </IconButton>

                        {showChatPopup && (
                            <ClickAwayListener onClickAway={() => setShowChatPopup(false)}>
                                <Box>
                                    <ChatPopup
                                        conversations={listConversation?.data || []}
                                        isLoading={isLoadingConversations}
                                        userId={user?.id}
                                    />
                                </Box>
                            </ClickAwayListener>
                        )}
                    </Box>

                    <Box sx={{ position: 'relative' }}>
                        <IconButton
                            onClick={() => {
                                setShowNotificationPopup(!showNotificationPopup);
                                setShowChatPopup(false);
                            }}
                            sx={{
                                bgcolor: showNotificationPopup ? '#d8dadf' : '#e4e6eb',
                                width: 40,
                                height: 40,
                                '&:hover': { bgcolor: '#d8dadf' }
                            }}
                        >
                            <Badge badgeContent={9} color="error">
                                <NotificationsIcon sx={{ color: '#050505' }} />
                            </Badge>
                        </IconButton>

                        {showNotificationPopup && (
                            <ClickAwayListener onClickAway={() => setShowNotificationPopup(false)}>
                                <Box>
                                    <NotificationPopup />
                                </Box>
                            </ClickAwayListener>
                        )}
                    </Box>

                    <Box sx={{ position: 'relative' }}>
                        <Avatar
                            onClick={() => {
                                setShowAvatarMenu(!showAvatarMenu);
                                setShowChatPopup(false);
                                setShowNotificationPopup(false);
                            }}
                            sx={{
                                width: 40,
                                height: 40,
                                cursor: 'pointer',
                                border: showAvatarMenu ? '2px solid #1877f2' : 'none'
                            }}
                            alt={user?.fullName || user?.username || 'User'}
                            src={user?.avatar || '/avatar-placeholder.jpg'}
                        />

                        {showAvatarMenu && (
                            <ClickAwayListener onClickAway={() => setShowAvatarMenu(false)}>
                                <Box>
                                    <AvatarMenu onClose={() => setShowAvatarMenu(false)} />
                                </Box>
                            </ClickAwayListener>
                        )}
                    </Box>
                </Box>
            </Toolbar>
        </AppBar>
    );
}
