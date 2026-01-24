'use client';

import React from 'react';
import {
    Paper,
    Typography,
    Box,
    Card,
    CardContent,
    Avatar,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Divider,
    Chip,
    useTheme,
    IconButton,
    LinearProgress,
    alpha
} from '@mui/material';
import {
    PeopleAlt as PeopleIcon,
    Article as ArticleIcon,
    Visibility as VisibilityIcon,
    TrendingUp as TrendingUpIcon,
    MoreHoriz as MoreHorizIcon,
    ArrowUpward as ArrowUpwardIcon,
    ArrowDownward as ArrowDownwardIcon,
} from '@mui/icons-material';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { useAuthStore } from '@/stores/useAuthStore';

// --- Components ---

const StatCard = ({ title, value, icon, color, trend, trendValue, subtitle }: any) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const isPositive = trendValue >= 0;

    return (
        <Card sx={{
            height: '100%',
            borderRadius: 3,
            bgcolor: isDark ? '#242526' : '#ffffff',
            border: `1px solid ${isDark ? '#3a3b3c' : '#e4e6eb'}`,
            boxShadow: 'none',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: isDark
                    ? `0 20px 40px ${alpha(color, 0.2)}`
                    : `0 20px 40px ${alpha(color, 0.15)}`,
                borderColor: alpha(color, 0.5)
            }
        }}>
            <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                    <Box sx={{
                        p: 1.5,
                        borderRadius: 2.5,
                        background: `linear-gradient(135deg, ${color} 0%, ${alpha(color, 0.7)} 100%)`,
                        color: '#fff',
                        display: 'flex',
                        boxShadow: `0 8px 16px ${alpha(color, 0.3)}`
                    }}>
                        {icon}
                    </Box>
                    {trend && (
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 2,
                            bgcolor: isPositive
                                ? (isDark ? 'rgba(49, 162, 76, 0.15)' : 'rgba(49, 162, 76, 0.1)')
                                : (isDark ? 'rgba(250, 56, 62, 0.15)' : 'rgba(250, 56, 62, 0.1)'),
                        }}>
                            {isPositive
                                ? <ArrowUpwardIcon sx={{ fontSize: 16, color: '#31a24c' }} />
                                : <ArrowDownwardIcon sx={{ fontSize: 16, color: '#fa383e' }} />
                            }
                            <Typography
                                variant="caption"
                                sx={{
                                    fontWeight: 700,
                                    color: isPositive ? '#31a24c' : '#fa383e'
                                }}
                            >
                                {Math.abs(trendValue)}%
                            </Typography>
                        </Box>
                    )}
                </Box>
                <Typography
                    variant="h3"
                    fontWeight="800"
                    sx={{
                        mb: 0.5,
                        color: 'text.primary',
                        letterSpacing: '-0.02em'
                    }}
                >
                    {value}
                </Typography>
                <Typography variant="body2" color="text.secondary" fontWeight="500">
                    {title}
                </Typography>
                {subtitle && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        {subtitle}
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
};

// --- Mock Data ---

