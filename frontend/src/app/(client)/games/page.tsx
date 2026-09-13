"use client";

import { Box, Container, Grid, Card, Typography, CardActionArea, useTheme } from '@mui/material';
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
import { useTranslation } from 'react-i18next';

const games = [
    {
        id: 'tictactoe',
        icon: <TicTacToeIcon sx={{ fontSize: 60, color: '#1877f2' }} />,
        color: '#e3f2fd',
        path: '/games/tictactoe'
    },
    {
        id: 'snake',
        icon: <SnakeIcon sx={{ fontSize: 60, color: '#42b72a' }} />,
        color: '#e8f5e9',
        path: '/games/snake'
    },
    {
        id: 'memory',
        icon: <CasinoIcon sx={{ fontSize: 60, color: '#ff9800' }} />,
        color: '#fff3e0',
        path: '/games/memory'
    },
    {
        id: '2048',
        icon: <GridIcon sx={{ fontSize: 60, color: '#edc22e' }} />,
        color: '#fdf3e0',
        path: '/games/2048'
    },
    {
        id: 'minesweeper',
        icon: <FlagIcon sx={{ fontSize: 60, color: '#ef5350' }} />,
        color: '#ffebee',
        path: '/games/minesweeper'
    },
    {
        id: 'rockpaperscissors',
        icon: <ScissorsIcon sx={{ fontSize: 60, color: '#9c27b0' }} />,
        color: '#f3e5f5',
        path: '/games/rockpaperscissors'
    },
    {
        id: 'whackamole',
        icon: <PetsIcon sx={{ fontSize: 60, color: '#795548' }} />,
        color: '#efebe9',
        path: '/games/whackamole'
    },
    {
        id: 'pong',
        icon: <TennisIcon sx={{ fontSize: 60, color: '#29b6f6' }} />,
        color: '#e1f5fe',
        path: '/games/pong'
    },
    {
        id: 'typingspeed',
        icon: <KeyboardIcon sx={{ fontSize: 60, color: '#607d8b' }} />,
        color: '#eceff1',
        path: '/games/typingspeed'
    },
    {
        id: 'breakout',
        icon: <BreakoutIcon sx={{ fontSize: 60, color: '#ab47bc' }} />,
        color: '#fce4ec',
        path: '/games/breakout'
    }
];

export default function GameHubPage() {
    const theme = useTheme();
    const router = useRouter();
    const { t } = useTranslation('games');
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
                        {t('hub.title')}
                    </Typography>
                </Box>
                <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, color: 'text.primary' }}>
                    {t('hub.featured')}
                </Typography>

                <Grid container spacing={{ xs: 2, md: 3 }}>
                    {games.map((game, index) => (
                        <Grid size={{ xs: 6, sm: 4, md: 3 }} key={game.id}>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                whileHover={{ y: -5 }}
                                style={{ height: '100%' }}
                            >
                                <Card sx={{
                                    height: '100%',
                                    borderRadius: { xs: 3, md: 4 },
                                    overflow: 'visible',
                                    boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 24px rgba(0,0,0,0.05)',
                                    bgcolor: isDark ? 'background.paper' : game.color,
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}>
                                    <CardActionArea
                                        onClick={() => router.push(game.path)}
                                        sx={{ height: '100%', p: { xs: 2, md: 3 } }}
                                    >
                                        <Box sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            textAlign: 'center',
                                            gap: { xs: 1, md: 2 }
                                        }}>
                                            <Box sx={{
                                                p: { xs: 2, md: 3 },
                                                borderRadius: '50%',
                                                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'white',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                {/* Scale icon for mobile */}
                                                <Box sx={{
                                                    transform: { xs: 'scale(0.8)', md: 'scale(1)' },
                                                    display: 'flex'
                                                }}>
                                                    {game.icon}
                                                </Box>
                                            </Box>
                                            <Typography
                                                sx={{
                                                    fontWeight: 700,
                                                    color: 'text.primary',
                                                    fontSize: { xs: '1rem', md: '1.25rem' }
                                                }}
                                            >
                                                {t(`${game.id}.name`)}
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{
                                                    fontSize: { xs: '0.75rem', md: '0.875rem' },
                                                    display: { xs: '-webkit-box', md: 'block' },
                                                    WebkitLineClamp: { xs: 2, md: 'none' },
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden'
                                                }}
                                            >
                                                {t(`${game.id}.description`)}
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
