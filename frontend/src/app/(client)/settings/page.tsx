'use client';

import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Switch,
    Button,
    Card,
    CardContent,
    Avatar,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    ListItemSecondaryAction,
} from '@mui/material';
import {
    Visibility as VisibilityIcon,
    Block as BlockIcon,
    Lock as LockIcon,
    PersonOff as PersonOffIcon,
    ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { accountService, UserSettings } from '@/services/account.service';
import { relationshipService, BlockedUser, RestrictedUser } from '@/services/relationship.service';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/contexts/SocketContext';

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
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
    const [restrictedUsers, setRestrictedUsers] = useState<RestrictedUser[]>([]);
    const [showBlockConfirm, setShowBlockConfirm] = useState(false);
    const [savingActivity, setSavingActivity] = useState(false);
    const [blockingAccount, setBlockingAccount] = useState(false);

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

            toast.success(settings.showActivityStatus ? 'Đã tắt trạng thái hoạt động' : 'Đã bật trạng thái hoạt động');
        } catch (error) {
            console.error('Failed to toggle activity status:', error);
            toast.error('Không thể thay đổi cài đặt');
        } finally {
            setSavingActivity(false);
        }
    };

    const handleSelfBlock = async () => {
        try {
            setBlockingAccount(true);
            await accountService.selfBlockAccount();
            toast.success('Tài khoản đã được tạm khóa trong 30 ngày');
            setShowBlockConfirm(false);
            // Redirect to login
            router.push('/auth/login');
        } catch (error) {
            console.error('Failed to block account:', error);
            toast.error('Không thể khóa tài khoản');
        } finally {
            setBlockingAccount(false);
        }
    };

    const handleUnblockUser = async (userId: string) => {
        try {
            await relationshipService.unblockUser(userId);
            setBlockedUsers(blockedUsers.filter(u => u._id !== userId));
            toast.success('Đã bỏ chặn người dùng');
        } catch (error) {
            console.error('Failed to unblock user:', error);
            toast.error('Không thể bỏ chặn người dùng');
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <IconButton onClick={() => router.back()} sx={{ mr: 1 }}>
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    Cài đặt
                </Typography>
            </Box>

            {/* Activity Status Section */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                        <VisibilityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Trạng thái hoạt động
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                            <Typography>Hiển thị khi bạn đang hoạt động</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Người khác có thể thấy khi bạn đang online
                            </Typography>
                        </Box>
                        <Switch
                            checked={settings?.showActivityStatus ?? true}
                            onChange={handleToggleActivityStatus}
                            disabled={savingActivity}
                        />
                    </Box>
                </CardContent>
            </Card>

            {/* Blocked Users Section */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                        <BlockIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Người dùng đã chặn ({blockedUsers.length})
                    </Typography>
                    {blockedUsers.length === 0 ? (
                        <Typography color="text.secondary">Bạn chưa chặn ai</Typography>
                    ) : (
                        <List>
                            {blockedUsers.map((user) => (
                                <ListItem key={user._id}>
                                    <ListItemAvatar>
                                        <Avatar src={user.avatar}>
                                            {user.firstName?.[0]}
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={`${user.firstName} ${user.lastName}`}
                                        secondary={`Đã chặn ${formatDate(user.blockedAt)}`}
                                    />
                                    <ListItemSecondaryAction>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={() => handleUnblockUser(user._id)}
                                        >
                                            Bỏ chặn
                                        </Button>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            ))}
                        </List>
                    )}
                </CardContent>
            </Card>

            {/* Restricted Users Section */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                        <PersonOffIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Tài khoản hạn chế ({restrictedUsers.length})
                    </Typography>
                    {restrictedUsers.length === 0 ? (
                        <Typography color="text.secondary">Không có tài khoản nào bị hạn chế</Typography>
                    ) : (
                        <List>
                            {restrictedUsers.map((user) => (
                                <ListItem
                                    key={user._id}
                                    secondaryAction={
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={async () => {
                                                try {
                                                    await relationshipService.unrestrictUser(user._id);
                                                    setRestrictedUsers(prev => prev.filter(u => u._id !== user._id));
                                                } catch (error) {
                                                    console.error('Failed to unrestrict user:', error);
                                                }
                                            }}
                                        >
                                            Bỏ hạn chế
                                        </Button>
                                    }
                                >
                                    <ListItemAvatar>
                                        <Avatar src={user.avatar}>
                                            {user.firstName?.[0]}
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={`${user.firstName} ${user.lastName}`}
                                        secondary={`Bị hạn chế ngày ${new Date(user.restrictedAt).toLocaleDateString('vi-VN')}`}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </CardContent>
            </Card>

            {/* Self Block Section */}
            <Card sx={{ mb: 3, bgcolor: '#fff5f5' }}>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'error.main' }}>
                        <LockIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Tạm khóa tài khoản
                    </Typography>
                    <Typography sx={{ mb: 2 }}>
                        Tạm khóa tài khoản của bạn trong 30 ngày. Trong thời gian này, bạn sẽ không thể đăng nhập
                        và người khác sẽ không thể xem trang cá nhân của bạn.
                    </Typography>
                    {settings?.isSelfBlocked ? (
                        <Box sx={{ p: 2, bgcolor: 'error.light', borderRadius: 1, color: 'white' }}>
                            <Typography>
                                Tài khoản đã bị khóa đến{' '}
                                {settings.selfBlockExpireAt
                                    ? formatDateTime(settings.selfBlockExpireAt)
                                    : 'N/A'}
                            </Typography>
                        </Box>
                    ) : (
                        <Button
                            variant="contained"
                            color="error"
                            startIcon={<LockIcon />}
                            onClick={() => setShowBlockConfirm(true)}
                        >
                            Tạm khóa tài khoản 30 ngày
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Confirm Dialog */}
            <Dialog open={showBlockConfirm} onClose={() => setShowBlockConfirm(false)}>
                <DialogTitle>Xác nhận tạm khóa tài khoản</DialogTitle>
                <DialogContent>
                    <Typography>
                        Bạn có chắc chắn muốn tạm khóa tài khoản trong 30 ngày không?
                        Bạn sẽ không thể đăng nhập trong thời gian này.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowBlockConfirm(false)}>
                        Hủy
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleSelfBlock}
                        disabled={blockingAccount}
                    >
                        {blockingAccount ? <CircularProgress size={24} /> : 'Xác nhận'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
