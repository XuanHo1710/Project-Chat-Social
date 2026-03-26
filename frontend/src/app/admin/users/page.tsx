'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Avatar, Chip, IconButton, InputBase, Button, Pagination, Stack, Menu, MenuItem, ListItemIcon,
    Tooltip, Select, FormControl, InputLabel, useTheme, alpha, Collapse, Divider, Dialog,
    DialogTitle, DialogContent, DialogActions, TextField, RadioGroup, Radio, FormControlLabel,
    CircularProgress, Grid
} from '@mui/material';
import {
    Search as SearchIcon, FilterList as FilterListIcon, MoreVert as MoreVertIcon,
    Edit as EditIcon, Block as BlockIcon, Sort as SortIcon,
    KeyboardArrowDown as KeyboardArrowDownIcon, KeyboardArrowUp as KeyboardArrowUpIcon,
    Close as CloseIcon, PersonAdd as PersonAddIcon, AdminPanelSettings as AdminPanelSettingsIcon,
    Person as PersonIcon, Work as WorkIcon, Email as EmailIcon, Lock as LockIcon,
    ArrowDownward as ArrowDownwardIcon, ArrowUpward as ArrowUpwardIcon,
    CheckCircleOutline as CheckCircleOutlineIcon, CalendarToday as CalendarTodayIcon,
    Phone as PhoneIcon, Badge as BadgeIcon,
} from '@mui/icons-material';
import { adminService, AdminUser } from '@/services/admin.service';
import { useTranslation } from 'react-i18next';
import { timeAgo } from '@/utils/formatDate';

interface AddAccountFormData {
    fullName: string;
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
    role: 'ADMIN' | 'EMPLOYEE';
}

