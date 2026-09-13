"use client";

import { useState, useEffect, useRef } from "react";
import { Box, Typography, Button, Grid, Paper } from "@mui/material";
import { Pets } from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import GameShell from "@/components/games/GameShell";
import { useTranslation } from "react-i18next";

const HOLES = 9;
const GAME_DURATION = 30;

export default function WhackAMolePage() {
    const { t } = useTranslation('games');
    const [moles, setMoles] = useState<boolean[]>(Array(HOLES).fill(false));
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
    const [isPlaying, setIsPlaying] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const moleTimerRef = useRef<NodeJS.Timeout | null>(null);

    const startGame = () => {
        setScore(0);
        setTimeLeft(GAME_DURATION);
        setIsPlaying(true);
        setMoles(Array(HOLES).fill(false));

        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    endGame();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        moleLoop();
    };

    const moleLoop = () => {
        if (!isPlaying && timeLeft <= 0) return;

        const randomHole = Math.floor(Math.random() * HOLES);
        const duration = Math.random() * 800 + 400; // 400-1200ms

        setMoles(prev => {
            const newMoles = [...prev];
            newMoles[randomHole] = true;
            return newMoles;
        });

        setTimeout(() => {
            setMoles(prev => {
                const newMoles = [...prev];
                newMoles[randomHole] = false;
                return newMoles;
            });
            if (timeLeft > 0) {
                moleTimerRef.current = setTimeout(moleLoop, Math.random() * 500 + 200);
            }
        }, duration);
    };

    const endGame = () => {
        setIsPlaying(false);
        if (timerRef.current) clearInterval(timerRef.current);
        if (moleTimerRef.current) clearTimeout(moleTimerRef.current);
        setMoles(Array(HOLES).fill(false));
    };

    const whack = (index: number) => {
        if (!moles[index] || !isPlaying) return;

        setScore(s => s + 1);
        setMoles(prev => {
            const newMoles = [...prev];
            newMoles[index] = false;
            return newMoles;
        });
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (moleTimerRef.current) clearTimeout(moleTimerRef.current);
        };
    }, []);

    return (
        <GameShell
            titleKey="whackamole.name"
            titleSx={{ color: '#795548', mb: 4 }}
            scoreLabelKey="whackamole.scoreLabel"
            score={score}
            scoreValueColor="primary"
            scoreRowSx={{ mb: 4, px: 4 }}
            scoreAside={
                <Box>
                    <Typography variant="caption" color="text.secondary">{t('common.time')}</Typography>
                    <Typography variant="h4" fontWeight={700} color={timeLeft < 10 ? "error" : "text.primary"}>{timeLeft}s</Typography>
                </Box>
            }
            maxWidth={500}
            actions={
                !isPlaying && (
                    <Button
                        variant="contained"
                        size="large"
                        onClick={startGame}
                        sx={{ borderRadius: 8, px: 4, py: 1.5, fontWeight: 700 }}
                    >
                        {timeLeft === 0 ? t('common.playAgain') : t('common.start')}
                    </Button>
                )
            }
        >
            <Grid container spacing={2} sx={{ maxWidth: 400, mx: 'auto', mb: 4 }}>
                {moles.map((isMole, i) => (
                    <Grid size={4} key={i}>
                        <Paper
                            elevation={0}
                            sx={{
                                aspectRatio: '1/1',
                                bgcolor: '#a1887f',
                                borderRadius: '50%',
                                position: 'relative',
                                overflow: 'hidden',
                                border: '4px solid #5d4037'
                            }}
                            onClick={() => whack(i)}
                        >
                            <AnimatePresence>
                                {isMole && (
                                    <motion.div
                                        initial={{ y: 100 }}
                                        animate={{ y: 0 }}
                                        exit={{ y: 100 }}
                                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                        style={{
                                            position: 'absolute',
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Pets sx={{ fontSize: 60, color: '#3e2723' }} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </Paper>
                    </Grid>
                ))}
            </Grid>
        </GameShell>
    );
}
