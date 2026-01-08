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

export default function GroupsPage() {
    const router = useRouter();
    const [myGroups, setMyGroups] = useState<GroupWithMembership[]>([]);
    const [suggestedGroups, setSuggestedGroups] = useState<Group[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadGroups();
    }, []);

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

        if (diffMins < 60) return `${diffMins} phút trước`;
        if (diffHours < 24) return `${diffHours} giờ trước`;
        if (diffDays < 7) return `${diffDays} ngày trước`;
        if (diffWeeks < 4) return `${diffWeeks} tuần trước`;
        return `${Math.floor(diffDays / 30)} tháng trước`;
    };

    // Filter groups based on search
    const filteredGroups = searchQuery
        ? myGroups.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : myGroups;

    return (
        <Box sx={{ bgcolor: '#f0f2f5', minHeight: '100vh' }}>
            <Header />

            <Box sx={{ display: 'flex', pt: 7 }}>
                {/* Left Sidebar */}
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
                        p: 2,
                    }}
                >
                    {/* Sidebar Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h5" fontWeight={700}>
                            Nhóm
                        </Typography>
                        <IconButton sx={{ bgcolor: '#e4e6eb' }}>
                            <SettingsIcon />
                        </IconButton>
                    </Box>

                    {/* Search */}
                    <TextField
                        fullWidth
                        placeholder="Tìm kiếm nhóm"
                        size="small"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ color: '#65676b' }} />
                                </InputAdornment>
                            ),
                        }}
                        sx={{
                            mb: 2,
                            '& .MuiOutlinedInput-root': {
                                bgcolor: '#f0f2f5',
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
                        <ListItemText primary="Nhóm của bạn" primaryTypographyProps={{ fontWeight: 500 }} />
                    </ListItemButton>

                    {/* Create Group Button */}
                    <Button
                        fullWidth
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => router.push('/groups/create')}
                        sx={{
                            bgcolor: '#e7f3ff',
                            color: '#1877f2',
                            textTransform: 'none',
                            fontWeight: 600,
                            boxShadow: 'none',
                            '&:hover': { bgcolor: '#dbe7f2', boxShadow: 'none' },
                            mb: 2,
                        }}
                    >
                        + Tạo nhóm mới
                    </Button>

                    <Divider sx={{ my: 2 }} />

                    {/* Groups List */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle1" fontWeight={600}>
                            Nhóm bạn đã tham gia
                        </Typography>
                        <Button
                            size="small"
                            sx={{ textTransform: 'none', color: '#1877f2' }}
                        >
                            Xem tất cả
                        </Button>
                    </Box>

                    {isLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress size={24} />
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
                                        secondary={`Lần hoạt động gần nhất: ${formatLastActivity(group.updatedAt)}`}
                                        primaryTypographyProps={{ fontWeight: 500, noWrap: true }}
                                        secondaryTypographyProps={{ fontSize: 12 }}
                                    />
                                </ListItemButton>
                            ))}
                        </List>
                    )}
                </Box>

                {/* Main Content */}
                <Box sx={{ flex: 1, ml: '360px', p: 3 }}>
                    {myGroups.length > 0 ? (
                        <>
                            {/* Header */}
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                                <Typography variant="h5" fontWeight={600}>
                                    Tất cả các nhóm bạn đã tham gia ({myGroups.length})
                                </Typography>
                                <Button sx={{ textTransform: 'none', color: '#1877f2' }}>
                                    Sắp xếp
                                </Button>
                            </Box>

                            {/* Groups Grid */}
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
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
                                                Lần truy cập gần đây nhất:
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
                                                        borderColor: '#1877f2',
                                                        color: '#1877f2',
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/groups/${group._id}`);
                                                    }}
                                                >
                                                    Xem nhóm
                                                </Button>
                                                <IconButton size="small" sx={{ border: '1px solid #ddd' }}>
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
                                Bạn chưa tham gia nhóm nào
                            </Typography>
                            <Typography color="text.secondary" sx={{ mb: 3 }}>
                                Khám phá và tham gia các nhóm để kết nối với mọi người
                            </Typography>
                            <Button
                                variant="contained"
                                onClick={() => router.push('/groups/create')}
                                sx={{ textTransform: 'none' }}
                            >
                                KHÁM PHÁ NHÓM
                            </Button>
                        </Box>
                    )}

                    {/* Suggested Groups Section */}
                    {suggestedGroups.length > 0 && (
                        <Box sx={{ mt: 4 }}>
                            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                                Gợi ý cho bạn
                            </Typography>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
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
                                                {group.memberCount.toLocaleString()} thành viên
                                            </Typography>
                                            <Button
                                                variant="contained"
                                                size="small"
                                                fullWidth
                                                sx={{ textTransform: 'none' }}
                                                onClick={(e) => handleJoinGroup(group._id, e)}
                                            >
                                                Tham gia
                                            </Button>
                                        </Box>
                                    </Card>
                                ))}
                            </Box>
                        </Box>
                    )}
                </Box>
            </Box>

        </Box>
    );
}
