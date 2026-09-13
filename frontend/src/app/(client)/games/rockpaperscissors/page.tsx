"use client";

import { useState } from "react";
import { Box, Typography, Button, Grid, Paper } from "@mui/material";
import { Checkroom, ContentCut, Public } from "@mui/icons-material";
import { motion } from "framer-motion";
import GameShell from "@/components/games/GameShell";
import { useTranslation } from "react-i18next";

const TRANG_BI = [
    { id: 'rock', icon: <Public sx={{ fontSize: 60 }} />, beats: 'scissors' },
    { id: 'paper', icon: <Checkroom sx={{ fontSize: 60 }} />, beats: 'rock' },
    { id: 'scissors', icon: <ContentCut sx={{ fontSize: 60 }} />, beats: 'paper' }
];

export default function RpsPage() {
    const { t } = useTranslation('games');
    const [userChoice, setUserChoice] = useState<string | null>(null);
    const [computerChoice, setComputerChoice] = useState<string | null>(null);
    const [result, setResult] = useState<'draw' | 'youWin' | 'computerWin' | null>(null);
    const [score, setScore] = useState({ user: 0, computer: 0 });

    const playGame = (choiceId: string) => {
        const computerRandom = TRANG_BI[Math.floor(Math.random() * TRANG_BI.length)].id;
        setUserChoice(choiceId);
        setComputerChoice(computerRandom);

        if (choiceId === computerRandom) {
            setResult('draw');
        } else if (TRANG_BI.find(t => t.id === choiceId)?.beats === computerRandom) {
            setResult('youWin');
            setScore(s => ({ ...s, user: s.user + 1 }));
        } else {
            setResult('computerWin');
            setScore(s => ({ ...s, computer: s.computer + 1 }));
        }
    };

    const resetGame = () => {
        setUserChoice(null);
        setComputerChoice(null);
        setResult(null);
    };

    return (
        <GameShell titleKey="rockpaperscissors.name" titleSx={{ mb: 4 }} maxWidth={600}>
            <Box sx={{ display: 'flex', justifyContent: 'space-around', mb: 4 }}>
                <Box>
                    <Typography variant="h6">{t('rockpaperscissors.you')}</Typography>
                    <Typography variant="h3" color="primary">{score.user}</Typography>
                </Box>
                <Box>
                    <Typography variant="h6">{t('rockpaperscissors.computer')}</Typography>
                    <Typography variant="h3" color="error">{score.computer}</Typography>
                </Box>
            </Box>

            {result ? (
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h3" fontWeight={800} sx={{
                        color: result === 'youWin' ? 'success.main' : (result === 'draw' ? 'warning.main' : 'error.main'),
                        mb: 3
                    }}>
                        {t(`rockpaperscissors.${result}`)}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, mb: 3 }}>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2">{t('rockpaperscissors.youChose')}</Typography>
                            <Box sx={{ p: 2, border: '2px solid #ccc', borderRadius: 2, mt: 1 }}>
                                {TRANG_BI.find(t => t.id === userChoice)?.icon}
                            </Box>
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2">{t('rockpaperscissors.computerChose')}</Typography>
                            <Box sx={{ p: 2, border: '2px solid #ccc', borderRadius: 2, mt: 1 }}>
                                {TRANG_BI.find(t => t.id === computerChoice)?.icon}
                            </Box>
                        </Box>
                    </Box>
                    <Button variant="contained" onClick={resetGame}>{t('rockpaperscissors.playMore')}</Button>
                </Box>
            ) : (
                <Grid container spacing={2} justifyContent="center">
                    {TRANG_BI.map((item) => (
                        <Grid size="auto" key={item.id}>
                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                <Paper
                                    onClick={() => playGame(item.id)}
                                    sx={{
                                        p: 3,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 1,
                                        minWidth: 100
                                    }}
                                >
                                    {item.icon}
                                    <Typography fontWeight={600}>{t(`rockpaperscissors.${item.id}`)}</Typography>
                                </Paper>
                            </motion.div>
                        </Grid>
                    ))}
                </Grid>
            )}
        </GameShell>
    );
}
