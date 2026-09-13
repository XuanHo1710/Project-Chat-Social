"use client";

import { useState, useEffect, useRef } from "react";
import { Box, Typography, Button, TextField, LinearProgress } from "@mui/material";
import { PlayArrow, Refresh } from "@mui/icons-material";
import GameShell from "@/components/games/GameShell";
import { useTranslation } from "react-i18next";

const WORDS = [
    "react", "nextjs", "javascript", "typescript", "frontend", "backend", "fullstack",
    "social", "network", "chat", "message", "friend", "group", "video", "call",
    "component", "interface", "hook", "state", "effect", "context", "reducer",
    "optimization", "performance", "render", "dom", "browser", "server", "api",
    "deployment", "vercel", "cloud", "database", "mongodb", "firebase", "auth",
    "login", "register", "profile", "settings", "search", "notification", "realtime",
    "socket", "websocket", "http", "https", "rest", "graphql", "query", "mutation"
];

const GAME_TIME = 60;

export default function TypingSpeedPage() {
    const { t } = useTranslation('games');
    const [currentWord, setCurrentWord] = useState("");
    const [input, setInput] = useState("");
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(GAME_TIME);
    const [isPlaying, setIsPlaying] = useState(false);
    const [wpm, setWpm] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isPlaying && timeLeft > 0) {
            const timer = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
            return () => clearInterval(timer);
        } else if (timeLeft === 0) {
            endGame();
        }
    }, [isPlaying, timeLeft]);

    const startGame = () => {
        setScore(0);
        setTimeLeft(GAME_TIME);
        setIsPlaying(true);
        setWpm(0);
        setInput("");
        nextWord();
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const endGame = () => {
        setIsPlaying(false);
        const calculateWpm = Math.round((score / 5) / (GAME_TIME / 60)); // Standard WPM calculation
        setWpm(calculateWpm);
    };

    const nextWord = () => {
        const random = WORDS[Math.floor(Math.random() * WORDS.length)];
        setCurrentWord(random);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (!isPlaying) return;

        setInput(val);

        if (val === currentWord) {
            setScore(prev => prev + currentWord.length);
            setInput("");
            nextWord();
        }
    };

    return (
        <GameShell
            titleKey="typingspeed.name"
            titleSx={{ mb: 4 }}
            scoreLabelKey="typingspeed.scoreLabel"
            score={score}
            scoreRowSx={{ mb: 2, px: 2 }}
            scoreAside={
                <Box>
                    <Typography variant="caption" color="text.secondary">{t('common.time')}</Typography>
                    <Typography variant="h4" fontWeight={700} color={timeLeft < 10 ? 'error' : 'inherit'}>{timeLeft}s</Typography>
                </Box>
            }
            maxWidth={600}
        >
            <LinearProgress
                variant="determinate"
                value={(timeLeft / GAME_TIME) * 100}
                sx={{ mb: 4, height: 8, borderRadius: 4 }}
            />

            {isPlaying ? (
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h2" fontWeight={800} sx={{ mb: 2, color: 'text.primary', letterSpacing: 2 }}>
                        {currentWord}
                    </Typography>
                    <TextField
                        ref={inputRef}
                        value={input}
                        onChange={handleChange}
                        placeholder={t('typingspeed.placeholder')}
                        variant="outlined"
                        fullWidth
                        autoFocus
                        inputProps={{
                            style: { textAlign: 'center', fontSize: '1.5rem', fontWeight: 600 }
                        }}
                        sx={{ maxWidth: 400 }}
                    />
                </Box>
            ) : (
                <Box sx={{ mb: 4 }}>
                    {timeLeft === 0 && (
                        <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                            <Typography variant="h6">{t('typingspeed.results')}</Typography>
                            <Typography variant="h3" color="primary" fontWeight={800}>{Math.round(score / 5)} WPM</Typography>
                            <Typography variant="body2" color="text.secondary">{t('typingspeed.avgSpeed')}</Typography>
                        </Box>
                    )}
                    <Button
                        variant="contained"
                        size="large"
                        onClick={startGame}
                        startIcon={timeLeft === 0 ? <Refresh /> : <PlayArrow />}
                        sx={{ borderRadius: 8, px: 4, py: 1.5, fontWeight: 700 }}
                    >
                        {timeLeft === 0 ? t('typingspeed.retry') : t('common.start')}
                    </Button>
                </Box>
            )}

            <Typography color="text.secondary" variant="body2">
                {t('typingspeed.instructions')}
            </Typography>
        </GameShell>
    );
}
