'use client';

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { adminService, RecentComment } from '@/services/admin.service';
import { useSocket } from '@/contexts/SocketContext';
import { useTranslation } from 'react-i18next';

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

export default function AdminDashboard() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { user } = useAuthStore();
    const { socketNotification } = useSocket();
    const [liveComments, setLiveComments] = useState<RecentComment[]>([]);
    const { t } = useTranslation();

    // Listen for new comments via socket
    useEffect(() => {
        if (!socketNotification) return;

        const handleNewComment = (comment: RecentComment) => {
            console.log('📝 New comment from admin socket:', comment);
            setLiveComments(prev => {
                // Add to beginning, keep max 10
                const updated = [comment, ...prev].slice(0, 10);
                return updated;
            });
        };

        socketNotification.on('admin:newComment', handleNewComment);

        return () => {
            socketNotification.off('admin:newComment', handleNewComment);
        };
    }, [socketNotification]);

    // API Queries
    const { data: dashboardStats } = useQuery({
        queryKey: ['admin', 'stats'],
        queryFn: () => adminService.getDashboardStats(),
    });

    const { data: weeklyPosts } = useQuery({
        queryKey: ['admin', 'weekly-posts'],
        queryFn: () => adminService.getWeeklyPostsStats(),
    });

    const { data: topPagesData } = useQuery({
        queryKey: ['admin', 'top-pages'],
        queryFn: () => adminService.getTopPagesStats(),
    });

    const { data: recentCommentsData } = useQuery({
        queryKey: ['admin', 'recent-comments'],
        queryFn: () => adminService.getRecentComments(),
    });

    const { data: emotionsData } = useQuery({
        queryKey: ['admin', 'emotions'],
        queryFn: () => adminService.getEmotionStats(),
    });

    const { data: trafficDataApi } = useQuery({
        queryKey: ['admin', 'traffic'],
        queryFn: () => adminService.getTrafficData(7),
    });

    // Format number to display
    const formatNumber = (num: number | undefined) => {
        if (!num) return '0';
        if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
        return num.toString();
    };

    // Traffic data from API or fallback
    const trafficData = trafficDataApi?.map(t => t.logins) || [];
    const activeUsersData = trafficDataApi?.map(t => t.activeUsers) || [];

    // Visit stats calculation
    const visitsToday = trafficDataApi?.[trafficDataApi.length - 1]?.logins || 0;
    const visitsYesterday = trafficDataApi?.[trafficDataApi.length - 2]?.logins || 0;
    const visitsChange = visitsYesterday > 0
        ? Math.round(((visitsToday - visitsYesterday) / visitsYesterday) * 100)
        : (visitsToday > 0 ? 100 : 0);

    const trafficLabels = trafficDataApi?.map(t => {
        const [y, m, d] = t.date.split('-'); // 1 số browser new Date() có thể lệch múi giờ, split safe hơn
        return `${d}/${m}`;
    }) || ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

    // Stats from API or fallback
    const stats = [
        {
            label: t('admin.total_users'),
            value: formatNumber(dashboardStats?.totalUsers),
            icon: <PeopleIcon fontSize="medium" />,
            color: '#1877f2',
            trend: true,
            trendValue: dashboardStats?.userChange || 0,
            subtitle: t('admin.new_today', { count: dashboardStats?.newUsersToday || 0 }) // Hacky but works for now or use t('admin.new_today')
        },
        {
            label: t('admin.total_posts'),
            value: formatNumber(dashboardStats?.totalPosts),
            icon: <ArticleIcon fontSize="medium" />,
            color: '#42b72a',
            trend: true,
            trendValue: 5,
            subtitle: t('admin.new_today', { count: dashboardStats?.newPostsToday || 0 })
        },
        {
            label: `${t('admin.visits')} ${t('time.today').toLowerCase()}`,
            value: formatNumber(visitsToday),
            icon: <TrendingUpIcon fontSize="medium" />,
            color: '#f7b928',
            trend: true,
            trendValue: visitsChange,
            subtitle: t('admin.traffic_analytics')
        },
        {
            label: t('admin.interactions'),
            value: formatNumber((dashboardStats?.totalComments || 0) + (dashboardStats?.totalReactions || 0)),
            icon: <TrendingUpIcon fontSize="medium" />,
            color: '#fa383e',
            trend: true,
            trendValue: 24,
            subtitle: 'Like, comment, share'
        },
    ];

    const weeklyPostsChartData = weeklyPosts?.map(w => w.count) || [];
    const topPages = topPagesData || [];

    // Merge live comments with API comments (live takes priority, avoid duplicates)
    const apiComments = recentCommentsData || [];
    const liveCommentIds = new Set(liveComments.map(c => c.id));
    const filteredApiComments = apiComments.filter(c => !liveCommentIds.has(c.id));
    const mockComments = [...liveComments, ...filteredApiComments].slice(0, 10);

    // Parse @[DisplayName:Username] mentions in comment content
    const renderCommentContent = (content: string) => {
        const mentionRegex = /@\[([^\]]+):([^\]]+)\]/g;
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match;

        while ((match = mentionRegex.exec(content)) !== null) {
            if (match.index > lastIndex) {
                parts.push(content.slice(lastIndex, match.index));
            }
            const displayName = match[1];
            parts.push(
                <Typography
                    key={match.index}
                    component="span"
                    sx={{ color: 'primary.main', fontWeight: 600 }}
                >
                    @{displayName}
                </Typography>
            );
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < content.length) {
            parts.push(content.slice(lastIndex));
        }

        return parts.length > 0 ? parts : content;
    };

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
                        {t('admin.dashboard')}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        {t('admin.welcome_admin', { name: user?.fullName || 'Admin' })}
                    </Typography>
                </Box>
                <Chip
                    label={t('admin.today', { date: new Date().toLocaleDateString('vi-VN') })}
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
                                    {t('admin.traffic_analytics')}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {t('admin.traffic_subtitle')}
                                </Typography>
                            </Box>
                            <IconButton size="small" sx={{ bgcolor: isDark ? '#3a3b3c' : '#f0f2f5' }}>
                                <MoreHorizIcon fontSize="small" />
                            </IconButton>
                        </Box>

                        <Box sx={{ height: { xs: 220, md: 300 }, width: '100%' }}>
                            <LineChart
                                grid={{ horizontal: true }}
                                xAxis={[{
                                    data: trafficLabels,
                                    scaleType: 'point',
                                }]}
                                series={[
                                    {
                                        data: trafficData,
                                        area: true,
                                        label: t('admin.visits'),
                                        color: '#1877f2',
                                        showMark: false,
                                        curve: "catmullRom",
                                    },
                                    {
                                        data: activeUsersData,
                                        area: true,
                                        label: t('admin.active_users'),
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
                            {t('admin.emotion_interaction')}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'center', position: 'relative', mb: 3 }}>
                            <PieChart
                                series={[
                                    {
                                        data: emotionsData?.length ? emotionsData.map((e, i) => ({
                                            id: i,
                                            value: e.count,
                                            label: e.label,
                                            color: e.color
                                        })) : [
                                            { id: 0, value: 1, label: 'No data', color: isDark ? '#4e4f50' : '#e4e6eb' }
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
                                <Typography variant="h4" fontWeight="800" color="text.primary">
                                    {emotionsData?.reduce((sum, e) => sum + e.count, 0)?.toLocaleString() || '0'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">{t('admin.total')}</Typography>
                            </Box>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                            {emotionsData?.slice(0, 3).map((e) => (
                                <Chip
                                    key={e.type}
                                    size="small"
                                    label={`${e.label} ${e.percentage}%`}
                                    sx={{ bgcolor: alpha(e.color, 0.15), color: e.color, fontWeight: 600 }}
                                />
                            ))}
                        </Box>
                    </Paper>
                </Box>
            </Box>

            {/* Charts Row 2 - Bar Chart (1/3) + Top Pages (1/3) + Comments (1/3) */}
            <Box sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
                gap: 3
            }}>
                {/* Weekly Posts Bar Chart */}
                <Box sx={{
                    flex: { xs: '1 1 100%', md: '1 1 calc(33.333% - 16px)' },
                    minWidth: { xs: '100%', md: 'calc(33.333% - 16px)' },
                    maxWidth: { xs: '100%', md: 'calc(33.333% - 16px)' }
                }}>
                    <Paper sx={{ ...cardStyle, height: '100%', maxWidth: 'max-content', minWidth: '100%' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Typography variant="h6" fontWeight="700" color="text.primary">
                                {t('admin.posts_weekly')}
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
                        <Box sx={{ height: { xs: 180, md: 200 }, width: '100%' }}>
                            <BarChart
                                grid={{ horizontal: true }}
                                xAxis={[{
                                    data: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
                                    scaleType: 'band',
                                    tickLabelStyle: {
                                        fontSize: 11,
                                    }
                                }]}
                                series={[{
                                    data: weeklyPostsChartData,
                                    color: '#1877f2',
                                }]}
                                sx={{
                                    '.MuiChartsAxis-line': { stroke: 'none' },
                                    '.MuiChartsAxis-tick': { stroke: 'none' },
                                    '.MuiChartsAxis-tickLabel': {
                                        fill: theme.palette.text.secondary,
                                        fontWeight: 500,
                                        fontSize: '11px',
                                    },
                                    '.MuiChartsGrid-line': {
                                        stroke: isDark ? '#3a3b3c' : '#e4e6eb',
                                        strokeOpacity: 0.5,
                                    },
                                    '.MuiBarElement-root': {
                                        rx: 4,
                                        ry: 4,
                                    },
                                }}
                                margin={{ left: 30, right: 10, top: 5, bottom: 20 }}
                                hideLegend
                            />
                        </Box>
                    </Paper>
                </Box>

                {/* Top Pages */}
                <Box sx={{
                    flex: { xs: '1 1 100%', md: '1 1 calc(33.333% - 16px)' },
                    minWidth: { xs: '100%', md: 'calc(33.333% - 16px)' },
                    maxHeight: "max-content"
                }}>
                    <Paper sx={{ ...cardStyle, height: '100%' }}>
                        <Typography variant="h6" fontWeight="700" color="text.primary" sx={{ mb: 3 }}>
                            {t('admin.top_pages')}
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
                    <Paper sx={{ ...cardStyle, height: { xs: '400px', md: '600px' }, display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6" fontWeight="700" color="text.primary">
                                {t('admin.recent_comments')}
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

                        <List sx={{ p: 0, overflow: 'auto', scrollbarWidth: 'thin', flexGrow: 1 }}>
                            {mockComments.map((comment, index) => (
                                <React.Fragment key={comment.id}>
                                    <ListItem
                                        alignItems="flex-start"
                                        sx={{
                                            px: 1,
                                            py: 1.5,
                                            mx: -1,
                                            borderRadius: 2,
                                            transition: 'background-color 0.2s ease',
                                            '&:hover': {
                                                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
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
                                                    {renderCommentContent(comment.content)}
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
