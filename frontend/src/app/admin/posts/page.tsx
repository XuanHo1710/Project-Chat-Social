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
    Avatar,
    Chip,
    IconButton,
    InputBase,
    Button,
    Pagination,
    Stack,
    Menu,
    MenuItem,
    ListItemIcon,
    Tooltip
} from '@mui/material';
import {
    Search as SearchIcon,
    FilterList as FilterListIcon,
    MoreVert as MoreVertIcon,
    Delete as DeleteIcon,
    Visibility as VisibilityIcon,
    Image as ImageIcon
} from '@mui/icons-material';

// Mock posts data
const mockPosts = [
    { id: 101, author: 'Nguyễn Văn A', content: 'Hôm nay trời đẹp quá!', type: 'IMAGE', privacy: 'PUBLIC', reactions: 156, comments: 23, status: 'ACTIVE', time: '2 giờ trước', thumbnail: '/mock-img-1.jpg' },
    { id: 102, author: 'Trần Thị B', content: 'Cần tìm người nuôi mèo...', type: 'TEXT', privacy: 'FRIEND', reactions: 45, comments: 12, status: 'ACTIVE', time: '1 ngày trước', thumbnail: null },
    { id: 103, author: 'Lê Văn C', content: 'Chia sẻ kinh nghiệm lập trình', type: 'VIDEO', privacy: 'GROUP', reactions: 890, comments: 150, status: 'REPORTED', time: '30 phút trước', thumbnail: '/mock-img-2.jpg' },
    { id: 104, author: 'Phạm Thị D', content: 'Check in Đà Lạt', type: 'IMAGE', privacy: 'PUBLIC', reactions: 340, comments: 45, status: 'ACTIVE', time: '3 ngày trước', thumbnail: '/mock-img-3.jpg' },
    { id: 105, author: 'Admin System', content: 'Thông báo bảo trì server', type: 'TEXT', privacy: 'PUBLIC', reactions: 1200, comments: 300, status: 'ACTIVE', time: '1 tuần trước', thumbnail: null },
];

export default function PostsManagementPage() {
    const [page, setPage] = useState(1);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedPost, setSelectedPost] = useState<any>(null);

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, post: any) => {
        setAnchorEl(event.currentTarget);
        setSelectedPost(post);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedPost(null);
    };

    const getStatusChip = (status: string) => {
        switch (status) {
            case 'ACTIVE': return <Chip label="Hiển thị" color="success" size="small" variant="outlined" />;
            case 'REPORTED': return <Chip label="Bị báo cáo" color="error" size="small" variant="outlined" />;
            case 'HIDDEN': return <Chip label="Đã ẩn" color="default" size="small" variant="outlined" />;
            default: return <Chip label={status} size="small" />;
        }
    };

    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
                <Typography variant="h5" fontWeight="bold">Quản lý Bài viết</Typography>
            </Stack>

            <Paper sx={{ width: '100%', mb: 2, borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                    <Paper
                        component="form"
                        sx={{ p: '2px 4px', display: 'flex', alignItems: 'center', width: 400, bgcolor: (theme) => theme.palette.action.hover, boxShadow: 'none' }}
                    >
                        <IconButton sx={{ p: '10px' }} aria-label="search">
                            <SearchIcon />
                        </IconButton>
                        <InputBase
                            sx={{ ml: 1, flex: 1 }}
                            placeholder="Tìm kiếm bài viết..."
                        />
                    </Paper>
                    <Button startIcon={<FilterListIcon />}>Tất cả</Button>
                </Box>
                <TableContainer>
                    <Table sx={{ minWidth: 750 }} aria-labelledby="tableTitle">
                        <TableHead sx={{ bgcolor: (theme) => theme.palette.background.default }}>
                            <TableRow>
                                <TableCell>ID</TableCell>
                                <TableCell>Tác giả</TableCell>
                                <TableCell>Nội dung</TableCell>
                                <TableCell>Loại</TableCell>
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
                                    <TableCell>#{post.id}</TableCell>
                                    <TableCell>
                                        <Typography variant="subtitle2" fontWeight="600">{post.author}</Typography>
                                        <Typography variant="caption" color="text.secondary">{post.time}</Typography>
                                    </TableCell>
                                    <TableCell sx={{ maxWidth: 300 }}>
                                        <Typography noWrap variant="body2">{post.content}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Stack direction="row" alignItems="center" gap={0.5}>
                                            {post.type !== 'TEXT' && <ImageIcon fontSize="small" color="action" />}
                                            <Typography variant="body2">{post.type}</Typography>
                                        </Stack>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="caption" display="block">Like: {post.reactions}</Typography>
                                        <Typography variant="caption" display="block">Cmt: {post.comments}</Typography>
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