const stats = [
    { label: 'Tổng người dùng', value: '1,234', icon: <PeopleIcon fontSize="medium" />, color: '#1877f2', trend: true, trendValue: 12, subtitle: 'So với tháng trước' },
    { label: 'Bài viết mới', value: '567', icon: <ArticleIcon fontSize="medium" />, color: '#42b72a', trend: true, trendValue: 5, subtitle: 'Trong 7 ngày qua' },
    { label: 'Đang online', value: '42', icon: <VisibilityIcon fontSize="medium" />, color: '#f7b928', trend: false, trendValue: 0, subtitle: 'Người dùng hoạt động' },
    { label: 'Tổng tương tác', value: '89.2k', icon: <TrendingUpIcon fontSize="medium" />, color: '#fa383e', trend: true, trendValue: 24, subtitle: 'Like, comment, share' },
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
const weeklyPostsData = [45, 52, 38, 67, 82, 73, 91];

const topPages = [
    { name: 'Trang chủ', views: '45.2k', percentage: 85 },
    { name: 'Reels', views: '32.1k', percentage: 68 },
    { name: 'Tin nhắn', views: '28.4k', percentage: 55 },
    { name: 'Nhóm', views: '18.9k', percentage: 42 },
    { name: 'Thông báo', views: '12.3k', percentage: 28 },
];

export default function AdminDashboard() {
    const theme = useTheme();
    const { user } = useAuthStore();
    const isDark = theme.palette.mode === 'dark';

    const cardStyle = {
        p: 3,
        borderRadius: 3,
        bgcolor: isDark ? '#242526' : '#ffffff',
        border: `1px solid ${isDark ? '#3a3b3c' : '#e4e6eb'}`,
        boxShadow: 'none',
    };

    return (
        <Box>
            {/* Header Section */}
            <Box sx={{
                mb: 4,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 2
            }}>
                <Box>
                    <Typography
                        variant="h4"
                        fontWeight="800"
                        sx={{
                            letterSpacing: '-0.02em',
                            background: isDark
                                ? 'linear-gradient(135deg, #fff 0%, #b0b3b8 100%)'
                                : 'linear-gradient(135deg, #1c1e21 0%, #65676b 100%)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            mb: 1
                        }}
                    >
                        Dashboard
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Chào <strong>{user?.fullName || 'Admin'}</strong>, đây là tổng quan hệ thống hôm nay.
                    </Typography>
                </Box>
                <Chip
                    label={`Hôm nay: ${new Date().toLocaleDateString('vi-VN')}`}
                    sx={{
                        fontWeight: 600,
                        borderRadius: 2,
                        bgcolor: isDark ? '#3a3b3c' : '#e4e6eb',
                        color: 'text.primary',
                        px: 1
                    }}
                />
            </Box>

            {/* Stats Cards - Using Flexbox for equal width */}
            <Box sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 3,
                mb: 4
            }}>
                {stats.map((stat, index) => (
                    <Box
                        key={index}
                        sx={{
                            flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', lg: '1 1 calc(25% - 18px)' },
                            minWidth: { xs: '100%', sm: 'calc(50% - 12px)', lg: 'calc(25% - 18px)' },
                            maxWidth: { xs: '100%', sm: 'calc(50% - 12px)', lg: 'calc(25% - 18px)' }
                        }}
                    >
                        <StatCard
                            title={stat.label}
                            value={stat.value}
                            icon={stat.icon}
                            color={stat.color}
                            trend={stat.trend}
                            trendValue={stat.trendValue}
                            subtitle={stat.subtitle}
                        />
                    </Box>
                ))}
            </Box>

            {/* Charts Row 1 - Traffic Analytics (2/3) + Pie Chart (1/3) */}
            <Box sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 3,
                mb: 3
            }}>
                {/* Traffic Analytics Chart */}
                <Box sx={{
                    flex: { xs: '1 1 100%', lg: '1 1 calc(66.666% - 12px)' },
                    minWidth: { xs: '100%', lg: 'calc(66.666% - 12px)' }
                }}>
                    <Paper sx={{ ...cardStyle, height: '100%' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Box>
                                <Typography variant="h6" fontWeight="700" color="text.primary">
                                    Phân tích truy cập
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Dữ liệu 7 ngày gần nhất
                                </Typography>
                            </Box>
                            <IconButton size="small" sx={{ bgcolor: isDark ? '#3a3b3c' : '#f0f2f5' }}>
                                <MoreHorizIcon fontSize="small" />
                            </IconButton>
                        </Box>

                        <Box sx={{ height: 300, width: '100%' }}>
                            <LineChart
                                grid={{ horizontal: true }}
                                xAxis={[{
                                    data: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
                                    scaleType: 'point',
                                }]}
                                series={[
                                    {
                                        data: trafficData,
                                        area: true,
                                        label: 'Lượt truy cập',
                                        color: '#1877f2',
                                        showMark: false,
                                        curve: "catmullRom",
                                    },
                                    {
                                        data: activeUsersData,
                                        area: true,
                                        label: 'Người dùng active',
                                        color: '#42b72a',
                                        showMark: false,
                                        curve: "catmullRom",
                                    },
                                ]}
                                sx={{
                                    '.MuiLineElement-root': { strokeWidth: 3 },
                                    '.MuiAreaElement-root': { fillOpacity: 0.1 },
                                    '.MuiChartsAxis-line': { stroke: 'none' },
                                    '.MuiChartsAxis-tick': { stroke: 'none' },
                                    '.MuiChartsAxis-tickLabel': {
                                        fill: theme.palette.text.secondary,
                                    },
                                    '.MuiChartsLegend-series text': {
                                        fill: `${theme.palette.text.primary} !important`,
                                    },
                                }}
                                margin={{ left: 40, right: 20, top: 20, bottom: 30 }}
                            />
                        </Box>
                    </Paper>
                </Box>

                {/* Emotion Pie Chart */}
                <Box sx={{
                    flex: { xs: '1 1 100%', lg: '1 1 calc(33.333% - 12px)' },
                    minWidth: { xs: '100%', lg: 'calc(33.333% - 12px)' }
                }}>
                    <Paper sx={{ ...cardStyle, height: '100%' }}>
                        <Typography variant="h6" fontWeight="700" color="text.primary" sx={{ mb: 3 }}>
                            Tương tác cảm xúc
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'center', position: 'relative', mb: 3 }}>
                            <PieChart
                                series={[
                                    {
                                        data: [
                                            { id: 0, value: 35, label: 'Like', color: '#1877f2' },
                                            { id: 1, value: 25, label: 'Love', color: '#f23e5c' },
                                            { id: 2, value: 15, label: 'Haha', color: '#f7b928' },
                                            { id: 3, value: 25, label: 'Khác', color: isDark ? '#4e4f50' : '#e4e6eb' },
                                        ],
                                        innerRadius: 50,
                                        outerRadius: 85,
                                        paddingAngle: 3,
                                        cornerRadius: 5,
                                        highlightScope: { fade: 'global', highlight: 'item' },
                                    },
                                ]}
                                height={200}
                                margin={{ right: 0, left: 0 }}
                                hideLegend
                            />
                            <Box sx={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                textAlign: 'center'
                            }}>
                                <Typography variant="h4" fontWeight="800" color="text.primary">89k</Typography>
                                <Typography variant="caption" color="text.secondary">Tổng</Typography>
                            </Box>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Chip size="small" label="👍 Like 35%" sx={{ bgcolor: alpha('#1877f2', 0.15), color: '#1877f2', fontWeight: 600 }} />
                            <Chip size="small" label="❤️ Love 25%" sx={{ bgcolor: alpha('#f23e5c', 0.15), color: '#f23e5c', fontWeight: 600 }} />
                            <Chip size="small" label="😂 Haha 15%" sx={{ bgcolor: alpha('#f7b928', 0.15), color: '#b88b00', fontWeight: 600 }} />
                        </Box>
                    </Paper>
                </Box>
            </Box>

            {/* Charts Row 2 - Bar Chart (1/3) + Top Pages (1/3) + Comments (1/3) */}
            <Box sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 3
            }}>
                {/* Weekly Posts Bar Chart */}
                <Box sx={{
                    flex: { xs: '1 1 100%', md: '1 1 calc(33.333% - 16px)' },
                    minWidth: { xs: '100%', md: 'calc(33.333% - 16px)' }
                }}>
                    <Paper sx={{ ...cardStyle, height: '100%' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Typography variant="h6" fontWeight="700" color="text.primary">
                                Bài viết theo tuần
                            </Typography>
                            <Chip
                                size="small"
                                label="+15%"
                                sx={{
                                    bgcolor: isDark ? 'rgba(49, 162, 76, 0.15)' : 'rgba(49, 162, 76, 0.1)',
                                    color: '#31a24c',
                                    fontWeight: 600
                                }}
                            />
                        </Box>
                        <Box sx={{ height: 220, width: '100%', pt: 1 }}>
                            <BarChart
                                grid={{ horizontal: true }}
                                xAxis={[{
                                    data: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
                                    scaleType: 'band',
                                    tickLabelStyle: {
                                        fontSize: 12,
                                    }
                                }]}
                                yAxis={[{
                                    min: 0,
                                    max: 100,
                                    tickNumber: 3,
                                }]}
                                series={[{
                                    data: weeklyPostsData,
                                    color: '#1877f2',
                                }]}
                                sx={{
                                    '.MuiChartsAxis-line': { stroke: 'none' },
                                    '.MuiChartsAxis-tick': { stroke: 'none' },
                                    '.MuiChartsAxis-tickLabel': {
                                        fill: theme.palette.text.secondary,
                                        fontWeight: 500,
                                        fontSize: '12px',
                                    },
                                    '.MuiChartsGrid-line': {
                                        stroke: isDark ? '#3a3b3c' : '#e4e6eb',
                                        strokeDasharray: '4 4',
                                    },
                                    '.MuiBarElement-root': {
                                        rx: 4,
                                        ry: 4,
                                    },
                                }}
                                margin={{ left: 35, right: 10, top: 10, bottom: 25 }}
                                hideLegend
                            />
                        </Box>
                    </Paper>
                </Box>

                {/* Top Pages */}
                <Box sx={{
                    flex: { xs: '1 1 100%', md: '1 1 calc(33.333% - 16px)' },
                    minWidth: { xs: '100%', md: 'calc(33.333% - 16px)' }
                }}>
                    <Paper sx={{ ...cardStyle, height: '100%' }}>
                        <Typography variant="h6" fontWeight="700" color="text.primary" sx={{ mb: 3 }}>
                            Trang được truy cập nhiều
                        </Typography>
                        {topPages.map((page, index) => (
                            <Box key={index} sx={{ mb: 2.5, '&:last-child': { mb: 0 } }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography variant="body2" fontWeight="600">{page.name}</Typography>
                                    <Typography variant="body2" color="text.secondary">{page.views}</Typography>
                                </Box>
                                <LinearProgress
                                    variant="determinate"
                                    value={page.percentage}
                                    sx={{
                                        height: 6,
                                        borderRadius: 3,
                                        bgcolor: isDark ? '#3a3b3c' : '#e4e6eb',
                                        '& .MuiLinearProgress-bar': {
                                            borderRadius: 3,
                                            background: `linear-gradient(90deg, #1877f2 0%, #42b72a 100%)`,
                                        }
                                    }}
                                />
                            </Box>
                        ))}
                    </Paper>
                </Box>

                {/* Recent Comments */}
                <Box sx={{
                    flex: { xs: '1 1 100%', md: '1 1 calc(33.333% - 16px)' },
                    minWidth: { xs: '100%', md: 'calc(33.333% - 16px)' }
                }}>
                    <Paper sx={{ ...cardStyle, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6" fontWeight="700" color="text.primary">
                                Bình luận mới nhất
                            </Typography>
                            <Chip
                                label="🔴 Live"
                                size="small"
                                sx={{
                                    bgcolor: isDark ? 'rgba(250, 56, 62, 0.15)' : 'rgba(250, 56, 62, 0.1)',
                                    color: '#fa383e',
                                    fontWeight: 600,
                                }}
                            />
                        </Box>

                        <List sx={{ p: 0, overflow: 'auto', flexGrow: 1 }}>
                            {mockComments.map((comment, index) => (
                                <React.Fragment key={comment.id}>
                                    <ListItem
                                        alignItems="flex-start"
                                        sx={{
                                            px: 0,
                                            py: 1.5,
                                            '&:hover': {
                                                bgcolor: isDark ? '#3a3b3c' : '#f5f6f7',
                                                borderRadius: 2,
                                                mx: -1,
                                                px: 1
                                            }
                                        }}
                                    >
                                        <ListItemAvatar>
                                            <Avatar
                                                alt={comment.user}
                                                sx={{
                                                    width: 40,
                                                    height: 40,
                                                    bgcolor: `hsl(${index * 60}, 70%, 50%)`,
                                                    fontWeight: 600,
                                                    fontSize: 16
                                                }}
                                            >
                                                {comment.user.charAt(0)}
                                            </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Typography variant="subtitle2" fontWeight="700">
                                                        {comment.user}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {comment.time}
                                                    </Typography>
                                                </Box>
                                            }
                                            secondary={
                                                <Typography
                                                    component="span"
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{
                                                        display: '-webkit-box',
                                                        overflow: 'hidden',
                                                        WebkitBoxOrient: 'vertical',
                                                        WebkitLineClamp: 2,
                                                        mt: 0.5
                                                    }}
                                                >
                                                    {comment.content}
                                                </Typography>
                                            }
                                        />
                                    </ListItem>
                                    {index < mockComments.length - 1 && (
                                        <Divider sx={{ opacity: 0.5 }} />
                                    )}
                                </React.Fragment>
                            ))}
                        </List>
                    </Paper>
                </Box>
            </Box>
        </Box>
    );
}
