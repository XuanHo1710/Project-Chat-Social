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
    useTheme,
    alpha,
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
import { useTranslation } from 'react-i18next';

export default function CreateGroupPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { t } = useTranslation();

    const [createForm, setCreateForm] = useState<CreateGroupData>({
        name: '',
        description: '',
        privacy: "PRIVATE",
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

    const privacyText = createForm.privacy === "PRIVATE"
        ? t('groups.group_privacy')
        : t('groups.group_privacy');

    return (
        <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
            <Header />

            <Box sx={{ display: 'flex', pt: 7 }}>
                {/* Left Sidebar - Form */}
                <Box
                    sx={{
                        width: 360,
                        height: 'calc(100vh - 56px)',
                        bgcolor: 'background.paper',
                        borderRight: `1px solid ${theme.palette.divider}`,
                        position: 'fixed',
                        left: 0,
                        top: 56,
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {/* Sidebar Header */}
                    <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <IconButton
                                size="small"
                                onClick={() => router.push('/groups')}
                                sx={{
                                    bgcolor: 'action.hover',
                                    '&:hover': { bgcolor: 'action.selected' }
                                }}
                            >
                                <ArrowBackIcon fontSize="small" />
                            </IconButton>
                            <Box>
                                <Typography
                                    variant="caption"
                                    sx={{ color: 'text.secondary', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                                    onClick={() => router.push('/groups')}
                                >
                                    {t('groups.groups')} › {t('groups.create_group')}
                                </Typography>
                            </Box>
                        </Box>
                        <Typography variant="h5" fontWeight={700}>
                            {t('groups.create_group')}
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
                                {t('groups.admins')}
                            </Typography>
                        </Box>
                    </Box>

                    {/* Form Content */}
                    <Box sx={{ p: 2, flex: 1 }}>
                        {/* Group Name */}
                        <TextField
                            fullWidth
                            placeholder={t('groups.group_name_placeholder')}
                            value={createForm.name}
                            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                            sx={{
                                mb: 2,
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: 1.5,
                                    '& fieldset': { borderColor: theme.palette.divider },
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
                                    '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
                                }}
                                renderValue={(value) => (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {value === "PRIVATE" ? (
                                            <LockIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                                        ) : (
                                            <PublicIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                                        )}
                                        <Typography>
                                            {value === "PRIVATE" ? t('groups.private_group') : t('groups.public_group')}
                                        </Typography>
                                    </Box>
                                )}
                            >
                                <MenuItem value="PUBLIC">
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                        <PublicIcon sx={{ mt: 0.5 }} />
                                        <Box>
                                            <Typography fontWeight={500}>{t('groups.public_group')}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {t('groups.public_group_desc')}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </MenuItem>
                                <MenuItem value="PRIVATE">
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                        <LockIcon sx={{ mt: 0.5 }} />
                                        <Box>
                                            <Typography fontWeight={500}>{t('groups.private_group')}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {t('groups.private_group_desc')}
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
                                    color: 'primary.main',
                                    fontWeight: 500,
                                    display: 'block',
                                    mb: 0.5
                                }}
                            >
                                {t('groups.invite_members')}
                            </Typography>
                            <TextField
                                fullWidth
                                placeholder={t('groups.invite_placeholder', { defaultValue: 'Enter name or email' })}
                                value={friendSearch}
                                onChange={(e) => setFriendSearch(e.target.value)}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 1.5,
                                        bgcolor: 'action.hover',
                                        '& fieldset': { borderColor: 'primary.main', borderWidth: 2 },
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
                                            sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}
                                        />
                                    ))}
                                </Box>
                            )}

                            {/* Friends Suggestions */}
                            {friendSearch && filteredFriends.length > 0 && (
                                <Box sx={{
                                    mt: 1,
                                    bgcolor: 'background.paper',
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
                                                    color: 'primary.main',
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
                    <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                        <Button
                            fullWidth
                            variant="contained"
                            onClick={handleCreateGroup}
                            disabled={!createForm.name.trim() || isCreating}
                            sx={{
                                bgcolor: createForm.name.trim() ? 'primary.main' : 'action.disabledBackground',
                                color: createForm.name.trim() ? 'primary.contrastText' : 'text.disabled',
                                textTransform: 'none',
                                fontWeight: 600,
                                py: 1,
                                borderRadius: 1.5,
                                boxShadow: 'none',
                                '&:hover': {
                                    bgcolor: createForm.name.trim() ? 'primary.dark' : 'action.disabledBackground',
                                    boxShadow: 'none'
                                },
                                '&.Mui-disabled': {
                                    bgcolor: 'action.disabledBackground',
                                    color: 'text.disabled',
                                }
                            }}
                        >
                            {isCreating ? <CircularProgress size={20} color="inherit" /> : t('groups.create_group')}
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
                            borderBottom: `1px solid ${theme.palette.divider}`
                        }}>
                            <Typography fontWeight={500} color="text.secondary">
                                {t('groups.preview_desktop')}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <IconButton
                                    size="small"
                                    onClick={() => setPreviewMode('desktop')}
                                    sx={{
                                        bgcolor: previewMode === 'desktop' ? (theme) => alpha(theme.palette.primary.main, 0.1) : 'transparent',
                                        color: previewMode === 'desktop' ? 'primary.main' : 'text.secondary'
                                    }}
                                >
                                    <ComputerIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    onClick={() => setPreviewMode('mobile')}
                                    sx={{
                                        bgcolor: previewMode === 'mobile' ? (theme) => alpha(theme.palette.primary.main, 0.1) : 'transparent',
                                        color: previewMode === 'mobile' ? 'primary.main' : 'text.secondary'
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
                                    background: isDark
                                        ? 'linear-gradient(135deg, #2A2A2A 0%, #1a1a1a 100%)'
                                        : 'linear-gradient(135deg, #e8e8e8 0%, #d1d1d1 100%)',
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
                                    bgcolor: 'action.hover',
                                    p: 2
                                }}>
                                    <GroupsIcon sx={{ fontSize: 80, color: 'text.disabled' }} />
                                </Box>
                            </Box>

                            {/* Group Info */}
                            <Typography variant="h5" fontWeight={600} sx={{ color: createForm.name ? 'text.primary' : 'text.disabled', mb: 0.5 }}>
                                {createForm.name || t('groups.group_name')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {createForm.privacy === "PRIVATE" ? t('groups.private_group') : t('groups.public_group')} · 1 {t('groups.members')}
                            </Typography>

                            {/* Tabs Preview */}
                            <Box sx={{
                                display: 'flex',
                                gap: 1,
                                borderTop: `1px solid ${theme.palette.divider}`,
                                borderBottom: `1px solid ${theme.palette.divider}`,
                                py: 1.5,
                                mb: 2
                            }}>
                                <Button size="small" sx={{ textTransform: 'none', color: 'text.secondary', minWidth: 'auto' }}>{t('groups.about_group')}</Button>
                                <Button size="small" sx={{ textTransform: 'none', color: 'text.secondary', minWidth: 'auto' }}>{t('profile.posts')}</Button>
                                <Button size="small" sx={{ textTransform: 'none', color: 'text.secondary', minWidth: 'auto' }}>{t('groups.members_list')}</Button>
                                <Button size="small" sx={{ textTransform: 'none', color: 'text.secondary', minWidth: 'auto' }}>{t('profile.events')}</Button>
                            </Box>

                            {/* Create Post Preview */}
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <Box sx={{ flex: 1 }}>
                                    <Box sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5,
                                        p: 1.5,
                                        bgcolor: 'action.hover',
                                        borderRadius: '20px',
                                        mb: 1.5
                                    }}>
                                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'action.selected' }} />
                                        <Typography color="text.secondary" fontSize={14}>
                                            {t('post.whats_on_your_mind')}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-around' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <ImageIcon sx={{ color: 'success.main', fontSize: 18 }} />
                                            <Typography variant="caption" color="text.secondary">{t('post.photo_video')}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <TagIcon sx={{ color: 'primary.main', fontSize: 18 }} />
                                            <Typography variant="caption" color="text.secondary">{t('post.tag_people')}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <EmojiIcon sx={{ color: 'warning.main', fontSize: 18 }} />
                                            <Typography variant="caption" color="text.secondary">{t('post.feeling_activity')}</Typography>
                                        </Box>
                                    </Box>
                                </Box>

                                {/* About Section */}
                                <Box sx={{ width: 200 }}>
                                    <Typography fontWeight={500} color="text.secondary" fontSize={14}>
                                        {t('groups.about_group')}
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