export default function UsersManagementPage() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    const [page, setPage] = useState(1);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [addAccountOpen, setAddAccountOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [inputValue, setInputValue] = useState('');

    // User detail dialog
    const [userDetailOpen, setUserDetailOpen] = useState(false);
    const [detailUserId, setDetailUserId] = useState<string | null>(null);

    // Block dialog
    const [blockDialogOpen, setBlockDialogOpen] = useState(false);
    const [blockReason, setBlockReason] = useState('');

    // Filter states
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const limit = 10;

    const { data: usersData, isLoading } = useQuery({
        queryKey: ['admin', 'users', { page, limit, status: statusFilter, role: roleFilter, sortBy, sortOrder, search: searchTerm }],
        queryFn: () => adminService.getUsers({
            page, limit,
            status: statusFilter !== 'ALL' ? statusFilter : undefined,
            role: roleFilter !== 'ALL' ? roleFilter : undefined,
            sortBy, sortOrder,
            search: searchTerm || undefined,
        }),
    });

    const { data: userDetail, isLoading: isLoadingDetail } = useQuery({
        queryKey: ['admin', 'user-detail', detailUserId],
        queryFn: () => adminService.getUserById(detailUserId!),
        enabled: !!detailUserId && userDetailOpen,
    });

    const users = usersData?.data || [];
    const pagination = usersData?.pagination;

    // Mutations
    const blockMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason?: string }) => adminService.blockUser(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'user-detail'] });
            toast.success(t('admin.block_success'));
            setBlockDialogOpen(false);
            setBlockReason('');
            handleMenuClose();
        },
        onError: () => toast.error(t('admin.block_error')),
    });

    const unblockMutation = useMutation({
        mutationFn: (id: string) => adminService.unblockUser(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'user-detail'] });
            toast.success(t('admin.unblock_success'));
            handleMenuClose();
        },
        onError: () => toast.error(t('admin.unblock_error')),
    });

    // Add account form
    const [formData, setFormData] = useState<AddAccountFormData>({
        fullName: '', username: '', email: '', password: '', confirmPassword: '', role: 'EMPLOYEE'
    });
    const [formErrors, setFormErrors] = useState<Partial<AddAccountFormData>>({});

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, user: AdminUser) => {
        setAnchorEl(event.currentTarget);
        setSelectedUser(user);
    };
    const handleMenuClose = () => { setAnchorEl(null); setSelectedUser(null); };

    const handleViewUser = (user: AdminUser) => {
        setDetailUserId(user.id);
        setUserDetailOpen(true);
        handleMenuClose();
    };

    const handleBlockClick = (user: AdminUser) => {
        if (user.status === 'BLOCKED') {
            unblockMutation.mutate(user.id);
        } else {
            setBlockDialogOpen(true);
        }
    };

    const handleConfirmBlock = () => {
        if (selectedUser) {
            blockMutation.mutate({ id: selectedUser.id, reason: blockReason || undefined });
        }
    };

    const clearFilters = () => { setStatusFilter('ALL'); setRoleFilter('ALL'); setSortBy('lastLogin'); };

    const handleOpenAddAccount = () => {
        setFormData({ fullName: '', username: '', email: '', password: '', confirmPassword: '', role: 'EMPLOYEE' });
        setFormErrors({});
        setAddAccountOpen(true);
    };

    const validateForm = () => {
        const errors: Partial<AddAccountFormData> = {};
        if (!formData.fullName.trim()) errors.fullName = t('admin.validate_fullname');
        if (!formData.username.trim()) errors.username = t('admin.validate_username');
        else if (formData.username.includes(' ')) errors.username = t('admin.validate_username_spaces');
        if (!formData.email.trim()) errors.email = t('admin.validate_email');
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = t('admin.validate_email_invalid');
        if (!formData.password) errors.password = t('admin.validate_password');
        else if (formData.password.length < 6) errors.password = t('admin.validate_password_min');
        if (formData.password !== formData.confirmPassword) errors.confirmPassword = t('admin.validate_password_mismatch');
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const createAccountMutation = useMutation({
        mutationFn: (data: AddAccountFormData) => adminService.createAccount(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
            setAddAccountOpen(false);
            toast.success(t('admin.create_account_success'));
        },
        onError: (error: Error & { response?: { data?: { message?: string } } }) => toast.error(error?.response?.data?.message || t('admin.create_account_error')),
    });

    const handleAddAccount = () => { if (validateForm()) createAccountMutation.mutate(formData as unknown as AddAccountFormData); };

    const getStatusChip = (status: string) => {
        switch (status) {
            case 'ACTIVE': return <Chip label={t('admin.status_active')} color="success" size="small" variant="outlined" />;
            case 'BLOCKED': return <Chip label={t('admin.status_blocked')} color="error" size="small" variant="outlined" />;
            case 'PENDING': return <Chip label={t('admin.status_pending')} color="warning" size="small" variant="outlined" />;
            default: return <Chip label={status} size="small" />;
        }
    };

    const getRoleChip = (role: string) => {
        switch (role) {
            case 'ADMIN':
                return <Chip icon={<AdminPanelSettingsIcon sx={{ fontSize: 16 }} />} label="ADMIN" size="small" sx={{ fontWeight: 700, bgcolor: alpha('#fa383e', 0.15), color: '#fa383e', border: `1px solid ${alpha('#fa383e', 0.3)}`, '& .MuiChip-icon': { color: '#fa383e' } }} />;
            case 'EMPLOYEE':
                return <Chip icon={<WorkIcon sx={{ fontSize: 16 }} />} label="EMPLOYEE" size="small" sx={{ fontWeight: 700, bgcolor: alpha('#1877f2', 0.15), color: '#1877f2', border: `1px solid ${alpha('#1877f2', 0.3)}`, '& .MuiChip-icon': { color: '#1877f2' } }} />;
            default:
                return <Chip icon={<PersonIcon sx={{ fontSize: 16 }} />} label="USER" size="small" sx={{ fontWeight: 500, bgcolor: isDark ? '#3a3b3c' : '#e4e6eb', color: 'text.secondary' }} />;
        }
    };

    const formatLastLogin = (lastLogin: string | null) => {
        if (!lastLogin) return t('admin.never_logged_in');
        return timeAgo(lastLogin);
    };

    const hasActiveFilters = statusFilter !== 'ALL' || roleFilter !== 'ALL';

    return (
        <Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2} mb={4}>
                <Typography variant="h5" fontWeight="bold">{t('admin.user_management')}</Typography>
                <Button variant="contained" startIcon={<PersonAddIcon />} onClick={handleOpenAddAccount}>{t('admin.add_user')}</Button>
            </Stack>

            <Paper sx={{ width: '100%', mb: 2, borderRadius: 3, overflow: 'hidden', bgcolor: isDark ? '#242526' : '#ffffff', border: `1px solid ${isDark ? '#3a3b3c' : '#e4e6eb'}`, boxShadow: isDark ? 'none' : '0 2px 12px rgba(0,0,0,0.06)' }}>
                {/* Search & Filter Bar */}
                <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                    <Paper component="form" onSubmit={(e) => { e.preventDefault(); setSearchTerm(inputValue); }}
                        sx={{ p: '2px 4px', display: 'flex', alignItems: 'center', width: { xs: '100%', sm: 300, md: 400 }, bgcolor: isDark ? '#3a3b3c' : '#f0f2f5', boxShadow: 'none', borderRadius: 100 }}>
                        <IconButton type="submit" sx={{ p: '10px' }}><SearchIcon /></IconButton>
                        <InputBase sx={{ ml: 1, flex: 1 }} placeholder={t('admin.search_users_placeholder')} value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
                    </Paper>
                    <Button startIcon={<FilterListIcon />} endIcon={showFilters ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        onClick={() => setShowFilters(!showFilters)} variant={hasActiveFilters ? 'contained' : 'outlined'} color={hasActiveFilters ? 'primary' : 'inherit'}>
                        {t('common.filter')} {hasActiveFilters && `(${[statusFilter !== 'ALL', roleFilter !== 'ALL'].filter(Boolean).length})`}
                    </Button>
                </Box>

                <Collapse in={showFilters}>
                    <Box sx={{ px: 2, pb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                        <FormControl size="small" sx={{ minWidth: { xs: 120, sm: 150 } }}>
                            <InputLabel>{t('admin.filter_status')}</InputLabel>
                            <Select value={statusFilter} label={t('admin.filter_status')} onChange={(e) => setStatusFilter(e.target.value)}>
                                <MenuItem value="ALL">{t('admin.filter_all')}</MenuItem>
                                <MenuItem value="ACTIVE">{t('admin.status_active')}</MenuItem>
                                <MenuItem value="BLOCKED">{t('admin.status_blocked')}</MenuItem>
                                <MenuItem value="PENDING">{t('admin.status_pending')}</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: { xs: 120, sm: 150 } }}>
                            <InputLabel>{t('admin.filter_role')}</InputLabel>
                            <Select value={roleFilter} label={t('admin.filter_role')} onChange={(e) => setRoleFilter(e.target.value)}>
                                <MenuItem value="ALL">{t('admin.filter_all')}</MenuItem>
                                <MenuItem value="ADMIN">Admin</MenuItem>
                                <MenuItem value="EMPLOYEE">Employee</MenuItem>
                                <MenuItem value="USER">User</MenuItem>
                            </Select>
                        </FormControl>
                        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel>{t('admin.sort_by')}</InputLabel>
                            <Select value={sortBy} label={t('admin.sort_by')} onChange={(e) => setSortBy(e.target.value)} startAdornment={<SortIcon sx={{ mr: 1, color: 'text.secondary' }} />}>
                                <MenuItem value="lastLogin">{t('admin.last_login')}</MenuItem>
                                <MenuItem value="email">{t('auth.email')}</MenuItem>
                                <MenuItem value="name">{t('admin.users')}</MenuItem>
                                <MenuItem value="createdAt">{t('admin.created_at')}</MenuItem>
                            </Select>
                        </FormControl>
                        <Tooltip title={sortOrder === 'desc' ? t('admin.sort_descending') : t('admin.sort_ascending')}>
                            <IconButton onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} sx={{ border: `1px solid ${isDark ? '#3a3b3c' : '#e4e6eb'}`, borderRadius: 1 }}>
                                {sortOrder === 'desc' ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />}
                            </IconButton>
                        </Tooltip>
                        {hasActiveFilters && <Button size="small" startIcon={<CloseIcon />} onClick={clearFilters} sx={{ ml: 'auto' }}>{t('admin.clear_filters')}</Button>}
                    </Box>
                </Collapse>

                <TableContainer>
                    <Table sx={{ minWidth: 650 }}>
                        <TableHead sx={{ bgcolor: isDark ? '#18191a' : '#f0f2f5' }}>
                            <TableRow>
                                <TableCell>{t('admin.users')}</TableCell>
                                <TableCell>{t('auth.email')}</TableCell>
                                <TableCell>{t('admin.role')}</TableCell>
                                <TableCell>{t('admin.status')}</TableCell>
                                <TableCell>{t('admin.last_login')}</TableCell>
                                <TableCell align="right">{t('admin.actions')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><CircularProgress size={32} /><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{t('common.loading')}</Typography></TableCell></TableRow>
                            ) : users.length === 0 ? (
                                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><Typography variant="body2" color="text.secondary">{t('admin.no_users_found')}</Typography></TableCell></TableRow>
                            ) : users.map((user, index) => (
                                <TableRow hover key={user.id} sx={{ '&:last-child td, &:last-child th': { border: 0 }, cursor: 'pointer' }}
                                    onClick={() => handleViewUser(user)}>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Avatar src={user.avatar} alt={user.name} sx={{ bgcolor: `hsl(${index * 50}, 60%, 50%)`, fontWeight: 600 }}>
                                                {user.name.charAt(0).toUpperCase()}
                                            </Avatar>
                                            <Typography variant="subtitle2" fontWeight="600">{user.name}</Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>{getRoleChip(user.role)}</TableCell>
                                    <TableCell>{getStatusChip(user.status)}</TableCell>
                                    <TableCell><Typography variant="body2" color="text.secondary">{formatLastLogin(user.lastLogin)}</Typography></TableCell>
                                    <TableCell align="right">
                                        <Tooltip title={t('admin.options')}>
                                            <IconButton onClick={(e) => { e.stopPropagation(); handleMenuOpen(e, user); }}><MoreVertIcon /></IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        {pagination ? t('admin.showing_users', { count: users.length, total: pagination.total }) : ''}
                    </Typography>
                    <Pagination count={pagination?.totalPages || 1} page={page} onChange={(_, v) => setPage(v)} color="primary" />
                </Box>
            </Paper>

            {/* Action Menu */}
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
                <MenuItem onClick={() => selectedUser && handleViewUser(selectedUser)}>
                    <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                    {t('admin.view_edit_user')}
                </MenuItem>
                <MenuItem onClick={() => selectedUser && handleBlockClick(selectedUser)}
                    sx={{ color: selectedUser?.status === 'BLOCKED' ? 'success.main' : 'error.main' }}>
                    <ListItemIcon>
                        {selectedUser?.status === 'BLOCKED'
                            ? <CheckCircleOutlineIcon fontSize="small" color="success" />
                            : <BlockIcon fontSize="small" color="error" />}
                    </ListItemIcon>
                    {selectedUser?.status === 'BLOCKED' ? t('admin.unblock_account') : t('admin.block_account')}
                </MenuItem>
            </Menu>

            {/* Block Confirmation Dialog */}
            <Dialog open={blockDialogOpen} onClose={() => setBlockDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BlockIcon color="error" />
                    {t('admin.block_account')}
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {t('admin.confirm_block_user', { name: selectedUser?.name })}
                    </Typography>
                    <TextField fullWidth multiline rows={3} label={t('admin.block_reason')}
                        placeholder={t('admin.block_reason_placeholder')} value={blockReason}
                        onChange={(e) => setBlockReason(e.target.value)} size="small" />
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setBlockDialogOpen(false)}>{t('admin.cancel')}</Button>
                    <Button variant="contained" color="error" onClick={handleConfirmBlock} disabled={blockMutation.isPending}>
                        {blockMutation.isPending ? <CircularProgress size={20} color="inherit" /> : t('admin.confirm_block')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* User Detail Dialog */}
            <Dialog open={userDetailOpen} onClose={() => setUserDetailOpen(false)} maxWidth="sm" fullWidth
                PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#e4e6eb'}`, pb: 2 }}>
                    <Typography variant="h6" fontWeight="bold">{t('admin.user_detail')}</Typography>
                    <IconButton onClick={() => setUserDetailOpen(false)} size="small"><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                    {isLoadingDetail ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
                    ) : userDetail ? (() => {
                        return (
                            <Box>
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, px: 3, bgcolor: isDark ? '#18191a' : '#f8f9fa' }}>
                                    <Avatar src={userDetail.avatar} sx={{ width: 80, height: 80, mb: 1.5, fontSize: 32, bgcolor: '#1877f2' }}>
                                        {userDetail.name?.[0]?.toUpperCase()}
                                    </Avatar>
                                    <Typography variant="h6" fontWeight="bold">{userDetail.name}</Typography>
                                    <Typography variant="body2" color="text.secondary">@{userDetail.username || ''}</Typography>
                                    <Stack direction="row" spacing={1} mt={1}>
                                        {getRoleChip(userDetail.role)}
                                        {getStatusChip(userDetail.status)}
                                    </Stack>
                                </Box>
                                <Box sx={{ p: 3 }}>
                                    <Grid container spacing={2.5}>
                                        {[
                                            { icon: <EmailIcon />, label: 'Email', value: userDetail.email },
                                            { icon: <PhoneIcon />, label: t('admin.phone'), value: userDetail.phone || '—' },
                                            { icon: <BadgeIcon />, label: 'Username', value: userDetail.username || '—' },
                                            { icon: <CalendarTodayIcon />, label: t('admin.created_at'), value: userDetail.createdAt ? new Date(userDetail.createdAt).toLocaleDateString('vi-VN') : '—' },
                                            { icon: <PersonIcon />, label: t('admin.last_login'), value: userDetail.lastLogin ? timeAgo(userDetail.lastLogin) : t('admin.never_logged_in') },
                                        ].map((item, i) => (
                                            <Grid key={i} size={{ xs: 12, sm: 6 }}>
                                                <Stack direction="row" spacing={1.5} alignItems="center">
                                                    <Box sx={{ color: 'text.secondary', '& .MuiSvgIcon-root': { fontSize: 20 } }}>{item.icon}</Box>
                                                    <Box>
                                                        <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                                                        <Typography variant="body2" fontWeight="500">{item.value}</Typography>
                                                    </Box>
                                                </Stack>
                                            </Grid>
                                        ))}
                                    </Grid>
                                </Box>
                            </Box>
                        );
                    })() : null}
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${isDark ? '#3a3b3c' : '#e4e6eb'}`, justifyContent: 'space-between' }}>
                    {userDetail && (() => {
                        const isBlocked = userDetail.isBlocked || userDetail.status === 'BLOCKED';
                        return (
                            <Button variant="contained" color={isBlocked ? 'success' : 'error'} size="small"
                                startIcon={isBlocked ? <CheckCircleOutlineIcon /> : <BlockIcon />}
                                onClick={() => {
                                    if (isBlocked) {
                                        unblockMutation.mutate(detailUserId!);
                                        setUserDetailOpen(false);
                                    } else {
                                        setSelectedUser({ id: detailUserId!, name: userDetail.name, email: userDetail.email, role: userDetail.role, status: 'ACTIVE', lastLogin: null, createdAt: '' });
                                        setBlockDialogOpen(true);
                                        setUserDetailOpen(false);
                                    }
                                }}>
                                {isBlocked ? t('admin.unblock_account') : t('admin.block_account')}
                            </Button>
                        );
                    })()}
                    <Button onClick={() => setUserDetailOpen(false)}>{t('admin.close')}</Button>
                </DialogActions>
            </Dialog>

            {/* Add Account Dialog */}
            <Dialog open={addAccountOpen} onClose={() => setAddAccountOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle><Stack direction="row" alignItems="center" gap={1}><PersonAddIcon color="primary" />{t('admin.add_account_title')}</Stack></DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3} sx={{ py: 1 }}>
                        <Box>
                            <Typography variant="subtitle2" fontWeight="600" gutterBottom>{t('admin.select_role')}</Typography>
                            <RadioGroup row value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as 'ADMIN' | 'EMPLOYEE' })}>
                                <FormControlLabel value="EMPLOYEE" control={<Radio />}
                                    label={<Stack direction="row" alignItems="center" gap={1}><WorkIcon sx={{ color: '#1877f2' }} /><Box><Typography variant="body2" fontWeight="600">Employee</Typography><Typography variant="caption" color="text.secondary">{t('admin.employee_desc')}</Typography></Box></Stack>}
                                    sx={{ flex: 1, m: 0, p: 2, border: `2px solid ${formData.role === 'EMPLOYEE' ? '#1877f2' : (isDark ? '#3a3b3c' : '#e4e6eb')}`, borderRadius: 2, mr: 2 }} />
                                <FormControlLabel value="ADMIN" control={<Radio />}
                                    label={<Stack direction="row" alignItems="center" gap={1}><AdminPanelSettingsIcon sx={{ color: '#fa383e' }} /><Box><Typography variant="body2" fontWeight="600">Admin</Typography><Typography variant="caption" color="text.secondary">{t('admin.admin_desc')}</Typography></Box></Stack>}
                                    sx={{ flex: 1, m: 0, p: 2, border: `2px solid ${formData.role === 'ADMIN' ? '#fa383e' : (isDark ? '#3a3b3c' : '#e4e6eb')}`, borderRadius: 2 }} />
                            </RadioGroup>
                        </Box>
                        <TextField fullWidth label={t('admin.full_name')} value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} error={!!formErrors.fullName} helperText={formErrors.fullName} slotProps={{ input: { startAdornment: <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} /> } }} placeholder={t('admin.full_name_placeholder')} />
                        <TextField fullWidth label={t('admin.username_label')} value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} error={!!formErrors.username} helperText={formErrors.username} slotProps={{ input: { startAdornment: <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} /> } }} placeholder={t('admin.username_placeholder')} />
                        <TextField fullWidth label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} error={!!formErrors.email} helperText={formErrors.email} slotProps={{ input: { startAdornment: <EmailIcon sx={{ mr: 1, color: 'text.secondary' }} /> } }} placeholder="VD: example@email.com" />
                        <TextField fullWidth label={t('admin.password')} type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} error={!!formErrors.password} helperText={formErrors.password} slotProps={{ input: { startAdornment: <LockIcon sx={{ mr: 1, color: 'text.secondary' }} /> } }} placeholder={t('admin.password_placeholder')} />
                        <TextField fullWidth label={t('admin.confirm_password')} type="password" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} error={!!formErrors.confirmPassword} helperText={formErrors.confirmPassword} slotProps={{ input: { startAdornment: <LockIcon sx={{ mr: 1, color: 'text.secondary' }} /> } }} placeholder={t('admin.confirm_password_placeholder')} />
                        <Paper sx={{ p: 2, bgcolor: isDark ? '#18191a' : '#f0f2f5', borderRadius: 2 }}>
                            <Typography variant="subtitle2" fontWeight="600" gutterBottom>{t('admin.permissions_of', { role: formData.role === 'ADMIN' ? 'Admin' : 'Employee' })}</Typography>
                            {formData.role === 'EMPLOYEE' ? (
                                <Stack spacing={0.5}>
                                    <Typography variant="body2" color="text.secondary">✓ {t('admin.perm_manage_posts')}</Typography>
                                    <Typography variant="body2" color="text.secondary">✓ {t('admin.perm_manage_themes')}</Typography>
                                    <Typography variant="body2" color="error.main">✗ {t('admin.perm_no_manage_accounts')}</Typography>
                                    <Typography variant="body2" color="error.main">✗ {t('admin.perm_no_system_settings')}</Typography>
                                </Stack>
                            ) : (
                                <Stack spacing={0.5}>
                                    <Typography variant="body2" color="success.main">✓ {t('admin.perm_full_admin')}</Typography>
                                    <Typography variant="body2" color="text.secondary">✓ {t('admin.perm_manage_posts')}</Typography>
                                    <Typography variant="body2" color="text.secondary">✓ {t('admin.perm_manage_themes')}</Typography>
                                    <Typography variant="body2" color="text.secondary">✓ {t('admin.perm_no_manage_accounts')}</Typography>
                                    <Typography variant="body2" color="text.secondary">✓ {t('admin.perm_no_system_settings')}</Typography>
                                </Stack>
                            )}
                        </Paper>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setAddAccountOpen(false)}>{t('admin.cancel')}</Button>
                    <Button variant="contained" onClick={handleAddAccount} disabled={createAccountMutation.isPending || !formData.fullName || !formData.email || !formData.password}>
                        {createAccountMutation.isPending ? <CircularProgress size={24} color="inherit" /> : t('admin.create_account')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
