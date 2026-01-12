"use client";

import { useState } from "react";
import { Box, Typography, Button, Paper, Grid } from "@mui/material";
import { Checkroom, ContentCut, Public } from "@mui/icons-material";
import { motion } from "framer-motion";

const TRANG_BI = [
    { id: 'rock', label: 'Búa', icon: <Public sx={{ fontSize: 60 }} />, beats: 'scissors' },
    { id: 'paper', label: 'Bao', icon: <Checkroom sx={{ fontSize: 60 }} />, beats: 'rock' },
    { id: 'scissors', label: 'Kéo', icon: <ContentCut sx={{ fontSize: 60 }} />, beats: 'paper' }
];

export default function RpsPage() {
    const [userChoice, setUserChoice] = useState<string | null>(null);
    const [computerChoice, setComputerChoice] = useState<string | null>(null);
    const [result, setResult] = useState<string | null>(null);
    const [score, setScore] = useState({ user: 0, computer: 0 });

    const playGame = (choiceId: string) => {
        const computerRandom = TRANG_BI[Math.floor(Math.random() * TRANG_BI.length)].id;
        setUserChoice(choiceId);
        setComputerChoice(computerRandom);

        if (choiceId === computerRandom) {
            setResult("Hòa!");
        } else if (TRANG_BI.find(t => t.id === choiceId)?.beats === computerRandom) {
            setResult("Bạn Thắng!");
            setScore(s => ({ ...s, user: s.user + 1 }));
        } else {
            setResult("Máy Thắng!");
            setScore(s => ({ ...s, computer: s.computer + 1 }));
        }
    };

    const resetGame = () => {
        setUserChoice(null);
        setComputerChoice(null);
        setResult(null);
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', pt: 4 }}>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
                <Paper elevation={3} sx={{ p: 4, borderRadius: 4, maxWidth: 600, width: '100%', textAlign: 'center', bgcolor: 'background.paper' }}>
                    <Typography variant="h4" fontWeight={900} sx={{ mb: 4, color: 'primary.main' }}>
                        Oẳn Tù Tì
                    </Typography>

                    <Box sx={{ display: 'flex', justifyContent: 'space-around', mb: 4 }}>
                        <Box>
                            <Typography variant="h6">Bạn</Typography>
                            <Typography variant="h3" color="primary">{score.user}</Typography>
                        </Box>
                        <Box>
                            <Typography variant="h6">Máy</Typography>
                            <Typography variant="h3" color="error">{score.computer}</Typography>
                        </Box>
                    </Box>

                    {result ? (
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h3" fontWeight={800} sx={{
                                color: result.includes("Bạn") ? 'success.main' : (result.includes("Hòa") ? 'warning.main' : 'error.main'),
                                mb: 3
                            }}>
                                {result}
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, mb: 3 }}>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="body2">Bạn chọn</Typography>
                                    <Box sx={{ p: 2, border: '2px solid #ccc', borderRadius: 2, mt: 1 }}>
                                        {TRANG_BI.find(t => t.id === userChoice)?.icon}
                                    </Box>
                                </Box>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="body2">Máy chọn</Typography>
                                    <Box sx={{ p: 2, border: '2px solid #ccc', borderRadius: 2, mt: 1 }}>
                                        {TRANG_BI.find(t => t.id === computerChoice)?.icon}
                                    </Box>
                                </Box>
                            </Box>
                            <Button variant="contained" onClick={resetGame}>Chơi tiếp</Button>
                        </Box>
                    ) : (
                        <Grid container spacing={2} justifyContent="center">
                            {TRANG_BI.map((item) => (
                                // @ts-ignore
                                <Grid item key={item.id}>
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
                                            <Typography fontWeight={600}>{item.label}</Typography>
                                        </Paper>
                                    </motion.div>
                                </Grid>
                            ))}
                        </Grid>
                    )}
                </Paper>
            </Box>
        </Box>
    );
}
