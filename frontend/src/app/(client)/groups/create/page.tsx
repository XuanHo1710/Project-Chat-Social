'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    TextField,
    FormControl,
    Select,
    MenuItem,
    CircularProgress,
    Avatar,
    List,
    ListItemButton,
    ListItemAvatar,
    ListItemText,
    Chip,
    IconButton,
    Divider,
    Card,
    InputAdornment,
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    Lock as LockIcon,
    Public as PublicIcon,
    Groups as GroupsIcon,
    Close as CloseIcon,
    Image as ImageIcon,
    Tag as TagIcon,
    EmojiEmotions as EmojiIcon,
    Computer as ComputerIcon,
    PhoneIphone as PhoneIcon,
} from '@mui/icons-material';
import Header from '@/components/home/Header';
import { groupService } from '@/services/group.service';
import { GroupPrivacy, CreateGroupData } from '@/types/group';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { relationshipService } from '@/services/relationship.service';
import { FriendType } from '@/types/account';

export default function CreateGroupPage() {
    const router = useRouter();
    const { user } = useAuthStore();

    const [createForm, setCreateForm] = useState<CreateGroupData>({
        name: '',
        description: '',
        privacy: GroupPrivacy.PRIVATE,
    });
    const [isCreating, setIsCreating] = useState(false);
    const [friends, setFriends] = useState<FriendType[]>([]);
    const [selectedFriends, setSelectedFriends] = useState<FriendType[]>([]);
    const [friendSearch, setFriendSearch] = useState('');
    const [isLoadingFriends, setIsLoadingFriends] = useState(true);
    const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

    // Load friends on mount
    useEffect(() => {
        const loadFriends = async () => {
            try {
                const response = await relationshipService.getFriends();
                setFriends(response.data || []);
            } catch (error) {
                console.error('Failed to load friends:', error);
            } finally {
                setIsLoadingFriends(false);
            }
        };
        loadFriends();
    }, []);

    const handleCreateGroup = async () => {
        if (!createForm.name.trim()) return;
        setIsCreating(true);
        try {
            const newGroup = await groupService.createGroup(createForm);
            // TODO: Invite selected friends to the group
            router.push(`/groups/${newGroup._id}`);
        } catch (error) {
            console.error('Failed to create group:', error);
        } finally {
            setIsCreating(false);
        }
    };

    const handleAddFriend = (friend: FriendType) => {
        if (!selectedFriends.find(f => f._id === friend._id)) {
            setSelectedFriends([...selectedFriends, friend]);
        }
        setFriendSearch('');
    };

    const handleRemoveFriend = (friendId: string) => {
        setSelectedFriends(selectedFriends.filter(f => f._id !== friendId));
    };

    // Filter friends based on search
    const filteredFriends = friends.filter(friend => {
        const fullName = `${friend.firstName} ${friend.lastName}`.toLowerCase();
        return fullName.includes(friendSearch.toLowerCase()) &&
            !selectedFriends.find(f => f._id === friend._id);
    });

    const privacyText = createForm.privacy === GroupPrivacy.PRIVATE
        ? 'Quyền riêng tư của nhóm'
        : 'Quyền riêng tư của nhóm';

    return (
        <Box sx={{ bgcolor: '#f0f2f5', minHeight: '100vh' }}>
            <Header />

            <Box sx={{ display: 'flex', pt: 7 }}>
                {/* Left Sidebar - Form */}
                <Box
                    sx={{
                        width: 360,
                        height: 'calc(100vh - 56px)',
                        bgcolor: 'white',
                        borderRight: '1px solid #dddfe2',
                        position: 'fixed',
                        left: 0,
                        top: 56,
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {/* Sidebar Header */}
                    <Box sx={{ p: 2, borderBottom: '1px solid #dddfe2' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <IconButton
                                size="small"
                                onClick={() => router.push('/groups')}
                                sx={{
                                    bgcolor: '#e4e6eb',
                                    '&:hover': { bgcolor: '#d8dadf' }
                                }}
                            >
                                <ArrowBackIcon fontSize="small" />
                            </IconButton>
                            <Box>
                                <Typography
                                    variant="caption"
                                    sx={{ color: '#65676b', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                                    onClick={() => router.push('/groups')}
                                >
                                    Nhóm › Tạo nhóm
                                </Typography>
                            </Box>
                        </Box>
                        <Typography variant="h5" fontWeight={700}>
                            Tạo nhóm
                        </Typography>
                    </Box>

                    {/* Admin Info */}
                    <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar src={user?.avatar} sx={{ width: 36, height: 36 }}>
                            {user?.fullName?.[0]}
                        </Avatar>
                        <Box>
                            <Typography fontWeight={500} fontSize={15}>
                                {user?.fullName || user?.username}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Quản trị viên
                            </Typography>
                        </Box>
                    </Box>

                    {/* Form Content */}
                    <Box sx={{ p: 2, flex: 1 }}>
                        {/* Group Name */}
                        <TextField
                            fullWidth
                            placeholder="Tên nhóm"
                            value={createForm.name}
                            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                            sx={{
                                mb: 2,
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: 1.5,
                                    '& fieldset': { borderColor: '#dddfe2' },
                                },
                            }}
                        />

                        {/* Privacy Select */}
                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <Select
                                value={createForm.privacy}
                                onChange={(e) => setCreateForm({ ...createForm, privacy: e.target.value as GroupPrivacy })}
                                displayEmpty
                                sx={{
                                    borderRadius: 1.5,
                                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#dddfe2' },
                                }}
                                renderValue={(value) => (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {value === GroupPrivacy.PRIVATE ? (
                                            <LockIcon sx={{ fontSize: 20, color: '#65676b' }} />
                                        ) : (
                                            <PublicIcon sx={{ fontSize: 20, color: '#65676b' }} />
                                        )}
                                        <Typography>
                                            {value === GroupPrivacy.PRIVATE ? 'Riêng tư' : 'Công khai'}
                                        </Typography>
                                    </Box>
                                )}
                            >
                                <MenuItem value={GroupPrivacy.PUBLIC}>
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                        <PublicIcon sx={{ mt: 0.5 }} />
                                        <Box>
                                            <Typography fontWeight={500}>Công khai</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Ai cũng có thể xem bài đăng và tham gia
                                            </Typography>
                                        </Box>
                                    </Box>
                                </MenuItem>
                                <MenuItem value={GroupPrivacy.PRIVATE}>
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                        <LockIcon sx={{ mt: 0.5 }} />
                                        <Box>
                                            <Typography fontWeight={500}>Riêng tư</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Chỉ thành viên mới có thể xem bài đăng
                                            </Typography>
                                        </Box>
                                    </Box>
                                </MenuItem>
                            </Select>
                        </FormControl>

                        {/* Invite Friends */}
                        <Box sx={{ mb: 2 }}>
                            <Typography
                                variant="caption"
                                sx={{
                                    color: '#1877f2',
                                    fontWeight: 500,
                                    display: 'block',
                                    mb: 0.5
                                }}
                            >
                                Mời bạn bè
                            </Typography>
                            <TextField
                                fullWidth
                                placeholder="Nhập tên hoặc địa chỉ email"
                                value={friendSearch}
                                onChange={(e) => setFriendSearch(e.target.value)}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 1.5,
                                        bgcolor: '#f0f2f5',
                                        '& fieldset': { borderColor: '#1877f2', borderWidth: 2 },
                                    },
                                }}
                            />

                            {/* Selected Friends Chips */}
                            {selectedFriends.length > 0 && (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                                    {selectedFriends.map((friend) => (
                                        <Chip
                                            key={friend._id}
                                            avatar={<Avatar src={friend.avatar} />}
                                            label={`${friend.firstName} ${friend.lastName}`}
                                            onDelete={() => handleRemoveFriend(friend._id)}
                                            size="small"
                                            sx={{ bgcolor: '#e7f3ff', color: '#1877f2' }}
                                        />
                                    ))}
                                </Box>
                            )}

                            {/* Friends Suggestions */}
                            {friendSearch && filteredFriends.length > 0 && (
                                <Box sx={{
                                    mt: 1,
                                    bgcolor: 'white',
                                    borderRadius: 2,
                                    boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                                    maxHeight: 200,
                                    overflow: 'auto'
                                }}>
                                    <List dense sx={{ p: 0 }}>
                                        {filteredFriends.slice(0, 5).map((friend) => (
                                            <ListItemButton
                                                key={friend._id}
                                                onClick={() => handleAddFriend(friend)}
                                            >
                                                <ListItemAvatar>
                                                    <Avatar src={friend.avatar} sx={{ width: 32, height: 32 }} />
                                                </ListItemAvatar>
                                                <ListItemText
                                                    primary={`${friend.firstName} ${friend.lastName}`}
                                                    primaryTypographyProps={{ fontSize: 14 }}
                                                />
                                            </ListItemButton>
                                        ))}
                                    </List>
                                </Box>
                            )}

                            {/* Friend Suggestions Label */}
                            {!friendSearch && friends.length > 0 && (
                                <Box sx={{ mt: 1 }}>
                                    <Typography variant="caption" color="text.secondary">
                                        Gợi ý:{' '}
                                        {friends.slice(0, 3).map((friend, index) => (
                                            <Typography
                                                key={friend._id}
                                                component="span"
                                                variant="caption"
                                                sx={{
                                                    color: '#1877f2',
                                                    cursor: 'pointer',
                                                    '&:hover': { textDecoration: 'underline' }
                                                }}
                                                onClick={() => handleAddFriend(friend)}
                                            >
                                                {friend.firstName} {friend.lastName}{index < 2 ? ', ' : ''}
                                            </Typography>
                                        ))}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    </Box>

                    {/* Create Button */}
                    <Box sx={{ p: 2, borderTop: '1px solid #dddfe2' }}>
                        <Button
                            fullWidth
                            variant="contained"
                            onClick={handleCreateGroup}
                            disabled={!createForm.name.trim() || isCreating}
                            sx={{
                                bgcolor: createForm.name.trim() ? '#1877f2' : '#e4e6eb',
                                color: createForm.name.trim() ? 'white' : '#bcc0c4',
                                textTransform: 'none',
                                fontWeight: 600,
                                py: 1,
                                borderRadius: 1.5,
                                boxShadow: 'none',
                                '&:hover': {
                                    bgcolor: createForm.name.trim() ? '#166fe5' : '#e4e6eb',
                                    boxShadow: 'none'
                                },
                                '&.Mui-disabled': {
                                    bgcolor: '#e4e6eb',
                                    color: '#bcc0c4',
                                }
                            }}
                        >
                            {isCreating ? <CircularProgress size={20} color="inherit" /> : 'Tạo'}
                        </Button>
                    </Box>
                </Box>

                {/* Right Content - Preview */}
                <Box sx={{ flex: 1, ml: '360px', p: 3 }}>
                    <Card sx={{ borderRadius: 2, overflow: 'hidden' }}>
                        {/* Preview Header */}
                        <Box sx={{
                            p: 2,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: '1px solid #dddfe2'
                        }}>
                            <Typography fontWeight={500} color="text.secondary">
                                Xem trước trên máy tính
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <IconButton
                                    size="small"
                                    onClick={() => setPreviewMode('desktop')}
                                    sx={{
                                        bgcolor: previewMode === 'desktop' ? '#e7f3ff' : 'transparent',
                                        color: previewMode === 'desktop' ? '#1877f2' : '#65676b'
                                    }}
                                >
                                    <ComputerIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    onClick={() => setPreviewMode('mobile')}
                                    sx={{
                                        bgcolor: previewMode === 'mobile' ? '#e7f3ff' : 'transparent',
                                        color: previewMode === 'mobile' ? '#1877f2' : '#65676b'
                                    }}
                                >
                                    <PhoneIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </Box>

                        {/* Preview Content */}
                        <Box sx={{ p: 2 }}>
                            {/* Cover Image Preview */}
                            <Box
                                sx={{
                                    height: 200,
                                    borderRadius: 2,
                                    background: 'linear-gradient(135deg, #e8e8e8 0%, #d1d1d1 100%)',
                                    mb: 2,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    position: 'relative',
                                    overflow: 'hidden',
                                }}
                            >
                                {/* Placeholder illustration */}
                                <Box sx={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                    justifyContent: 'center',
                                    bgcolor: '#e8e8e8',
                                    p: 2
                                }}>
                                    <GroupsIcon sx={{ fontSize: 80, color: '#bcc0c4' }} />
                                </Box>
                            </Box>

                            {/* Group Info */}
                            <Typography variant="h5" fontWeight={600} sx={{ color: createForm.name ? '#050505' : '#bcc0c4', mb: 0.5 }}>
                                {createForm.name || 'Tên nhóm'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {createForm.privacy === GroupPrivacy.PRIVATE ? 'Quyền riêng tư của nhóm' : 'Nhóm Công khai'} · 1 thành viên
                            </Typography>

                            {/* Tabs Preview */}
                            <Box sx={{
                                display: 'flex',
                                gap: 1,
                                borderTop: '1px solid #dddfe2',
                                borderBottom: '1px solid #dddfe2',
                                py: 1.5,
                                mb: 2
                            }}>
                                <Button size="small" sx={{ textTransform: 'none', color: '#65676b', minWidth: 'auto' }}>Giới thiệu</Button>
                                <Button size="small" sx={{ textTransform: 'none', color: '#65676b', minWidth: 'auto' }}>Bài viết</Button>
                                <Button size="small" sx={{ textTransform: 'none', color: '#65676b', minWidth: 'auto' }}>Thành viên</Button>
                                <Button size="small" sx={{ textTransform: 'none', color: '#65676b', minWidth: 'auto' }}>Sự kiện</Button>
                            </Box>

                            {/* Create Post Preview */}
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <Box sx={{ flex: 1 }}>
                                    <Box sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5,
                                        p: 1.5,
                                        bgcolor: '#f0f2f5',
                                        borderRadius: '20px',
                                        mb: 1.5
                                    }}>
                                        <Avatar sx={{ width: 32, height: 32, bgcolor: '#e4e6eb' }} />
                                        <Typography color="text.secondary" fontSize={14}>
                                            Bạn đang nghĩ gì?
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-around' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <ImageIcon sx={{ color: '#45bd62', fontSize: 18 }} />
                                            <Typography variant="caption" color="text.secondary">Ảnh/video</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <TagIcon sx={{ color: '#1877f2', fontSize: 18 }} />
                                            <Typography variant="caption" color="text.secondary">Gắn thẻ người khác</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <EmojiIcon sx={{ color: '#f7b928', fontSize: 18 }} />
                                            <Typography variant="caption" color="text.secondary">Feeling/activity</Typography>
                                        </Box>
                                    </Box>
                                </Box>

                                {/* About Section */}
                                <Box sx={{ width: 200 }}>
                                    <Typography fontWeight={500} color="text.secondary" fontSize={14}>
                                        Giới thiệu
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>
                    </Card>
                </Box>
            </Box>
        </Box>
    );
}
