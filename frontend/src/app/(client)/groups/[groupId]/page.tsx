'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Avatar,
    AvatarGroup,
    Button,
    IconButton,
    Tab,
    Tabs,
    TextField,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
    Badge,
} from '@mui/material';
import {
    Lock as LockIcon,
    Public as PublicIcon,
    Visibility as VisibilityIcon,
    LocationOn as LocationIcon,
    MoreHoriz as MoreHorizIcon,
    Add as AddIcon,
    Share as ShareIcon,
    ExitToApp as ExitToAppIcon,
    Poll as PollIcon,
    EmojiEmotions as EmojiIcon,
    VisibilityOff as VisibilityOffIcon,
    Info as InfoIcon,
    Search as SearchIcon,
    CameraAlt as CameraAltIcon,
    Groups as GroupsIcon,
} from '@mui/icons-material';
import Header from '@/components/home/Header';
import { groupService } from '@/services/group.service';
import { Group, GroupPrivacy, GroupCreator, GroupRole } from '@/types/group';
import { useAuthStore } from '@/stores/useAuthStore';

export default function GroupDetailPage() {
    const params = useParams();
    const router = useRouter();
    const groupId = params.groupId as string;
    const { user, accessToken } = useAuthStore();

    const [group, setGroup] = useState<Group | null>(null);
    const [topMembers, setTopMembers] = useState<GroupCreator[]>([]);
    const [tabValue, setTabValue] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [openLeaveDialog, setOpenLeaveDialog] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [isUploadingCover, setIsUploadingCover] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    const coverInputRef = useRef<HTMLInputElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const loadGroupData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [groupData, membersData] = await Promise.all([
                groupService.getGroupById(groupId),
                groupService.getTopMembers(groupId, 12),
            ]);
            setGroup(groupData);
            setTopMembers(membersData);
        } catch (error) {
            console.error('Failed to load group:', error);
            router.push('/groups');
        } finally {
            setIsLoading(false);
        }
    }, [groupId, router]);

    useEffect(() => {
        if (groupId) {
            loadGroupData();
        }
    }, [groupId, loadGroupData]);

    const handleJoinGroup = async () => {
        setIsJoining(true);
        try {
            await groupService.joinGroup(groupId);
            loadGroupData();
        } catch (error) {
            console.error('Failed to join group:', error);
        } finally {
            setIsJoining(false);
        }
    };

    const handleLeaveGroup = async () => {
        setIsLeaving(true);
        try {
            await groupService.leaveGroup(groupId);
            setOpenLeaveDialog(false);
            router.push('/groups');
        } catch (error) {
            console.error('Failed to leave group:', error);
            alert('Không thể rời nhóm. Vui lòng thử lại.');
        } finally {
            setIsLeaving(false);
        }
    };

    const handleCancelRequest = async () => {
        try {
            await groupService.cancelJoinRequest(groupId);
            loadGroupData();
        } catch (error) {
            console.error('Failed to cancel request:', error);
        }
    };

    const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingCover(true);
        try {
            // Create FormData and upload to cloudinary via backend
            const formData = new FormData();
            formData.append('files', file);

            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/cloudinary/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.results && data.results.length > 0) {
                    // Update group cover image
                    await groupService.updateGroup(groupId, { coverImage: data.results[0].url });
                    loadGroupData();
                }
            }
        } catch (error) {
            console.error('Failed to upload cover:', error);
        } finally {
            setIsUploadingCover(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingAvatar(true);
        try {
            const formData = new FormData();
            formData.append('files', file);

            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/cloudinary/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.results && data.results.length > 0) {
                    // Update group avatar
                    await groupService.updateGroup(groupId, { avatar: data.results[0].url });
                    loadGroupData();
                }
            }
        } catch (error) {
            console.error('Failed to upload avatar:', error);
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const isAdmin = group?.myRole === GroupRole.ADMIN;
    const isModerator = group?.myRole === GroupRole.MODERATOR;
    const canEdit = isAdmin || isModerator;

    if (isLoading) {
        return (
            <Box sx={{ bgcolor: '#f0f2f5', minHeight: '100vh' }}>
                <Header />
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                    <CircularProgress />
                </Box>
            </Box>
        );
    }

    if (!group) {
        return (
            <Box sx={{ bgcolor: '#f0f2f5', minHeight: '100vh' }}>
                <Header />
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                    <Typography>Không tìm thấy nhóm</Typography>
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ bgcolor: '#f0f2f5', minHeight: '100vh' }}>
            <Header />

            {/* Cover Image Section */}
            <Box sx={{ maxWidth: 1100, mx: 'auto', pt: 7 }}>
                <Box
                    sx={{
                        height: 350,
                        background: group.coverImage
                            ? `url(${group.coverImage}) center/cover`
                            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '0 0 12px 12px',
                        position: 'relative',
                    }}
                >
                    {/* Upload Cover Button (Admin/Moderator only) */}
                    {canEdit && (
                        <>
                            <input
                                ref={coverInputRef}
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={handleCoverUpload}
                            />
                            <Button
                                variant="contained"
                                startIcon={isUploadingCover ? <CircularProgress size={16} color="inherit" /> : <CameraAltIcon />}
                                onClick={() => coverInputRef.current?.click()}
                                disabled={isUploadingCover}
                                sx={{
                                    position: 'absolute',
                                    bottom: 16,
                                    right: 16,
                                    bgcolor: 'white',
                                    color: '#050505',
                                    textTransform: 'none',
                                    '&:hover': { bgcolor: '#f0f2f5' },
                                }}
                            >
                                Chỉnh sửa ảnh bìa
                            </Button>
                        </>
                    )}

                    {/* Pink banner label */}
                    <Box
                        sx={{
                            position: 'absolute',
                            bottom: -20,
                            left: 20,
                            bgcolor: '#e91e63',
                            color: 'white',
                            px: 2,
                            py: 0.5,
                            borderRadius: 1,
                            fontSize: 14,
                        }}
                    >
                        {group.privacy === GroupPrivacy.PRIVATE
                            ? `Nhóm của ${group.name}`
                            : `Nhóm công khai`
                        }
                    </Box>
                </Box>

                {/* Group Info Section */}
                <Card sx={{ mt: -3, mx: 2, borderRadius: 2 }}>
                    <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                            {/* Group Avatar */}
                            <Box sx={{ position: 'relative' }}>
                                <Badge
                                    overlap="circular"
                                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                    badgeContent={
                                        canEdit && (
                                            <>
                                                <input
                                                    ref={avatarInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    hidden
                                                    onChange={handleAvatarUpload}
                                                />
                                                <IconButton
                                                    size="small"
                                                    onClick={() => avatarInputRef.current?.click()}
                                                    disabled={isUploadingAvatar}
                                                    sx={{
                                                        bgcolor: 'white',
                                                        border: '2px solid #f0f2f5',
                                                        '&:hover': { bgcolor: '#e4e6eb' },
                                                    }}
                                                >
                                                    {isUploadingAvatar ? (
                                                        <CircularProgress size={16} />
                                                    ) : (
                                                        <CameraAltIcon fontSize="small" />
                                                    )}
                                                </IconButton>
                                            </>
                                        )
                                    }
                                >
                                    <Avatar
                                        src={group.avatar || undefined}
                                        sx={{ width: 120, height: 120, border: '4px solid white', boxShadow: 2 }}
                                    >
                                        <GroupsIcon sx={{ fontSize: 60 }} />
                                    </Avatar>
                                </Badge>
                            </Box>

                            {/* Group Info */}
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
                                    {group.name}
                                </Typography>

                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                    {group.privacy === GroupPrivacy.PRIVATE ? (
                                        <LockIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                    ) : (
                                        <PublicIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                    )}
                                    <Typography variant="body2" color="text.secondary">
                                        {group.privacy === GroupPrivacy.PRIVATE ? 'Nhóm Riêng tư' : 'Nhóm Công khai'}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        • {group.memberCount.toLocaleString()} thành viên
                                    </Typography>
                                </Box>

                                {/* Member Avatars */}
                                <AvatarGroup max={12} sx={{ justifyContent: 'flex-start', '& .MuiAvatar-root': { width: 32, height: 32 } }}>
                                    {topMembers.map((member) => (
                                        <Avatar key={member._id} src={member.avatar} alt={member.firstName}>
                                            {member.firstName?.[0]}
                                        </Avatar>
                                    ))}
                                </AvatarGroup>
                            </Box>

                            {/* Action Buttons */}
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                {group.isMember ? (
                                    <>
                                        <Button
                                            variant="contained"
                                            startIcon={<AddIcon />}
                                            sx={{ textTransform: 'none' }}
                                        >
                                            + Mời
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            startIcon={<ShareIcon />}
                                            sx={{ textTransform: 'none' }}
                                        >
                                            Chia sẻ
                                        </Button>
                                        <Button
                                            variant="contained"
                                            sx={{
                                                bgcolor: '#e4e6eb',
                                                color: '#050505',
                                                textTransform: 'none',
                                                '&:hover': { bgcolor: '#d8dadf' },
                                            }}
                                        >
                                            👥 Đã tham gia ▼
                                        </Button>
                                        <IconButton
                                            sx={{ bgcolor: '#e4e6eb' }}
                                            onClick={(e) => setAnchorEl(e.currentTarget)}
                                        >
                                            <MoreHorizIcon />
                                        </IconButton>
                                    </>
                                ) : group.isPending ? (
                                    <Button variant="outlined" onClick={handleCancelRequest} sx={{ textTransform: 'none' }}>
                                        Hủy yêu cầu
                                    </Button>
                                ) : (
                                    <Button
                                        variant="contained"
                                        onClick={handleJoinGroup}
                                        disabled={isJoining}
                                        sx={{ textTransform: 'none' }}
                                    >
                                        {isJoining ? <CircularProgress size={20} /> : '+ Tham gia nhóm'}
                                    </Button>
                                )}

                                {/* Dropdown Menu */}
                                <Menu
                                    anchorEl={anchorEl}
                                    open={Boolean(anchorEl)}
                                    onClose={() => setAnchorEl(null)}
                                >
                                    <MenuItem onClick={() => { setAnchorEl(null); setOpenLeaveDialog(true); }}>
                                        <ListItemIcon>
                                            <ExitToAppIcon />
                                        </ListItemIcon>
                                        <ListItemText primary="Rời nhóm" />
                                    </MenuItem>
                                </Menu>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>

                {/* Tabs */}
                <Card sx={{ mx: 2, mt: 2, borderRadius: 2 }}>
                    <Tabs
                        value={tabValue}
                        onChange={(_, newValue) => setTabValue(newValue)}
                        sx={{
                            px: 2,
                            '& .MuiTab-root': { textTransform: 'none', fontSize: 15, fontWeight: 600 },
                        }}
                    >
                        <Tab label="Thảo luận" />
                        <Tab label="Đáng chú ý" />
                        <Tab label="Thành viên" />
                        <Tab label="File phương tiện" />
                        <Tab label="File" />
                    </Tabs>
                </Card>

                {/* Main Content */}
                <Box sx={{ display: 'flex', gap: 2, p: 2 }}>
                    {/* Left Column - Posts */}
                    <Box sx={{ flex: 1 }}>
                        {/* Create Post Card */}
                        {group.isMember && (
                            <Card sx={{ mb: 2, borderRadius: 2 }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                        <Avatar src={user?.avatar}>
                                            {user?.fullName?.[0]}
                                        </Avatar>
                                        <TextField
                                            fullWidth
                                            placeholder="Bạn viết gì đi..."
                                            variant="outlined"
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    bgcolor: '#f0f2f5',
                                                    borderRadius: 20,
                                                    '& fieldset': { border: 'none' },
                                                },
                                            }}
                                        />
                                    </Box>
                                    <Divider sx={{ my: 2 }} />
                                    <Box sx={{ display: 'flex', justifyContent: 'space-around' }}>
                                        <Button
                                            startIcon={<VisibilityOffIcon />}
                                            sx={{ color: 'text.secondary', textTransform: 'none' }}
                                        >
                                            Bài viết ẩn danh
                                        </Button>
                                        <Button
                                            startIcon={<PollIcon sx={{ color: '#f7b928' }} />}
                                            sx={{ color: 'text.secondary', textTransform: 'none' }}
                                        >
                                            Thăm dò ý kiến
                                        </Button>
                                        <Button
                                            startIcon={<EmojiIcon sx={{ color: '#f7b928' }} />}
                                            sx={{ color: 'text.secondary', textTransform: 'none' }}
                                        >
                                            Cảm xúc/hoạt động
                                        </Button>
                                    </Box>
                                </CardContent>
                            </Card>
                        )}

                        {/* Featured Notice */}
                        <Card sx={{ mb: 2, borderRadius: 2 }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Box>
                                        <Typography variant="subtitle1" fontWeight={600}>
                                            Đáng chú ý
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#1877f2' }}>
                                            5 mục mới •
                                        </Typography>
                                    </Box>
                                    <IconButton>
                                        <InfoIcon sx={{ color: 'text.secondary' }} />
                                    </IconButton>
                                </Box>
                            </CardContent>
                        </Card>

                        {/* Activity Section */}
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" sx={{ color: '#e91e63', fontWeight: 600 }}>
                                Hoạt động mới đây ▼
                            </Typography>
                        </Box>

                        {/* Sample Post */}
                        <Card sx={{ mb: 2, borderRadius: 2 }}>
                            <CardContent>
                                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
                                    Chưa có bài viết nào trong nhóm này
                                </Typography>
                            </CardContent>
                        </Card>
                    </Box>

                    {/* Right Column - Group Info */}
                    <Box sx={{ width: 360, flexShrink: 0 }}>
                        {/* About Card */}
                        <Card sx={{ mb: 2, borderRadius: 2 }}>
                            <CardContent>
                                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                                    Giới thiệu
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    {group.description || 'Chưa có mô tả'}
                                </Typography>

                                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                                    {group.privacy === GroupPrivacy.PRIVATE ? (
                                        <LockIcon sx={{ color: 'text.secondary', mt: 0.5 }} />
                                    ) : (
                                        <PublicIcon sx={{ color: 'text.secondary', mt: 0.5 }} />
                                    )}
                                    <Box>
                                        <Typography variant="body1" fontWeight={600}>
                                            {group.privacy === GroupPrivacy.PRIVATE ? 'Riêng tư' : 'Công khai'}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {group.privacy === GroupPrivacy.PRIVATE
                                                ? 'Chỉ thành viên mới nhìn thấy mọi người trong nhóm và những gì họ đăng.'
                                                : 'Bất kỳ ai cũng có thể nhìn thấy mọi người trong nhóm và những gì họ đăng.'
                                            }
                                        </Typography>
                                    </Box>
                                </Box>

                                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                                    <VisibilityIcon sx={{ color: 'text.secondary', mt: 0.5 }} />
                                    <Box>
                                        <Typography variant="body1" fontWeight={600}>
                                            Hiển thị
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Ai cũng có thể tìm thấy nhóm này.
                                        </Typography>
                                    </Box>
                                </Box>

                                {group.location && (
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                                        <LocationIcon sx={{ color: 'text.secondary', mt: 0.5 }} />
                                        <Box>
                                            <Typography variant="body1" fontWeight={600}>
                                                {group.location}
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}

                                <Button
                                    fullWidth
                                    variant="contained"
                                    sx={{
                                        bgcolor: '#e4e6eb',
                                        color: '#050505',
                                        textTransform: 'none',
                                        mt: 2,
                                        '&:hover': { bgcolor: '#d8dadf' },
                                    }}
                                >
                                    Tìm hiểu thêm về nhóm này
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Recent Media Card */}
                        <Card sx={{ borderRadius: 2 }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="h6" fontWeight={600}>
                                        File phương tiện mới đây
                                    </Typography>
                                    <IconButton sx={{ bgcolor: '#e4e6eb' }} size="small">
                                        <SearchIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                                    Chưa có file phương tiện nào
                                </Typography>
                            </CardContent>
                        </Card>
                    </Box>
                </Box>
            </Box>

            {/* Leave Group Dialog */}
            <Dialog
                open={openLeaveDialog}
                onClose={() => setOpenLeaveDialog(false)}
            >
                <DialogTitle>Rời nhóm?</DialogTitle>
                <DialogContent>
                    <Typography>
                        Bạn có chắc chắn muốn rời khỏi nhóm &quot;{group.name}&quot;?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenLeaveDialog(false)}>
                        Hủy
                    </Button>
                    <Button
                        onClick={handleLeaveGroup}
                        disabled={isLeaving}
                        variant="contained"
                        color="error"
                    >
                        {isLeaving ? <CircularProgress size={20} /> : 'Rời nhóm'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
