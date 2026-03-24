'use client';

import { useEffect, useState } from 'react';
import {
    Box,
    Typography,
    Button,
    TextField,
    InputAdornment,
    CircularProgress,
    Avatar,
    List,
    ListItemButton,
    ListItemAvatar,
    ListItemText,
    IconButton,
    Divider,
    Card,
    Skeleton,
    useTheme,
    alpha,
} from '@mui/material';
import {
    Search as SearchIcon,
    Add as AddIcon,
    Groups as GroupsIcon,
    Settings as SettingsIcon,
    MoreHoriz as MoreHorizIcon,
} from '@mui/icons-material';
import Header from '@/components/home/Header';
import { groupService } from '@/services/group.service';
import { Group, GroupWithMembership } from '@/types/group';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/useAuthStore';

export default function GroupsPage() {
    const router = useRouter();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { user, isLoading: isAuthLoading } = useAuthStore();
    const [suggestedGroups, setSuggestedGroups] = useState<Group[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [myGroups, setMyGroups] = useState<GroupWithMembership[]>([]);
    const { t } = useTranslation();
    const isBootstrappingAuth = isAuthLoading || !user?.id;

    useEffect(() => {
        if (isBootstrappingAuth) {
            return;
        }
        loadGroups();
    }, [isBootstrappingAuth]);

    const loadGroups = async () => {
        setIsLoading(true);
        try {
            const [myGroupsData, suggestedData] = await Promise.all([
                groupService.getMyGroups(),
                groupService.getSuggestedGroups(10),
            ]);
            setMyGroups(myGroupsData);
            setSuggestedGroups(suggestedData);
        } catch (error) {
            console.error('Failed to load groups:', error);
        } finally {
            setIsLoading(false);
        }
    };


    const handleJoinGroup = async (groupId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await groupService.joinGroup(groupId);
            loadGroups();
        } catch (error) {
            console.error('Failed to join group:', error);
        }
    };

    const formatLastActivity = (date: string) => {
        const now = new Date();
        const activityDate = new Date(date);
        const diffMs = now.getTime() - activityDate.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        const diffWeeks = Math.floor(diffDays / 7);

        if (diffMins < 60) return t('time.minutes_ago', { count: diffMins });
        if (diffHours < 24) return t('time.hours_ago', { count: diffHours });
        if (diffDays < 7) return t('time.days_ago', { count: diffDays });
        if (diffWeeks < 4) return t('time.weeks_ago', { count: diffWeeks });
        return t('time.months_ago', { count: Math.floor(diffDays / 30) });
    };

    // Filter groups based on search
    const filteredGroups = searchQuery
        ? myGroups.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : myGroups;

    const hoverBg = isDark ? 'rgba(255,255,255,0.1)' : 'action.hover';
    const inputBg = isDark ? 'rgba(255,255,255,0.1)' : 'action.hover';
    const showLoadingSkeleton = isBootstrappingAuth || isLoading;

    return (
        <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pb: { xs: '64px', md: 0 } }}>
            <Header />

            <Box sx={{ display: 'flex', pt: '56px', flexDirection: { xs: 'column', md: 'row' } }}>
                {/* Left Sidebar */}
                <Box
                    sx={{
                        width: { xs: '100%', md: 300, lg: 360 },
                        height: { xs: 'auto', md: 'calc(100vh - 56px)' },
                        bgcolor: 'background.paper',
                        borderRight: { xs: 'none', md: `1px solid ${theme.palette.divider}` },
                        borderBottom: { xs: `1px solid ${theme.palette.divider}`, md: 'none' },
                        position: { xs: 'static', md: 'fixed' },
                        left: 0,
                        top: 56,
                        overflowY: 'auto',
                        p: { xs: 1.5, md: 2 },
                        zIndex: 10,
                    }}
                >
                    {/* Sidebar Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h5" fontWeight={700}>
                            {t('groups.groups')}
                        </Typography>
                        <IconButton sx={{ bgcolor: hoverBg }}>
                            <SettingsIcon />
                        </IconButton>
                    </Box>

                    {/* Search */}
                    <TextField
                        fullWidth
                        placeholder={t('groups.search_groups')}
                        size="small"
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
                            mb: 2,
                            '& .MuiOutlinedInput-root': {
                                bgcolor: inputBg,
                                borderRadius: 20,
                                '& fieldset': { border: 'none' },
                            },
                        }}
                    />

                    {/* Nhóm của bạn */}
                    <ListItemButton
                        sx={{ borderRadius: 2, mb: 1 }}
                        selected
                    >
                        <ListItemAvatar>
                            <Avatar sx={{ bgcolor: '#1877f2' }}>
                                <GroupsIcon />
                            </Avatar>
                        </ListItemAvatar>
                        <ListItemText primary={t('groups.your_groups')} primaryTypographyProps={{ fontWeight: 500 }} />
                    </ListItemButton>

                    {/* Create Group Button */}
                    <Button
                        fullWidth
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => router.push('/groups/create')}
                        sx={{
                            bgcolor: isDark ? 'rgba(24, 119, 242, 0.2)' : (theme) => alpha(theme.palette.primary.main, 0.1),
                            color: 'primary.main',
                            textTransform: 'none',
                            fontWeight: 600,
                            boxShadow: 'none',
                            '&:hover': { bgcolor: isDark ? 'rgba(24, 119, 242, 0.3)' : (theme) => alpha(theme.palette.primary.main, 0.2), boxShadow: 'none' },
                            mb: 2,
                        }}
                    >
                        {t('groups.create_new_group')}
                    </Button>

                    <Divider sx={{ my: 2 }} />

                    {/* Groups List (Sidebar) */}
                    <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="subtitle1" fontWeight={600}>
                                {t('groups.joined_groups')}
                            </Typography>
                            <Button
                                size="small"
                                sx={{ textTransform: 'none', color: 'primary.main' }}
                            >
                                {t('common.view_all')}
                            </Button>
                        </Box>

                        {showLoadingSkeleton ? (
                            <Box sx={{ py: 2 }}>
                                {[...Array(4)].map((_, index) => (
                                    <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                                        <Skeleton variant="rounded" width={48} height={48} />
                                        <Box sx={{ flex: 1 }}>
                                            <Skeleton variant="text" width="80%" height={20} />
                                            <Skeleton variant="text" width="50%" height={16} />
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        ) : (
                            <List sx={{ p: 0 }}>
                                {filteredGroups.slice(0, 5).map((group) => (
                                    <ListItemButton
                                        key={group._id}
                                        sx={{ borderRadius: 2, mb: 0.5 }}
                                        onClick={() => router.push(`/groups/${group._id}`)}
                                    >
                                        <ListItemAvatar>
                                            <Avatar
                                                src={group.avatar || undefined}
                                                variant="rounded"
                                                sx={{ width: 48, height: 48 }}
                                            >
                                                <GroupsIcon />
                                            </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={group.name}
                                            secondary={`${t('groups.last_activity')}: ${formatLastActivity(group.updatedAt)}`}
                                            primaryTypographyProps={{ fontWeight: 500, noWrap: true }}
                                            secondaryTypographyProps={{ fontSize: 12 }}
                                        />
                                    </ListItemButton>
                                ))}
                            </List>
                        )}
                    </Box>
                </Box>

                {/* Main Content */}
                <Box sx={{ flex: 1, ml: { xs: 0, md: '300px', lg: '360px' }, p: { xs: 1.5, md: 3 }, pb: { xs: '72px', md: 3 } }}>
                    {showLoadingSkeleton ? (
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
                                gap: 2,
                            }}
                        >
                            {[...Array(6)].map((_, index) => (
                                <Card key={index} sx={{ display: 'flex', p: 2 }}>
                                    <Skeleton variant="rounded" width={80} height={80} sx={{ mr: 2 }} />
                                    <Box sx={{ flex: 1 }}>
                                        <Skeleton variant="text" width="75%" height={24} />
                                        <Skeleton variant="text" width="55%" height={20} sx={{ mb: 1 }} />
                                        <Skeleton variant="rounded" width="100%" height={32} />
                                    </Box>
                                </Card>
                            ))}
                        </Box>
                    ) : myGroups.length > 0 ? (
                        <>
                            {/* Header */}
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                                <Typography variant="h5" fontWeight={600}>
                                    {t('groups.all_groups')} ({myGroups.length})
                                </Typography>
                                <Button sx={{ textTransform: 'none', color: 'primary.main' }}>
                                    {t('groups.sort')}
                                </Button>
                            </Box>

                            {/* Groups Grid */}
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
                                    gap: 2,
                                }}
                            >
                                {filteredGroups.map((group) => (
                                    <Card
                                        key={group._id}
                                        sx={{
                                            display: 'flex',
                                            p: 2,
                                            cursor: 'pointer',
                                            '&:hover': { bgcolor: hoverBg },
                                        }}
                                        onClick={() => router.push(`/groups/${group._id}`)}>
                                        <Avatar
                                            src={group.avatar || undefined}
                                            variant="rounded"
                                            sx={{ width: 80, height: 80, mr: 2 }}
                                        >
                                            <GroupsIcon sx={{ fontSize: 40 }} />
                                        </Avatar>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography fontWeight={600} noWrap>
                                                {group.name}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                {t('groups.last_visit')}:
                                                <br />
                                                {formatLastActivity(group.updatedAt)}
                                            </Typography>
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    fullWidth
                                                    sx={{
                                                        textTransform: 'none',
                                                        borderColor: 'primary.main',
                                                        color: 'primary.main',
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/groups/${group._id}`);
                                                    }}
                                                >
                                                    {t('groups.view_group')}
                                                </Button>
                                                <IconButton size="small" sx={{ border: `1px solid ${theme.palette.divider}` }}>
                                                    <MoreHorizIcon fontSize="small" />
                                                </IconButton>
                                            </Box>
                                        </Box>
                                    </Card>
                                ))}
                            </Box>
                        </>
                    ) : (
                        /* Empty State */
                        <Box sx={{ maxWidth: 600, mx: 'auto', textAlign: 'center', py: 8 }}>
                            <GroupsIcon sx={{ fontSize: 80, color: '#bcc0c4', mb: 2 }} />
                            <Typography variant="h5" fontWeight={600} sx={{ mb: 1 }}>
                                {t('groups.no_groups')}
                            </Typography>
                            <Typography color="text.secondary" sx={{ mb: 3 }}>
                                {t('groups.discover_desc')}
                            </Typography>
                            <Button
                                variant="contained"
                                onClick={() => router.push('/groups/create')}
                                sx={{ textTransform: 'none' }}
                            >
                                {t('groups.discover_groups')}
                            </Button>
                        </Box>
                    )}

                    {/* Suggested Groups Section */}
                    {suggestedGroups.length > 0 && (
                        <Box sx={{ mt: 4 }}>
                            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                                {t('groups.suggestions')}
                            </Typography>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
                                    gap: 2,
                                }}
                            >
                                {suggestedGroups.map((group) => (
                                    <Card
                                        key={group._id}
                                        sx={{
                                            display: 'flex',
                                            p: 2,
                                            cursor: 'pointer',
                                            '&:hover': { bgcolor: '#f5f6f7' },
                                        }}
                                        onClick={() => router.push(`/groups/${group._id}`)}
                                    >
                                        <Avatar
                                            src={group.avatar || undefined}
                                            variant="rounded"
                                            sx={{ width: 80, height: 80, mr: 2 }}
                                        >
                                            <GroupsIcon sx={{ fontSize: 40 }} />
                                        </Avatar>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography fontWeight={600} noWrap>
                                                {group.name}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                {group.memberCount.toLocaleString()} {t('groups.members')}
                                            </Typography>
                                            <Button
                                                variant="contained"
                                                size="small"
                                                fullWidth
                                                sx={{ textTransform: 'none' }}
                                                onClick={(e) => handleJoinGroup(group._id, e)}
                                            >
                                                {t('groups.join_group')}
                                            </Button>
                                        </Box>
                                    </Card>
                                ))}
                            </Box>
                        </Box>
                    )}
                </Box>
            </Box>

        </Box >
    );
}
