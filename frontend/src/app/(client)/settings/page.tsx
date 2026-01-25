'use client';

import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Switch,
    Button,
    Avatar,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
    Divider,
    useTheme,
    alpha,
} from '@mui/material';
import {
    Visibility as VisibilityIcon,
    Block as BlockIcon,
    Lock as LockIcon,
    PersonOff as PersonOffIcon,
    ArrowBack as ArrowBackIcon,
    ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { accountService, UserSettings } from '@/services/account.service';
import { relationshipService, BlockedUser, RestrictedUser } from '@/services/relationship.service';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/contexts/SocketContext';
import { useTranslation } from 'react-i18next';

// Simple date formatter
const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
};

const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export default function SettingsPage() {
    const router = useRouter();
    const { socketChat } = useSocket();
    const theme = useTheme();
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
    const [restrictedUsers, setRestrictedUsers] = useState<RestrictedUser[]>([]);
    const [showBlockConfirm, setShowBlockConfirm] = useState(false);
    const [savingActivity, setSavingActivity] = useState(false);
    const [blockingAccount, setBlockingAccount] = useState(false);

    // Expanded sections
    const [expandedBlocked, setExpandedBlocked] = useState(false);
    const [expandedRestricted, setExpandedRestricted] = useState(false);
    const { t } = useTranslation();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);

            // Load settings first
            try {
                const settingsData = await accountService.getSettings();
                setSettings(settingsData);
            } catch (e) {
                console.error('Failed to load settings:', e);
                setSettings({ showActivityStatus: true, isActive: true, isSelfBlocked: false });
            }

            // Load blocked users (may fail if feature not available)
            try {
                const blockedData = await relationshipService.getBlockedUsers();
                setBlockedUsers(blockedData);
            } catch (e) {
                console.error('Failed to load blocked users:', e);
                setBlockedUsers([]);
            }

            // Load restricted users (may fail if feature not available)
            try {
                const restrictedData = await relationshipService.getRestrictedUsers();
                setRestrictedUsers(restrictedData);
            } catch (e) {
                console.error('Failed to load restricted users:', e);
                setRestrictedUsers([]);
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleActivityStatus = async () => {
        if (!settings) return;

        try {
            setSavingActivity(true);
            const newStatus = !settings.showActivityStatus;
            await accountService.toggleActivityStatus(newStatus);
            setSettings({ ...settings, showActivityStatus: newStatus });

            // Emit socket event to notify other users in real-time
            if (socketChat) {
                socketChat.emit('activity:toggle', { showActivityStatus: newStatus });
            }

            toast.success(settings.showActivityStatus ? t('settings.activity_off') : t('settings.activity_on'));
        } catch (error) {
            console.error('Failed to toggle activity status:', error);
            toast.error(t('settings.change_failed'));
        } finally {
            setSavingActivity(false);
        }
    };

    const handleSelfBlock = async () => {
        try {
            setBlockingAccount(true);
            await accountService.selfBlockAccount();
            toast.success(t('settings.account_locked'));
            setShowBlockConfirm(false);
            // Redirect to login
            router.push('/auth/login');
        } catch (error) {
            console.error('Failed to block account:', error);
            toast.error(t('settings.lock_failed'));
        } finally {
            setBlockingAccount(false);
        }
    };

    const handleUnblockUser = async (userId: string) => {
        try {
            await relationshipService.unblockUser(userId);
            setBlockedUsers(blockedUsers.filter(u => u._id !== userId));
            toast.success(t('settings.user_unblocked'));
        } catch (error) {
            console.error('Failed to unblock user:', error);
            toast.error(t('settings.unblock_failed'));
        }
    };

    const handleUnrestrictUser = async (userId: string) => {
        try {
            await relationshipService.unrestrictUser(userId);
            setRestrictedUsers(restrictedUsers.filter(u => u._id !== userId));
            toast.success(t('settings.user_unrestricted'));
        } catch (error) {
            console.error('Failed to unrestrict user:', error);
            toast.error(t('settings.unrestrict_failed'));
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            {/* Header */}
            <Box sx={{
                bgcolor: 'background.paper',
                borderBottom: 1,
                borderColor: 'divider',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}>
                <Box sx={{ maxWidth: 680, mx: 'auto', px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton onClick={() => router.back()} sx={{ color: 'text.primary' }}>
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'text.primary' }}>
                        {t('settings.settings_privacy')}
                    </Typography>
                </Box>
            </Box>

            {/* Content */}
            <Box sx={{ maxWidth: 680, mx: 'auto', py: 2, px: 2 }}>
                {/* Activity Status Section */}
                <Box sx={{
                    bgcolor: 'background.paper',
                    borderRadius: '8px',
                    mb: 2,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                    border: 1,
                    borderColor: 'divider',
                }}>
                    <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                        <Typography sx={{ fontSize: 17, fontWeight: 600, color: 'text.primary' }}>
                            {t('settings.activity_status')}
                        </Typography>
                    </Box>
                    <Box sx={{
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                        transition: 'background 0.15s',
                    }}>
                        <Box sx={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <VisibilityIcon sx={{ color: 'primary.main', fontSize: 22 }} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>
                                {t('settings.show_activity')}
                            </Typography>
                            <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.25 }}>
                                {t('settings.show_activity_desc')}
                            </Typography>
                        </Box>
                        <Switch
                            checked={settings?.showActivityStatus ?? true}
                            onChange={handleToggleActivityStatus}
                            disabled={savingActivity}
                            sx={{
                                '& .MuiSwitch-switchBase.Mui-checked': {
                                    color: 'primary.main',
                                },
                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                    backgroundColor: 'primary.main',
                                },
                            }}
                        />
                    </Box>
                </Box>

                {/* Blocked Users Section */}
                <Box sx={{
                    bgcolor: 'background.paper',
                    borderRadius: '8px',
                    mb: 2,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                    border: 1,
                    borderColor: 'divider',
                }}>
                    <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                        <Typography sx={{ fontSize: 17, fontWeight: 600, color: 'text.primary' }}>
                            {t('settings.block')}
                        </Typography>
                    </Box>
                    <Box
                        onClick={() => setExpandedBlocked(!expandedBlocked)}
                        sx={{
                            p: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' },
                            transition: 'background 0.15s',
                        }}
                    >
                        <Box sx={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            bgcolor: alpha(theme.palette.error.main, 0.1),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <BlockIcon sx={{ color: 'error.main', fontSize: 22 }} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>
                                {t('settings.blocked_users')}
                            </Typography>
                            <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.25 }}>
                                {blockedUsers.length === 0 ? t('settings.no_blocked') : `${blockedUsers.length} ${t('settings.users')}`}
                            </Typography>
                        </Box>
                        <ChevronRightIcon sx={{
                            color: 'text.secondary',
                            fontSize: 24,
                            transform: expandedBlocked ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s',
                        }} />
                    </Box>

                    {expandedBlocked && blockedUsers.length > 0 && (
                        <Box sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
                            {blockedUsers.map((user, index) => (
                                <Box key={user._id}>
                                    <Box sx={{
                                        px: 2,
                                        py: 1.5,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        '&:hover': { bgcolor: 'action.hover' },
                                    }}>
                                        <Avatar src={user.avatar} sx={{ width: 48, height: 48 }}>
                                            {user.firstName?.[0]}
                                        </Avatar>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography sx={{ fontWeight: 600, fontSize: 15 }}>
                                                {user.firstName} {user.lastName}
                                            </Typography>
                                            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                                                {t('settings.blocked_on')} {formatDate(user.blockedAt)}
                                            </Typography>
                                        </Box>
                                        <Button
                                            size="small"
                                            onClick={() => handleUnblockUser(user._id)}
                                            sx={{
                                                bgcolor: 'action.hover',
                                                color: 'text.primary',
                                                textTransform: 'none',
                                                fontWeight: 600,
                                                px: 2,
                                                '&:hover': { bgcolor: 'action.selected' },
                                            }}
                                        >
                                            {t('settings.unblock')}
                                        </Button>
                                    </Box>
                                    {index < blockedUsers.length - 1 && <Divider sx={{ mx: 2 }} />}
                                </Box>
                            ))}
                        </Box>
                    )}
                </Box>

                {/* Restricted Users Section */}
                <Box sx={{
                    bgcolor: 'background.paper',
                    borderRadius: '8px',
                    mb: 2,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                    border: 1,
                    borderColor: 'divider',
                }}>
                    <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                        <Typography sx={{ fontSize: 17, fontWeight: 600, color: 'text.primary' }}>
                            {t('settings.restrict')}
                        </Typography>
                    </Box>
                    <Box
                        onClick={() => setExpandedRestricted(!expandedRestricted)}
                        sx={{
                            p: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' },
                            transition: 'background 0.15s',
                        }}
                    >
                        <Box sx={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            bgcolor: alpha(theme.palette.warning.main, 0.1),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <PersonOffIcon sx={{ color: 'warning.main', fontSize: 22 }} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>
                                {t('settings.restricted_accounts')}
                            </Typography>
                            <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.25 }}>
                                {restrictedUsers.length === 0 ? t('settings.no_restricted') : `${restrictedUsers.length} ${t('settings.accounts')}`}
                            </Typography>
                        </Box>
                        <ChevronRightIcon sx={{
                            color: 'text.secondary',
                            fontSize: 24,
                            transform: expandedRestricted ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s',
                        }} />
                    </Box>

                    {expandedRestricted && restrictedUsers.length > 0 && (
                        <Box sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
                            {restrictedUsers.map((user, index) => (
                                <Box key={user._id}>
                                    <Box sx={{
                                        px: 2,
                                        py: 1.5,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        '&:hover': { bgcolor: 'action.hover' },
                                    }}>
                                        <Avatar src={user.avatar} sx={{ width: 48, height: 48 }}>
                                            {user.firstName?.[0]}
                                        </Avatar>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography sx={{ fontWeight: 600, fontSize: 15 }}>
                                                {user.firstName} {user.lastName}
                                            </Typography>
                                            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                                                {t('settings.restricted_on')} {formatDate(user.restrictedAt)}
                                            </Typography>
                                        </Box>
                                        <Button
                                            size="small"
                                            onClick={() => handleUnrestrictUser(user._id)}
                                            sx={{
                                                bgcolor: 'action.hover',
                                                color: 'text.primary',
                                                textTransform: 'none',
                                                fontWeight: 600,
                                                px: 2,
                                                '&:hover': { bgcolor: 'action.selected' },
                                            }}
                                        >
                                            {t('settings.unrestrict')}
                                        </Button>
                                    </Box>
                                    {index < restrictedUsers.length - 1 && <Divider sx={{ mx: 2 }} />}
                                </Box>
                            ))}
                        </Box>
                    )}
                </Box>

                {/* Self Block Section */}
                <Box sx={{
                    bgcolor: 'background.paper',
                    borderRadius: '8px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                    border: 1,
                    borderColor: 'divider',
                }}>
                    <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                        <Typography sx={{ fontSize: 17, fontWeight: 600, color: 'text.primary' }}>
                            {t('settings.account_security')}
                        </Typography>
                    </Box>
                    <Box sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                            <Box sx={{
                                width: 44,
                                height: 44,
                                borderRadius: '50%',
                                bgcolor: alpha(theme.palette.error.main, 0.1),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                <LockIcon sx={{ color: 'error.main', fontSize: 22 }} />
                            </Box>
                            <Box sx={{ flex: 1 }}>
                                <Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>
                                    {t('settings.lock_account')}
                                </Typography>
                                <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5, lineHeight: 1.5 }}>
                                    {t('settings.lock_account_desc')}
                                </Typography>

                                {settings?.isSelfBlocked ? (
                                    <Box sx={{
                                        p: 2,
                                        bgcolor: alpha(theme.palette.error.main, 0.05),
                                        borderRadius: '8px',
                                        border: 1,
                                        borderColor: alpha(theme.palette.error.main, 0.2),
                                        mt: 2,
                                    }}>
                                        <Typography sx={{ color: 'error.main', fontWeight: 500, fontSize: 14 }}>
                                            {t('settings.account_locked_until')}{' '}
                                            {settings.selfBlockExpireAt
                                                ? formatDateTime(settings.selfBlockExpireAt)
                                                : 'N/A'}
                                        </Typography>
                                    </Box>
                                ) : (
                                    <Button
                                        variant="contained"
                                        startIcon={<LockIcon />}
                                        onClick={() => setShowBlockConfirm(true)}
                                        sx={{
                                            mt: 2,
                                            bgcolor: 'error.main',
                                            color: 'white',
                                            textTransform: 'none',
                                            fontWeight: 600,
                                            px: 3,
                                            py: 1,
                                            borderRadius: '6px',
                                            '&:hover': { bgcolor: 'error.dark' },
                                        }}
                                    >
                                        {t('settings.lock_30_days')}
                                    </Button>
                                )}
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </Box>

            {/* Confirm Dialog */}
            <Dialog
                open={showBlockConfirm}
                onClose={() => setShowBlockConfirm(false)}
                PaperProps={{
                    sx: { borderRadius: '12px', maxWidth: 420, width: '100%', bgcolor: 'background.paper' }
                }}
            >
                <DialogTitle sx={{ fontWeight: 600, fontSize: 18, pb: 1, color: 'text.primary' }}>
                    {t('settings.confirm_lock')}
                </DialogTitle>
                <DialogContent>
                    <Typography sx={{ color: 'text.secondary', fontSize: 14, lineHeight: 1.5 }}>
                        {t('settings.confirm_lock_desc')}
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 1.5, gap: 1 }}>
                    <Button
                        onClick={() => setShowBlockConfirm(false)}
                        sx={{
                            bgcolor: 'action.hover',
                            color: 'text.primary',
                            textTransform: 'none',
                            fontWeight: 600,
                            px: 3,
                            borderRadius: '6px',
                            '&:hover': { bgcolor: 'action.selected' },
                        }}
                    >
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSelfBlock}
                        disabled={blockingAccount}
                        sx={{
                            bgcolor: 'error.main',
                            textTransform: 'none',
                            fontWeight: 600,
                            px: 3,
                            borderRadius: '6px',
                            '&:hover': { bgcolor: 'error.dark' },
                        }}
                    >
                        {blockingAccount ? <CircularProgress size={24} color="inherit" /> : t('settings.confirm_lock_button')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}