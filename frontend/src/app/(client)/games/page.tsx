"use client";

import { Box, Container, Grid, Card, CardContent, Typography, CardActionArea, IconButton, useTheme } from '@mui/material';
import {
    Gamepad as GamepadIcon,
    Casino as CasinoIcon,
    Grid3x3 as TicTacToeIcon,
    Timeline as SnakeIcon,
    GridView as GridIcon,
    Flag as FlagIcon,
    ContentCut as ScissorsIcon,
    Pets as PetsIcon,
    SportsTennis as TennisIcon,
    Keyboard as KeyboardIcon,
    ViewComfy as BreakoutIcon
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

const games = [
    {
        id: 'tictactoe',
        title: 'Tic Tac Toe',
        description: 'Trò chơi Caro kinh điển. Thách đấu với máy hoặc bạn bè.',
        icon: <TicTacToeIcon sx={{ fontSize: 60, color: '#1877f2' }} />,
        color: '#e3f2fd',
        path: '/games/tictactoe'
    },
    {
        id: 'snake',
        title: 'Rắn Săn Mồi',
        description: 'Điều khiển chú rắn ăn mồi và tránh va chạm.',
        icon: <SnakeIcon sx={{ fontSize: 60, color: '#42b72a' }} />,
        color: '#e8f5e9',
        path: '/games/snake'
    },
    {
        id: 'memory',
        title: 'Lật Hình',
        description: 'Rèn luyện trí nhớ với trò chơi lật hình.',
        icon: <CasinoIcon sx={{ fontSize: 60, color: '#ff9800' }} />,
        color: '#fff3e0',
        path: '/games/memory'
    },
    {
        id: '2048',
        title: '2048',
        description: 'Ghép các ô số để đạt được số 2048.',
        icon: <GridIcon sx={{ fontSize: 60, color: '#edc22e' }} />,
        color: '#fdf3e0',
        path: '/games/2048'
    },
    {
        id: 'minesweeper',
        title: 'Dò Mìn',
        description: 'Tìm kiếm mìn mà không bị nổ.',
        icon: <FlagIcon sx={{ fontSize: 60, color: '#ef5350' }} />,
        color: '#ffebee',
        path: '/games/minesweeper'
    },
    {
        id: 'rps',
        title: 'Oẳn Tù Tì',
        description: 'Kéo búa bao - Trò chơi dân gian.',
        icon: <ScissorsIcon sx={{ fontSize: 60, color: '#9c27b0' }} />,
        color: '#f3e5f5',
        path: '/games/rockpaperscissors'
    },
    {
        id: 'whackamole',
        title: 'Đập Chuột',
        description: 'Thử thách phản xạ cực nhanh.',
        icon: <PetsIcon sx={{ fontSize: 60, color: '#795548' }} />,
        color: '#efebe9',
        path: '/games/whackamole'
    },
    {
        id: 'pong',
        title: 'Ping Pong',
        description: 'Bóng bàn cổ điển với máy.',
        icon: <TennisIcon sx={{ fontSize: 60, color: '#29b6f6' }} />,
        color: '#e1f5fe',
        path: '/games/pong'
    },
    {
        id: 'typing',
        title: 'Gõ Phím Nhanh',
        description: 'Kiểm tra tốc độ gõ phím của bạn.',
        icon: <KeyboardIcon sx={{ fontSize: 60, color: '#607d8b' }} />,
        color: '#eceff1',
        path: '/games/typingspeed'
    },
    {
        id: 'breakout',
        title: 'Phá Gạch',
        description: 'Phá vỡ các viên gạch bằng bóng.',
        icon: <BreakoutIcon sx={{ fontSize: 60, color: '#ab47bc' }} />,
        color: '#fce4ec',
        path: '/games/breakout'
    }
];

export default function GameHubPage() {
    const theme = useTheme();
    const router = useRouter();
    const isDark = theme.palette.mode === 'dark';

    return (
        <Box sx={{ pb: 4, pt: 2 }}>
            <Container maxWidth="lg">
                <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <GamepadIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                    <Typography variant="h4" fontWeight={800} sx={{
                        background: 'linear-gradient(45deg, #1877f2, #9c27b0)',
                        backgroundClip: 'text',
                        textFillColor: 'transparent'
                    }}>
                        Game Center
                    </Typography>
                </Box>
                <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, color: 'text.primary' }}>
                    Trò chơi nổi bật
                </Typography>

                <Grid container spacing={3}>
                    {games.map((game, index) => (
                        // @ts-ignore
                        <Grid item xs={12} sm={6} md={4} key={game.id}>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                whileHover={{ y: -5 }}
                            >
                                <Card sx={{
                                    height: '100%',
                                    borderRadius: 4,
                                    overflow: 'visible',
                                    boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 24px rgba(0,0,0,0.05)',
                                    bgcolor: isDark ? 'background.paper' : game.color,
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}>
                                    <CardActionArea
                                        onClick={() => router.push(game.path)}
                                        sx={{ height: '100%', p: 3 }}
                                    >
                                        <Box sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            textAlign: 'center',
                                            gap: 2
                                        }}>
                                            <Box sx={{
                                                p: 3,
                                                borderRadius: '50%',
                                                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'white',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                            }}>
                                                {game.icon}
                                            </Box>
                                            <Typography variant="h5" fontWeight={700} color="text.primary">
                                                {game.title}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {game.description}
                                            </Typography>
                                        </Box>
                                    </CardActionArea>
                                </Card>
                            </motion.div>
                        </Grid>
                    ))}
                </Grid>
            </Container>
        </Box>
    );
}
