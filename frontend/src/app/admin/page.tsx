'use client';

import React from 'react';
import {
    Grid,
    Paper,
    Typography,
    Box,
    Card,
    CardContent,
    Stack,
    Avatar,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Divider,
    Chip,
    useTheme,
    IconButton
} from '@mui/material';
import {
    PeopleAlt as PeopleIcon,
    Article as ArticleIcon,
    Visibility as VisibilityIcon,
    TrendingUp as TrendingUpIcon,
    MoreHoriz as MoreHorizIcon,
    ArrowUpward as ArrowUpwardIcon
} from '@mui/icons-material';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { useAuthStore } from '@/stores/useAuthStore';

// --- Components ---

const StatCard = ({ title, value, icon, color, trend, trendValue }: any) => (
    <Card sx={{
        height: '100%',
        borderRadius: 4,
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        transition: 'transform 0.2s',
        '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }
    }}>
        <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box sx={{
                    p: 1.5,
                    borderRadius: 3,
                    bgcolor: `${color}15`, // 15% opacity
                    color: color,
                    display: 'flex'
                }}>
                    {icon}
                </Box>
                {trend && (
                    <Chip
                        label={`${trendValue}%`}
                        size="small"
                        icon={<ArrowUpwardIcon sx={{ width: 14 }} />}
                        sx={{
                            bgcolor: '#ebfdf4',
                            color: '#00875A',
                            fontWeight: 600,
                            height: 24,
                            '& .MuiChip-icon': { color: '#00875A' }
                        }}
                    />
                )}
            </Box>
            <Typography variant="h4" fontWeight="800" sx={{ mb: 0.5 }}>{value}</Typography>
            <Typography variant="body2" color="text.secondary" fontWeight="500">{title}</Typography>
        </CardContent>
    </Card>
);

// --- Mock Data ---

const stats = [
    { label: 'Tổng người dùng', value: '1,234', icon: <PeopleIcon fontSize="medium" />, color: '#1877f2', trend: true, trendValue: 12 },
    { label: 'Bài viết mới', value: '567', icon: <ArticleIcon fontSize="medium" />, color: '#42b72a', trend: true, trendValue: 5 },
    { label: 'Đang online', value: '42', icon: <VisibilityIcon fontSize="medium" />, color: '#f7b928', trend: false, trendValue: 0 },
    { label: 'Tổng tương tác', value: '89.2k', icon: <TrendingUpIcon fontSize="medium" />, color: '#fa383e', trend: true, trendValue: 24 },
];

const mockComments = [
    { id: 1, user: 'Hoàng Long', avatar: '', content: 'Bài viết rất hay, mình rất thích cách trình bày này!', time: '2 phút trước' },
    { id: 2, user: 'Thảo Nhi', avatar: '', content: 'Cảm ơn admin đã chia sẻ thông tin hữu ích.', time: '5 phút trước' },
    { id: 3, user: 'Minh Tuấn', avatar: '', content: 'Hóng bài tiếp theo của team quá đi ^^', time: '12 phút trước' },
    { id: 4, user: 'Hà Anh', avatar: '', content: 'Giao diện app dạo này xịn xò quá.', time: '15 phút trước' },
    { id: 5, user: 'Đức Huy', avatar: '', content: 'Cần sửa lại chút ở phần footer nha admin.', time: '25 phút trước' },
];

const trafficData = [20, 45, 30, 80, 55, 90, 100];
const activeUsersData = [10, 25, 20, 50, 40, 70, 85];

