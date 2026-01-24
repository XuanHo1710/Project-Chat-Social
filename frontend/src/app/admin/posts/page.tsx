'use client';

import React, { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    IconButton,
    InputBase,
    Button,
    Pagination,
    Stack,
    Menu,
    MenuItem,
    ListItemIcon,
    Tooltip,
    Select,
    FormControl,
    InputLabel,
    useTheme,
    alpha,
    Collapse,
    Divider
} from '@mui/material';
import {
    Search as SearchIcon,
    FilterList as FilterListIcon,
    MoreVert as MoreVertIcon,
    Delete as DeleteIcon,
    Visibility as VisibilityIcon,
    Public as PublicIcon,
    People as PeopleIcon,
    Lock as LockIcon,
    Group as GroupIcon,
    Sort as SortIcon,
    KeyboardArrowDown as KeyboardArrowDownIcon,
    KeyboardArrowUp as KeyboardArrowUpIcon,
    Close as CloseIcon,
    ThumbUp as ThumbUpIcon,
    Comment as CommentIcon,
    Share as ShareIcon
} from '@mui/icons-material';

// Mock posts data with shares
const mockPosts = [
    { id: 101, author: 'Nguyễn Văn A', content: 'Hôm nay trời đẹp quá!', privacy: 'PUBLIC', reactions: 156, comments: 23, shares: 12, status: 'ACTIVE', time: '2 giờ trước' },
    { id: 102, author: 'Trần Thị B', content: 'Cần tìm người nuôi mèo...', privacy: 'FRIENDS', reactions: 45, comments: 12, shares: 3, status: 'ACTIVE', time: '1 ngày trước' },
    { id: 103, author: 'Lê Văn C', content: 'Chia sẻ kinh nghiệm lập trình', privacy: 'PUBLIC', reactions: 890, comments: 150, shares: 89, status: 'REPORTED', time: '30 phút trước' },
    { id: 104, author: 'Phạm Thị D', content: 'Check in Đà Lạt', privacy: 'PRIVATE', reactions: 340, comments: 45, shares: 0, status: 'ACTIVE', time: '3 ngày trước' },
    { id: 105, author: 'Admin System', content: 'Thông báo bảo trì server', privacy: 'PUBLIC', reactions: 1200, comments: 300, shares: 156, status: 'ACTIVE', time: '1 tuần trước' },
    { id: 106, author: 'Hoàng Văn E', content: 'Nhóm IT chia sẻ kiến thức', privacy: 'GROUP', reactions: 78, comments: 15, shares: 5, status: 'HIDDEN', time: '2 ngày trước' },
];

