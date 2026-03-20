'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Box,
    Typography,
    Avatar,
    Button,
    TextField,
    InputAdornment,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    IconButton,
    CircularProgress,
    Chip,
    useTheme,
} from '@mui/material';
import {
    Search as SearchIcon,
    Close as CloseIcon,
    Check as CheckIcon,
} from '@mui/icons-material';
import { relationshipService } from '@/services/relationship.service';
import { groupService } from '@/services/group.service';
import { FriendType } from '@/types/account';
import { useAuthStore } from '@/stores/useAuthStore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface InviteFriendsDialogProps {
    open: boolean;
    onClose: () => void;
    groupId: string;
    groupName: string;
}

export default function InviteFriendsDialog({ open, onClose, groupId, groupName }: InviteFriendsDialogProps) {
    const { user } = useAuthStore();
    const { t } = useTranslation();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const inputBg = isDark ? 'rgba(255,255,255,0.1)' : '#f0f2f5';
    const hoverBg = isDark ? 'rgba(255,255,255,0.1)' : '#f0f2f5';
    const [friends, setFriends] = useState<FriendType[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
    const [invitingId, setInvitingId] = useState<string | null>(null);
    const [existingMemberIds, setExistingMemberIds] = useState<Set<string>>(new Set());
    const [pendingInviteIds, setPendingInviteIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const loadData = async () => {
            if (!user?.id) return;
            setIsLoading(true);
            try {
                // Load friends and existing members in parallel
                const [friendsResponse, membersResponse] = await Promise.all([
                    relationshipService.getFriends(),
                    groupService.getMembers(groupId, 1, 100)
                ]);

                setFriends(friendsResponse.data || []);

                // Get IDs of existing members
                const memberIds = new Set<string>(
                    (membersResponse.members || []).map((m: any) => m._id || m.userId?._id)
                );
                setExistingMemberIds(memberIds);

                // Only admin/owner can view pending members endpoint to avoid 403 toast for normal members
                try {
                    const groupDetail = await groupService.getGroupById(groupId);
                    if (groupDetail?.myRole === 'ADMIN' || groupDetail?.myRole === 'OWNER') {
                        const pendingResponse = await groupService.getPendingMembers(groupId, 1, 100);
                        const pendingIds = new Set<string>(
                            (pendingResponse.members || []).map((m: any) => m.userId?._id || m._id)
                        );
                        setPendingInviteIds(pendingIds);
                        setInvitedIds(pendingIds);
                    }
                } catch {
                    // Keep invite dialog usable even if pending list can't be fetched
                }
            } catch (error) {
                console.error('Failed to load data:', error);
            } finally {
                setIsLoading(false);
            }
        };
        if (open && user?.id) {
            loadData();
        }
    }, [open, user?.id, groupId]);


    const handleInvite = async (friendId: string) => {
        setInvitingId(friendId);
        try {
            await groupService.inviteMember(groupId, friendId);
            setInvitedIds(prev => new Set([...prev, friendId]));
            toast.success(t('groups.invite_sent'));
        } catch {
            toast.error(t('groups.invite_failed'));
        } finally {
            setInvitingId(null);
        }
    };

    const getButtonStatus = (friendId: string): 'invited' | 'member' | 'pending' | 'available' => {
        if (existingMemberIds.has(friendId)) return 'member';
        if (invitedIds.has(friendId)) return 'invited';
        if (pendingInviteIds.has(friendId)) return 'pending';
        return 'available';
    };

    const filteredFriends = friends.filter(friend => {
        const fullName = `${friend.firstName} ${friend.lastName}`.toLowerCase();
        return fullName.includes(searchQuery.toLowerCase());
    });

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: { borderRadius: 2, maxHeight: '80vh' }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: `1px solid ${theme.palette.divider}`,
                pb: 2
            }}>
                <Typography variant="h6" fontWeight={700}>
                    {t('groups.invite_friends_to', { group: groupName })}
                </Typography>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 0, overflow: "hidden" }}>
                {/* Search */}
                <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
                    <TextField
                        fullWidth
                        placeholder={t('groups.search_friends')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ color: 'text.secondary' }} />
                                </InputAdornment>
                            ),
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 4,
                                bgcolor: inputBg,
                                '& fieldset': { border: 'none' }
                            }
                        }}
                    />
                </Box>

                {/* Friends List */}
                <Box sx={{ maxHeight: 400, overflowY: 'auto', p: 1 }}>
                    {isLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : filteredFriends.length === 0 ? (
                        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                            {friends.length === 0 ? t('groups.no_friends_yet') : t('groups.no_friends_found')}
                        </Typography>
                    ) : (
                        <List>
                            {filteredFriends.map((friend) => {
                                const status = getButtonStatus(friend._id);

                                return (
                                    <ListItem
                                        key={friend._id}
                                        secondaryAction={
                                            status === 'member' ? (
                                                <Chip
                                                    label={t('groups.already_member')}
                                                    size="small"
                                                    sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb', color: 'text.secondary' }}
                                                />
                                            ) : status === 'invited' || status === 'pending' ? (
                                                <Button
                                                    disabled
                                                    startIcon={<CheckIcon />}
                                                    sx={{
                                                        textTransform: 'none',
                                                        color: 'text.secondary'
                                                    }}
                                                >
                                                    {status === 'pending' ? t('groups.invite_pending') : t('groups.invited')}
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="contained"
                                                    onClick={() => handleInvite(friend._id)}
                                                    disabled={invitingId === friend._id}
                                                    sx={{
                                                        textTransform: 'none',
                                                        bgcolor: 'primary.main',
                                                        '&:hover': { bgcolor: 'primary.dark' }
                                                    }}
                                                >
                                                    {invitingId === friend._id ? (
                                                        <CircularProgress size={20} color="inherit" />
                                                    ) : (
                                                        t('groups.invite')
                                                    )}
                                                </Button>
                                            )
                                        }
                                        sx={{
                                            '&:hover': { bgcolor: hoverBg },
                                            borderRadius: 1,
                                        }}
                                    >
                                        <ListItemAvatar>
                                            <Avatar src={friend.avatar || ""} />
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={`${friend.firstName} ${friend.lastName}`}
                                            primaryTypographyProps={{ fontWeight: 500 }}
                                        />
                                    </ListItem>
                                );
                            })}
                        </List>
                    )}
                </Box>
            </DialogContent>
        </Dialog>
    );
}
