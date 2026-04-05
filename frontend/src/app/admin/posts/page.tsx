'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    Divider,
    CircularProgress,
    Modal,
    Avatar,
    ImageList,
    ImageListItem,
    Skeleton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
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
    Share as ShareIcon,
    ArrowDownward as ArrowDownwardIcon,
    ArrowUpward as ArrowUpwardIcon
} from '@mui/icons-material';
import { adminService, AdminPost } from '@/services/admin.service';
import { getCommentsByPost } from '@/services/comment.service';
import { Comment } from '@/types/comment';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';


export default function PostsManagementPage() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { t } = useTranslation();
    const [page, setPage] = useState(1);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedPost, setSelectedPost] = useState<AdminPost | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [searchTerm, setSearchTerm] = useState(''); // For API query
    const [inputValue, setInputValue] = useState(''); // For input field

    // Filter states
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [privacyFilter, setPrivacyFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState('time');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const limit = 10;

    // Delete confirmation dialog
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<AdminPost | null>(null);

    // API Query
    const { data: postsData, isLoading } = useQuery({
        queryKey: ['admin', 'posts', { page, limit, status: statusFilter, privacy: privacyFilter, sortBy, sortOrder, search: searchTerm }],
        queryFn: () => adminService.getPosts({
            page,
            limit,
            status: statusFilter !== 'ALL' ? statusFilter : undefined,
            privacy: privacyFilter !== 'ALL' ? privacyFilter : undefined,
            sortBy,
            sortOrder,
            search: searchTerm || undefined
        }),
    });

    const posts = postsData?.data || [];
    const pagination = postsData?.pagination;

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, post: AdminPost) => {
        setAnchorEl(event.currentTarget);
        setSelectedPost(post);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedPost(null);
    };

    // View modal state
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [viewPostId, setViewPostId] = useState<string | null>(null);

    const { data: postDetail, isLoading: isLoadingDetail } = useQuery({
        queryKey: ['admin', 'post-detail', viewPostId],
        queryFn: () => adminService.getPostById(viewPostId!),
        enabled: !!viewPostId && viewModalOpen,
    });

    const { data: postComments, isLoading: isLoadingComments } = useQuery({
        queryKey: ['admin', 'post-comments', viewPostId],
        queryFn: () => getCommentsByPost(viewPostId!, 1, 20),
        enabled: !!viewPostId && viewModalOpen,
    });

    const handleViewPost = (post: AdminPost) => {
        if (post.privacy === 'PRIVATE') {
            toast.info(t('admin.cannot_view_private'));
            handleMenuClose();
            return;
        }
        setViewPostId(post.id);
        setViewModalOpen(true);
        handleMenuClose();
    };

    const handleCloseViewModal = () => {
        setViewModalOpen(false);
        setViewPostId(null);
    };

    // Delete mutation
    const queryClient = useQueryClient();
    const deleteMutation = useMutation({
        mutationFn: (id: string) => adminService.deletePost(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] });
            toast.success(t('admin.post_deleted'));
        },
        onError: () => {
            toast.error(t('admin.delete_failed'));
        },
    });

    const handleDeletePost = (post: AdminPost) => {
        setDeleteTarget(post);
        setDeleteDialogOpen(true);
        handleMenuClose();
    };

    const handleConfirmDelete = () => {
        if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id);
        }
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
    };

    const clearFilters = () => {
        setStatusFilter('ALL');
        setPrivacyFilter('ALL');
        setSortBy('time');
    };

    const getStatusChip = (status: string) => {
        switch (status) {
            case 'ACTIVE': return <Chip label={t('admin.status_active')} color="success" size="small" variant="outlined" />;
            case 'REPORTED': return <Chip label={t('admin.status_reported')} color="error" size="small" variant="outlined" />;
            case 'HIDDEN': return <Chip label={t('admin.status_hidden')} color="default" size="small" variant="outlined" />;
            default: return <Chip label={status} size="small" />;
        }
    };

    const getPrivacyBadge = (privacy: string) => {
        const configs: Record<string, { icon: React.ReactElement; label: string; color: string; bgcolor: string }> = {
            PUBLIC: {
                icon: <PublicIcon sx={{ fontSize: 14 }} />,
                label: t('admin.privacy_public'),
                color: '#1877f2',
                bgcolor: alpha('#1877f2', 0.1)
            },
            FRIENDS: {
                icon: <PeopleIcon sx={{ fontSize: 14 }} />,
                label: t('admin.privacy_friends'),
                color: '#42b72a',
                bgcolor: alpha('#42b72a', 0.1)
            },
            PRIVATE: {
                icon: <LockIcon sx={{ fontSize: 14 }} />,
                label: t('admin.privacy_private'),
                color: '#fa383e',
                bgcolor: alpha('#fa383e', 0.1)
            },
            GROUP: {
                icon: <GroupIcon sx={{ fontSize: 14 }} />,
                label: t('admin.privacy_group'),
                color: '#f7b928',
                bgcolor: alpha('#f7b928', 0.1)
            }
        };

        const config = configs[privacy] || configs.PUBLIC;

        return (
            <Chip
                icon={config.icon}
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
                <Typography variant="h5" fontWeight="bold">{t('admin.post_management')}</Typography>
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
                <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                    <Paper
                        component="form"
                        onSubmit={(e) => {
                            e.preventDefault();
                            setSearchTerm(inputValue); // Trigger search on Enter
                        }}
                        sx={{
                            p: '2px 4px',
                            display: 'flex',
                            alignItems: 'center',
                            width: { xs: '100%', sm: 300, md: 400 },
                            bgcolor: isDark ? '#3a3b3c' : '#f0f2f5',
                            boxShadow: 'none',
                            borderRadius: 100
                        }}
                    >
                        <IconButton type="submit" sx={{ p: '10px' }} aria-label="search">
                            <SearchIcon />
                        </IconButton>
                        <InputBase
                            sx={{ ml: 1, flex: 1 }}
                            placeholder={t('admin.search_posts_placeholder')}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                        />
                    </Paper>
                    <Button
                        startIcon={<FilterListIcon />}
                        endIcon={showFilters ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        onClick={() => setShowFilters(!showFilters)}
                        variant={hasActiveFilters ? 'contained' : 'outlined'}
                        color={hasActiveFilters ? 'primary' : 'inherit'}
                    >
                        {t('common.filter')} {hasActiveFilters && `(${[statusFilter !== 'ALL', privacyFilter !== 'ALL'].filter(Boolean).length})`}
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
                            <InputLabel>{t('admin.status')}</InputLabel>
                            <Select
                                value={statusFilter}
                                label={t('admin.status')}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <MenuItem value="ALL">{t('admin.status_all')}</MenuItem>
                                <MenuItem value="ACTIVE">{t('admin.status_active')}</MenuItem>
                                <MenuItem value="REPORTED">{t('admin.status_reported')}</MenuItem>
                                <MenuItem value="HIDDEN">{t('admin.status_hidden')}</MenuItem>
                            </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ minWidth: 150 }}>
                            <InputLabel>{t('admin.privacy')}</InputLabel>
                            <Select
                                value={privacyFilter}
                                label={t('admin.privacy')}
                                onChange={(e) => setPrivacyFilter(e.target.value)}
                            >
                                <MenuItem value="ALL">{t('admin.status_all')}</MenuItem>
                                <MenuItem value="PUBLIC">{t('admin.privacy_public')}</MenuItem>
                                <MenuItem value="FRIENDS">{t('admin.privacy_friends')}</MenuItem>
                                <MenuItem value="PRIVATE">{t('admin.privacy_private')}</MenuItem>
                                <MenuItem value="GROUP">{t('admin.privacy_group')}</MenuItem>
                            </Select>
                        </FormControl>

                        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel>{t('admin.sort_by')}</InputLabel>
                            <Select
                                value={sortBy}
                                label={t('admin.sort_by')}
                                onChange={(e) => setSortBy(e.target.value)}
                                startAdornment={<SortIcon sx={{ mr: 1, color: 'text.secondary' }} />}
                            >
                                <MenuItem value="time">{t('admin.time')}</MenuItem>
                                <MenuItem value="reactions">{t('admin.likes')}</MenuItem>
                                <MenuItem value="comments">{t('admin.comments')}</MenuItem>
                                <MenuItem value="shares">{t('admin.shares')}</MenuItem>
                            </Select>
                        </FormControl>

                        <Tooltip title={sortOrder === 'desc' ? t('admin.sort_descending') : t('admin.sort_ascending')}>
                            <IconButton
                                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                sx={{
                                    border: `1px solid ${isDark ? '#3a3b3c' : '#e4e6eb'}`,
                                    borderRadius: 1
                                }}
                            >
                                {sortOrder === 'desc' ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />}
                            </IconButton>
                        </Tooltip>

                        {hasActiveFilters && (
                            <Button
                                size="small"
                                startIcon={<CloseIcon />}
                                onClick={clearFilters}
                                sx={{ ml: 'auto' }}
                            >
                                {t('admin.clear_filters')}
                            </Button>
                        )}
                    </Box>
                </Collapse>

                <TableContainer>
                    <Table sx={{ minWidth: 650 }} aria-labelledby="tableTitle">
                        <TableHead sx={{
                            bgcolor: isDark ? '#18191a' : '#f0f2f5'
                        }}>
                            <TableRow>
                                <TableCell>ID</TableCell>
                                <TableCell>{t('admin.author')}</TableCell>
                                <TableCell>{t('admin.content')}</TableCell>
                                <TableCell>{t('admin.privacy')}</TableCell>
                                <TableCell>{t('admin.stats')}</TableCell>
                                <TableCell>{t('admin.status')}</TableCell>
                                <TableCell align="right">{t('admin.actions')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                                        <CircularProgress size={32} />
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                            {t('common.loading')}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : posts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('admin.no_posts_found')}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : posts.map((post) => (
                                <TableRow
                                    hover
                                    key={post.id}
                                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                >
                                    <TableCell>
                                        <Typography variant="body2" fontWeight="600" color="text.secondary">
                                            #{post.id.toString().slice(-6)}
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
                                        <Tooltip title={t('admin.options')}>
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
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        {pagination ? t('admin.showing_posts', { count: posts.length, total: pagination.total }) : ''}
                    </Typography>
                    <Pagination
                        count={pagination?.totalPages || 1}
                        page={page}
                        onChange={(e, v) => setPage(v)}
                        color="primary"
                    />
                </Box>
            </Paper>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
            >
                <MenuItem onClick={() => selectedPost && handleViewPost(selectedPost)}>
                    <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon>
                    {t('admin.view_post')}
                </MenuItem>
                <MenuItem onClick={() => selectedPost && handleDeletePost(selectedPost)} sx={{ color: 'error.main' }}>
                    <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                    {t('admin.delete_post')}
                </MenuItem>
            </Menu>

            {/* Post Detail Modal */}
            <Modal
                open={viewModalOpen}
                onClose={handleCloseViewModal}
                slotProps={{
                    backdrop: {
                        sx: {
                            backdropFilter: 'blur(3px)',
                            backgroundColor: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(15,23,42,0.32)',
                        },
                    },
                }}
            >
                <Box sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: { xs: '96vw', sm: '88vw', md: 760 },
                    maxWidth: 900,
                    maxHeight: { xs: '92vh', md: '88vh' },
                    bgcolor: 'background.paper',
                    borderRadius: 3.5,
                    border: `1px solid ${isDark ? '#3a3b3c' : '#dde3ef'}`,
                    boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.45)' : '0 20px 55px rgba(15,23,42,0.2)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                    {/* Header */}
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 2,
                        py: 1.5,
                        position: 'sticky',
                        top: 0,
                        zIndex: 2,
                        bgcolor: isDark ? '#1f2228' : '#ffffff',
                        borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#e4e6eb'}`,
                    }}>
                        <Typography variant="h6" fontWeight="bold">{t('admin.post_detail')}</Typography>
                        <IconButton
                            onClick={handleCloseViewModal}
                            size="small"
                            sx={{
                                bgcolor: isDark ? '#34363a' : '#eef2f7',
                                '&:hover': { bgcolor: isDark ? '#44474d' : '#e0e6ef' },
                            }}
                        >
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Box>

                    {/* Content */}
                    <Box sx={{ overflowY: 'auto', flex: 1, bgcolor: isDark ? '#181a1f' : '#fafbff' }}>
                        {isLoadingDetail ? (
                            <Box sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                                    <Skeleton variant="circular" width={48} height={48} />
                                    <Box sx={{ flex: 1 }}><Skeleton width="40%" /><Skeleton width="25%" /></Box>
                                </Box>
                                <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 1, mb: 2 }} />
                                <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
                            </Box>
                        ) : postDetail ? (
                            <>
                                {/* Author info */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, pb: 1 }}>
                                    <Avatar src={postDetail.userId?.avatar} sx={{ width: 44, height: 44, border: `2px solid ${isDark ? '#3a3b3c' : '#e4e6eb'}` }}>
                                        {postDetail.userId?.firstName?.[0] || '?'}
                                    </Avatar>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography fontWeight="bold" fontSize={15}>
                                            {postDetail.userId ? `${postDetail.userId.firstName} ${postDetail.userId.lastName}` : 'Unknown'}
                                        </Typography>
                                        <Stack direction="row" alignItems="center" spacing={1}>
                                            <Typography variant="caption" color="text.secondary">
                                                {new Date(postDetail.createdAt).toLocaleString()}
                                            </Typography>
                                            {getPrivacyBadge(postDetail.privacy)}
                                        </Stack>
                                    </Box>
                                </Box>

                                {/* Post content */}
                                {postDetail.content && (
                                    <Typography sx={{ px: 2, py: 1, whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.6 }}>
                                        {postDetail.content}
                                    </Typography>
                                )}

                                {/* Media */}
                                {postDetail.media && postDetail.media.length > 0 && (
                                    <Box sx={{ px: 0 }}>
                                        {postDetail.media.length === 1 ? (
                                            postDetail.media[0].mediaType === 'VIDEO' ? (
                                                <Box component="video" controls sx={{ width: '100%', maxHeight: 400 }} src={postDetail.media[0].url} />
                                            ) : (
                                                <Box component="img" src={postDetail.media[0].url} sx={{ width: '100%', maxHeight: 400, objectFit: 'contain', bgcolor: isDark ? '#18191a' : '#f0f2f5' }} />
                                            )
                                        ) : (
                                            <ImageList variant="quilted" cols={postDetail.media.length === 2 ? 2 : 3} gap={2} sx={{ m: 0 }}>
                                                {postDetail.media.map((m, i) => (
                                                    <ImageListItem key={i} cols={postDetail.media.length === 3 && i === 0 ? 2 : 1} rows={postDetail.media.length === 3 && i === 0 ? 2 : 1}>
                                                        {m.mediaType === 'VIDEO' ? (
                                                            <Box component="video" controls src={m.url} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <Box component="img" src={m.url} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                                                        )}
                                                    </ImageListItem>
                                                ))}
                                            </ImageList>
                                        )}
                                    </Box>
                                )}

                                {/* Stats bar */}
                                <Box sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    px: 2,
                                    py: 1.5,
                                    mt: 1,
                                    borderTop: `1px solid ${isDark ? '#3a3b3c' : '#e4e6eb'}`,
                                    borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#e4e6eb'}`,
                                    bgcolor: isDark ? alpha('#30343b', 0.45) : alpha('#f1f5fb', 0.85),
                                }}>
                                    <Stack direction="row" spacing={2}>
                                        <Stack direction="row" alignItems="center" gap={0.5}>
                                            <ThumbUpIcon sx={{ fontSize: 16, color: '#1877f2' }} />
                                            <Typography variant="body2" fontWeight="600">{postDetail.totalReacts}</Typography>
                                        </Stack>
                                    </Stack>
                                    <Stack direction="row" spacing={2}>
                                        <Typography variant="body2" color="text.secondary">{postDetail.totalComments} {t('admin.comments')}</Typography>
                                        <Typography variant="body2" color="text.secondary">{postDetail.totalShares} {t('admin.shares')}</Typography>
                                    </Stack>
                                </Box>

                                {/* Comments */}
                                <Box sx={{ p: 2, pt: 1.5 }}>
                                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>{t('admin.comments')}</Typography>
                                    {isLoadingComments ? (
                                        <Stack spacing={1.5}>
                                            {[1, 2, 3].map(i => (
                                                <Box key={i} sx={{ display: 'flex', gap: 1 }}>
                                                    <Skeleton variant="circular" width={32} height={32} />
                                                    <Skeleton variant="rounded" width="60%" height={40} />
                                                </Box>
                                            ))}
                                        </Stack>
                                    ) : postComments?.data && postComments.data.length > 0 ? (
                                        <Stack spacing={1.5} sx={{ maxHeight: 320, overflowY: 'auto', pr: 0.5 }}>
                                            {postComments.data.map((comment: Comment) => (
                                                <Box key={comment._id} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                                                    <Avatar src={comment.userId?.avatar} sx={{ width: 32, height: 32, fontSize: 14, mt: 0.5 }}>
                                                        {comment.userId?.firstName?.[0] || '?'}
                                                    </Avatar>
                                                    <Box sx={{ flex: 1 }}>
                                                        <Box sx={{
                                                            bgcolor: isDark ? '#3a3b3c' : '#f0f2f5',
                                                            borderRadius: '18px',
                                                            px: 2,
                                                            py: 1,
                                                            display: 'inline-block',
                                                            maxWidth: '100%',
                                                        }}>
                                                            <Typography variant="body2" fontWeight="bold" fontSize={13}>
                                                                {comment.userId ? `${comment.userId.firstName} ${comment.userId.lastName}` : 'Unknown'}
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.25, wordBreak: 'break-word', fontSize: 14 }}>
                                                                {comment.content}
                                                            </Typography>
                                                        </Box>
                                                        {comment.media && comment.media.length > 0 && (
                                                            <Box component="img" src={comment.media[0].url} sx={{ mt: 0.5, maxWidth: 200, maxHeight: 150, borderRadius: 2, display: 'block' }} />
                                                        )}
                                                        <Stack direction="row" spacing={2} sx={{ mt: 0.5, pl: 1 }}>
                                                            <Typography variant="caption" color="text.secondary" sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                                                                {t('common.like')}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary" sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                                                                {t('common.reply')}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {new Date(comment.createdAt).toLocaleString()}
                                                            </Typography>
                                                        </Stack>
                                                    </Box>
                                                </Box>
                                            ))}
                                        </Stack>
                                    ) : (
                                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                                            {t('admin.no_comments')}
                                        </Typography>
                                    )}
                                </Box>
                            </>
                        ) : null}
                    </Box>
                </Box>
            </Modal>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DeleteIcon color="error" />
                    {t('admin.confirm_delete_title')}
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary">
                        {t('admin.confirm_delete_post')}
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setDeleteDialogOpen(false)}>{t('admin.cancel')}</Button>
                    <Button variant="contained" color="error" onClick={handleConfirmDelete} disabled={deleteMutation.isPending}>
                        {deleteMutation.isPending ? <CircularProgress size={20} color="inherit" /> : t('admin.delete_post')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