export default function AdminDashboard() {
    const theme = useTheme();
    const { user } = useAuthStore();

    return (
        <Box sx={{ maxWidth: 1600, mx: 'auto' }}>
            {/* Header Section */}
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h4" fontWeight="800" gutterBottom sx={{ letterSpacing: -0.5 }}>
                        Dashboard
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Chào {user?.fullName || 'bạn'}, đây là tổng quan hệ thống hôm nay.
                    </Typography>
                </Box>
                <Box>
                    <Chip label="Hôm nay: 22/01/2026" sx={{ fontWeight: 600, borderRadius: 2 }} />
                </Box>
            </Box>

            {/* Stats Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                {stats.map((stat, index) => (
                    <Grid item xs={12} sm={6} lg={3} key={index}>
                        <StatCard
                            title={stat.label}
                            value={stat.value}
                            icon={stat.icon}
                            color={stat.color}
                            trend={stat.trend}
                            trendValue={stat.trendValue}
                        />
                    </Grid>
                ))}
            </Grid>

            <Grid container spacing={3}>
                {/* Main Chart */}
                <Grid item xs={12} lg={8}>
                    <Paper sx={{
                        p: 3,
                        borderRadius: 4,
                        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                        height: '100%',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Box>
                                <Typography variant="h6" fontWeight="bold">Phân tích truy cập</Typography>
                                <Typography variant="caption" color="text.secondary">Dữ liệu 7 ngày gần nhất</Typography>
                            </Box>
                            <IconButton size="small"><MoreHorizIcon /></IconButton>
                        </Box>

                        <Box sx={{ height: 350, width: '100%' }}>
                            <LineChart
                                grid={{ horizontal: true }}
                                xAxis={[{
                                    data: [1, 2, 3, 4, 5, 6, 7],
                                    scaleType: 'point',
                                    valueFormatter: (v) => `T${v + 1}`
                                }]}
                                series={[
                                    {
                                        data: trafficData,
                                        area: true,
                                        label: 'Lượt truy cập',
                                        color: theme.palette.primary.main,
                                        showMark: false,
                                        curve: "catmullRom",
                                    },
                                    {
                                        data: activeUsersData,
                                        area: true,
                                        label: 'Người dùng active',
                                        color: theme.palette.success.main,
                                        showMark: false,
                                        curve: "catmullRom",
                                    },
                                ]}
                                sx={{
                                    '.MuiLineElement-root': { strokeWidth: 3 },
                                    '.MuiAreaElement-root': { fillOpacity: 0.15 },
                                    // Hide ugly axis lines
                                    '.MuiChartsAxis-line': { stroke: 'none' },
                                    '.MuiChartsAxis-tick': { stroke: 'none' },
                                }}
                                margin={{ left: 30, right: 10, top: 10, bottom: 20 }}
                            />
                        </Box>
                    </Paper>
                </Grid>

                {/* Side Panels */}
                <Grid item xs={12} lg={4}>
                    <Stack spacing={3} sx={{ height: '100%' }}>
                        {/* Pie Chart */}
                        <Paper sx={{ p: 3, borderRadius: 4, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Tương tác cảm xúc</Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
                                <PieChart
                                    series={[
                                        {
                                            data: [
                                                { id: 0, value: 35, label: 'Like', color: '#1877f2' },
                                                { id: 1, value: 25, label: 'Love', color: '#f23e5c' },
                                                { id: 2, value: 15, label: 'Haha', color: '#f7b928' },
                                                { id: 3, value: 25, label: 'Khác', color: '#e4e6eb' },
                                            ],
                                            innerRadius: 60,
                                            outerRadius: 100,
                                            paddingAngle: 4,
                                            cornerRadius: 6,
                                            highlightScope: { faded: 'global', highlighted: 'item' },
                                            faded: { innerRadius: 30, additionalRadius: -30, color: 'gray' },
                                        },
                                    ]}
                                    height={220}
                                    margin={{ right: 0 }}
                                    slotProps={{ legend: { hidden: true } }}
                                />
                                <Box sx={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    textAlign: 'center'
                                }}>
                                    <Typography variant="h5" fontWeight="bold">89k</Typography>
                                    <Typography variant="caption" color="text.secondary">Total</Typography>
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3, flexWrap: 'wrap' }}>
                                <Chip size="small" label="Like" sx={{ bgcolor: '#1877f2', color: 'white', fontWeight: 600 }} />
                                <Chip size="small" label="Love" sx={{ bgcolor: '#f23e5c', color: 'white', fontWeight: 600 }} />
                                <Chip size="small" label="Haha" sx={{ bgcolor: '#f7b928', color: 'white', fontWeight: 600 }} />
                            </Box>
                        </Paper>

                        {/* Recent Comments */}
                        <Paper sx={{
                            p: 3,
                            borderRadius: 4,
                            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                            flexGrow: 1,
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6" fontWeight="bold">Bình luận mới</Typography>
                                <Chip label="Real-time" size="small" color="success" variant="soft" sx={{ bgcolor: '#ebfdf4', color: '#00875A', fontWeight: 600 }} />
                            </Box>

                            <List sx={{ p: 0, overflow: 'auto', maxHeight: 300 }}>
                                {mockComments.map((comment, index) => (
                                    <React.Fragment key={comment.id}>
                                        <ListItem alignItems="flex-start" sx={{ px: 0, py: 1.5 }}>
                                            <ListItemAvatar>
                                                <Avatar
                                                    alt={comment.user}
                                                    src={comment.avatar}
                                                    sx={{ width: 40, height: 40, border: '1px solid #eee' }}
                                                />
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Typography variant="subtitle2" fontWeight="700">
                                                            {comment.user}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                                            {comment.time}
                                                        </Typography>
                                                    </Box>
                                                }
                                                secondary={
                                                    <Typography
                                                        component="span"
                                                        variant="body2"
                                                        color="text.primary"
                                                        sx={{
                                                            display: '-webkit-box',
                                                            overflow: 'hidden',
                                                            WebkitBoxOrient: 'vertical',
                                                            WebkitLineClamp: 2,
                                                            mt: 0.5,
                                                            fontSize: '0.875rem'
                                                        }}
                                                    >
                                                        {comment.content}
                                                    </Typography>
                                                }
                                            />
                                        </ListItem>
                                        {index < mockComments.length - 1 && <Divider component="li" variant="inset" />}
                                    </React.Fragment>
                                ))}
                            </List>
                        </Paper>
                    </Stack>
                </Grid>
            </Grid>
        </Box>
    );
}
