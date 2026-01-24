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
    Edit as EditIcon,
    Block as BlockIcon,
    Delete as DeleteIcon,
    VerifiedUser as VerifiedUserIcon
} from '@mui/icons-material';

// Mock users data
const mockUsers = [
    { id: 1, name: 'Nguyễn Văn A', email: 'vana@example.com', role: 'ADMIN', status: 'ACTIVE', lastLogin: '2 giờ trước', avatar: '' },
    { id: 2, name: 'Trần Thị B', email: 'thib@example.com', role: 'USER', status: 'ACTIVE', lastLogin: '5 phút trước', avatar: '' },
    { id: 3, name: 'Lê Văn C', email: 'vanc@example.com', role: 'USER', status: 'BLOCKED', lastLogin: '3 ngày trước', avatar: '' },
    { id: 4, name: 'Phạm Thị D', email: 'thid@example.com', role: 'USER', status: 'ACTIVE', lastLogin: '1 ngày trước', avatar: '' },
    { id: 5, name: 'Hoàng Văn E', email: 'vane@example.com', role: 'USER', status: 'PENDING', lastLogin: 'Chưa đăng nhập', avatar: '' },
    { id: 6, name: 'Đỗ Thị F', email: 'thif@example.com', role: 'USER', status: 'ACTIVE', lastLogin: '10 phút trước', avatar: '' },
    { id: 7, name: 'Ngô Văn G', email: 'vang@example.com', role: 'USER', status: 'ACTIVE', lastLogin: '1 tháng trước', avatar: '' },
];

export default function UsersManagementPage() {
    const [page, setPage] = useState(1);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedUser, setSelectedUser] = useState<any>(null);

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, user: any) => {
        setAnchorEl(event.currentTarget);
        setSelectedUser(user);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedUser(null);
    };

    const getStatusChip = (status: string) => {
        switch (status) {
            case 'ACTIVE': return <Chip label="Hoạt động" color="success" size="small" variant="outlined" />;
            case 'BLOCKED': return <Chip label="Đã khóa" color="error" size="small" variant="outlined" />;
            case 'PENDING': return <Chip label="Chờ duyệt" color="warning" size="small" variant="outlined" />;
            default: return <Chip label={status} size="small" />;
        }
    };

    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
                <Typography variant="h5" fontWeight="bold">Quản lý Tài khoản</Typography>
                <Button variant="contained" startIcon={<VerifiedUserIcon />}>Thêm Admin mới</Button>
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
                            placeholder="Tìm kiếm theo tên, email..."
                        />
                    </Paper>
                    <Button startIcon={<FilterListIcon />}>Bộ lọc</Button>
                </Box>
                <TableContainer>
                    <Table sx={{ minWidth: 750 }} aria-labelledby="tableTitle">
                        <TableHead sx={{ bgcolor: (theme) => theme.palette.background.default }}>
                            <TableRow>
                                <TableCell>Người dùng</TableCell>
                                <TableCell>Email</TableCell>
                                <TableCell>Vai trò</TableCell>
                                <TableCell>Trạng thái</TableCell>
                                <TableCell>Đăng nhập cuối</TableCell>
                                <TableCell align="right">Hành động</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {mockUsers.map((user) => (
                                <TableRow
                                    hover
                                    key={user.id}
                                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                >
                                    <TableCell component="th" scope="row">
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Avatar src={user.avatar} alt={user.name}>{user.name.charAt(0)}</Avatar>
                                            <Typography variant="subtitle2" fontWeight="600">{user.name}</Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={user.role}
                                            size="small"
                                            color={user.role === 'ADMIN' ? 'primary' : 'default'}
                                            sx={{ fontWeight: 500 }}
                                        />
                                    </TableCell>
                                    <TableCell>{getStatusChip(user.status)}</TableCell>
                                    <TableCell>{user.lastLogin}</TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Tùy chọn">
                                            <IconButton onClick={(e) => handleMenuOpen(e, user)}>
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
                    <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                    Xem chi tiết & Sửa
                </MenuItem>
                <MenuItem onClick={handleMenuClose} sx={{ color: 'error.main' }}>
                    <ListItemIcon><BlockIcon fontSize="small" color="error" /></ListItemIcon>
                    Khóa tài khoản
                </MenuItem>
            </Menu>
        </Box>
    );
}