export default function PostsManagementPage() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [page, setPage] = useState(1);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedPost, setSelectedPost] = useState<any>(null);
    const [showFilters, setShowFilters] = useState(false);

    // Filter states
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [privacyFilter, setPrivacyFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState('time');

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, post: any) => {
        setAnchorEl(event.currentTarget);
        setSelectedPost(post);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedPost(null);
    };

    const clearFilters = () => {
        setStatusFilter('ALL');
        setPrivacyFilter('ALL');
        setSortBy('time');
    };

    const getStatusChip = (status: string) => {
        switch (status) {
            case 'ACTIVE': return <Chip label="Hiển thị" color="success" size="small" variant="outlined" />;
            case 'REPORTED': return <Chip label="Bị báo cáo" color="error" size="small" variant="outlined" />;
            case 'HIDDEN': return <Chip label="Đã ẩn" color="default" size="small" variant="outlined" />;
            default: return <Chip label={status} size="small" />;
        }
    };

    const getPrivacyBadge = (privacy: string) => {
        const configs: Record<string, { icon: React.ReactNode; label: string; color: string; bgcolor: string }> = {
            PUBLIC: {
                icon: <PublicIcon sx={{ fontSize: 14 }} />,
                label: 'Công khai',
                color: '#1877f2',
                bgcolor: alpha('#1877f2', 0.1)
            },
            FRIENDS: {
                icon: <PeopleIcon sx={{ fontSize: 14 }} />,
                label: 'Bạn bè',
                color: '#42b72a',
                bgcolor: alpha('#42b72a', 0.1)
            },
            PRIVATE: {
                icon: <LockIcon sx={{ fontSize: 14 }} />,
                label: 'Riêng tư',
                color: '#fa383e',
                bgcolor: alpha('#fa383e', 0.1)
            },
            GROUP: {
                icon: <GroupIcon sx={{ fontSize: 14 }} />,
                label: 'Nhóm',
                color: '#f7b928',
                bgcolor: alpha('#f7b928', 0.1)
            }
        };

        const config = configs[privacy] || configs.PUBLIC;

        return (
            <Chip
                icon={config.icon as any}
                label={config.label}
                size="small"
                sx={{
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    color: config.color,
                    bgcolor: config.bgcolor,
                    border: `1px solid ${alpha(config.color, 0.3)}`,
                    '& .MuiChip-icon': {
                        color: config.color
                    }
                }}
            />
        );
    };

    const hasActiveFilters = statusFilter !== 'ALL' || privacyFilter !== 'ALL';

    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
                <Typography variant="h5" fontWeight="bold">Quản lý Bài viết</Typography>
            </Stack>

            <Paper sx={{
                width: '100%',
                mb: 2,
                borderRadius: 3,
                overflow: 'hidden',
                bgcolor: isDark ? '#242526' : '#ffffff',
                border: `1px solid ${isDark ? '#3a3b3c' : '#e4e6eb'}`,
                boxShadow: isDark ? 'none' : '0 2px 12px rgba(0,0,0,0.06)'
            }}>
                {/* Search & Filter Bar */}
                <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                    <Paper
                        component="form"
                        sx={{
                            p: '2px 4px',
                            display: 'flex',
                            alignItems: 'center',
                            width: 400,
                            bgcolor: isDark ? '#3a3b3c' : '#f0f2f5',
                            boxShadow: 'none',
                            borderRadius: 100
                        }}
                    >
                        <IconButton sx={{ p: '10px' }} aria-label="search">
                            <SearchIcon />
                        </IconButton>
                        <InputBase
                            sx={{ ml: 1, flex: 1 }}
                            placeholder="Tìm kiếm bài viết..."
                        />
                    </Paper>
                    <Button
                        startIcon={<FilterListIcon />}
                        endIcon={showFilters ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        onClick={() => setShowFilters(!showFilters)}
                        variant={hasActiveFilters ? 'contained' : 'outlined'}
                        color={hasActiveFilters ? 'primary' : 'inherit'}
                    >
                        Bộ lọc {hasActiveFilters && `(${[statusFilter !== 'ALL', privacyFilter !== 'ALL'].filter(Boolean).length})`}
                    </Button>
                </Box>

                {/* Filter Panel */}
                <Collapse in={showFilters}>
                    <Box sx={{
                        px: 2,
                        pb: 2,
                        display: 'flex',
                        gap: 2,
                        flexWrap: 'wrap',
                        alignItems: 'center'
                    }}>
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                            <InputLabel>Trạng thái</InputLabel>
                            <Select
                                value={statusFilter}
                                label="Trạng thái"
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <MenuItem value="ALL">Tất cả</MenuItem>
                                <MenuItem value="ACTIVE">Hiển thị</MenuItem>
                                <MenuItem value="REPORTED">Bị báo cáo</MenuItem>
                                <MenuItem value="HIDDEN">Đã ẩn</MenuItem>
                            </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ minWidth: 150 }}>
                            <InputLabel>Quyền riêng tư</InputLabel>
                            <Select
                                value={privacyFilter}
                                label="Quyền riêng tư"
                                onChange={(e) => setPrivacyFilter(e.target.value)}
                            >
                                <MenuItem value="ALL">Tất cả</MenuItem>
                                <MenuItem value="PUBLIC">Công khai</MenuItem>
                                <MenuItem value="FRIENDS">Bạn bè</MenuItem>
                                <MenuItem value="PRIVATE">Riêng tư</MenuItem>
                                <MenuItem value="GROUP">Nhóm</MenuItem>
                            </Select>
                        </FormControl>

                        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel>Sắp xếp theo</InputLabel>
                            <Select
                                value={sortBy}
                                label="Sắp xếp theo"
                                onChange={(e) => setSortBy(e.target.value)}
                                startAdornment={<SortIcon sx={{ mr: 1, color: 'text.secondary' }} />}
                            >
                                <MenuItem value="time">Thời gian đăng</MenuItem>
                                <MenuItem value="reactions">Lượt thích</MenuItem>
                                <MenuItem value="comments">Bình luận</MenuItem>
                                <MenuItem value="shares">Lượt chia sẻ</MenuItem>
                            </Select>
                        </FormControl>

                        {hasActiveFilters && (
                            <Button
                                size="small"
                                startIcon={<CloseIcon />}
                                onClick={clearFilters}
                                sx={{ ml: 'auto' }}
                            >
                                Xóa bộ lọc
                            </Button>
                        )}
                    </Box>
                </Collapse>

                <TableContainer>
                    <Table sx={{ minWidth: 750 }} aria-labelledby="tableTitle">
                        <TableHead sx={{
                            bgcolor: isDark ? '#18191a' : '#f0f2f5'
                        }}>
                            <TableRow>
                                <TableCell>ID</TableCell>
                                <TableCell>Tác giả</TableCell>
                                <TableCell>Nội dung</TableCell>
                                <TableCell>Quyền riêng tư</TableCell>
                                <TableCell>Tương tác</TableCell>
                                <TableCell>Trạng thái</TableCell>
                                <TableCell align="right">Hành động</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {mockPosts.map((post) => (
                                <TableRow
                                    hover
                                    key={post.id}
                                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                >
                                    <TableCell>
                                        <Typography variant="body2" fontWeight="600" color="text.secondary">
                                            #{post.id}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="subtitle2" fontWeight="600">{post.author}</Typography>
                                        <Typography variant="caption" color="text.secondary">{post.time}</Typography>
                                    </TableCell>
                                    <TableCell sx={{ maxWidth: 300 }}>
                                        <Typography noWrap variant="body2">{post.content}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        {getPrivacyBadge(post.privacy)}
                                    </TableCell>
                                    <TableCell>
                                        <Stack direction="row" spacing={2}>
                                            <Stack direction="row" alignItems="center" gap={0.5}>
                                                <ThumbUpIcon sx={{ fontSize: 14, color: '#1877f2' }} />
                                                <Typography variant="caption" fontWeight="600">{post.reactions}</Typography>
                                            </Stack>
                                            <Stack direction="row" alignItems="center" gap={0.5}>
                                                <CommentIcon sx={{ fontSize: 14, color: '#65676b' }} />
                                                <Typography variant="caption" fontWeight="600">{post.comments}</Typography>
                                            </Stack>
                                            <Stack direction="row" alignItems="center" gap={0.5}>
                                                <ShareIcon sx={{ fontSize: 14, color: '#42b72a' }} />
                                                <Typography variant="caption" fontWeight="600">{post.shares}</Typography>
                                            </Stack>
                                        </Stack>
                                    </TableCell>
                                    <TableCell>{getStatusChip(post.status)}</TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Tùy chọn">
                                            <IconButton onClick={(e) => handleMenuOpen(e, post)}>
                                                <MoreVertIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
                    <Pagination count={10} page={page} onChange={(e, v) => setPage(v)} color="primary" />
                </Box>
            </Paper>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
            >
                <MenuItem onClick={handleMenuClose}>
                    <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon>
                    Xem bài viết
                </MenuItem>
                <MenuItem onClick={handleMenuClose} sx={{ color: 'error.main' }}>
                    <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                    Xóa bài viết
                </MenuItem>
            </Menu>
        </Box>
    );
}
