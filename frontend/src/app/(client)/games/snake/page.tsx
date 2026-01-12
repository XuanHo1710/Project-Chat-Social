"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Box, Typography, Button, Paper, useTheme } from "@mui/material";
import { PlayArrow, Refresh } from "@mui/icons-material";
import { useRouter } from "next/navigation";

// Constants
const CANVAS_SIZE = 400;
const GRID_SIZE = 20;
const SPEED = 100;

export default function SnakePage() {
    const theme = useTheme();
    const router = useRouter();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [snake, setSnake] = useState([{ x: 10, y: 10 }]);
    const [food, setFood] = useState({ x: 15, y: 15 });
    const [dir, setDir] = useState({ x: 0, y: 0 });
    const [score, setScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    const generateFood = useCallback(() => {
        return {
            x: Math.floor(Math.random() * (CANVAS_SIZE / GRID_SIZE)),
            y: Math.floor(Math.random() * (CANVAS_SIZE / GRID_SIZE)),
        };
    }, []);

    const resetGame = () => {
        setSnake([{ x: 10, y: 10 }]);
        setFood(generateFood());
        setDir({ x: 0, y: 0 }); // Start idle
        setScore(0);
        setGameOver(false);
        setIsPlaying(true);
    };

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        switch (e.key) {
            case "ArrowUp": if (dir.y !== 1) setDir({ x: 0, y: -1 }); break;
            case "ArrowDown": if (dir.y !== -1) setDir({ x: 0, y: 1 }); break;
            case "ArrowLeft": if (dir.x !== 1) setDir({ x: -1, y: 0 }); break;
            case "ArrowRight": if (dir.x !== -1) setDir({ x: 1, y: 0 }); break;
        }
    }, [dir]);

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    useEffect(() => {
        if (!isPlaying || gameOver) return;

        // Don't move if direction is 0,0 (start of game)
        if (dir.x === 0 && dir.y === 0) return;

        const moveSnake = setInterval(() => {
            setSnake((prev) => {
                const newHead = { x: prev[0].x + dir.x, y: prev[0].y + dir.y };

                // Wall collision
                if (
                    newHead.x < 0 ||
                    newHead.x >= CANVAS_SIZE / GRID_SIZE ||
                    newHead.y < 0 ||
                    newHead.y >= CANVAS_SIZE / GRID_SIZE ||
                    prev.some(seg => seg.x === newHead.x && seg.y === newHead.y)
                ) {
                    setGameOver(true);
                    setIsPlaying(false);
                    return prev;
                }

                const newSnake = [newHead, ...prev];

                // Eat food
                if (newHead.x === food.x && newHead.y === food.y) {
                    setScore(s => s + 1);
                    setFood(generateFood());
                } else {
                    newSnake.pop();
                }

                return newSnake;
            });
        }, SPEED);

        return () => clearInterval(moveSnake);
    }, [dir, food, gameOver, isPlaying, generateFood]);

    // Draw Canvas
    useEffect(() => {
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;

        // Clear
        ctx.fillStyle = theme.palette.mode === 'dark' ? '#1e1e1e' : '#f0f2f5';
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // Draw Food
        ctx.fillStyle = "#ff4081";
        ctx.beginPath();
        ctx.arc(
            food.x * GRID_SIZE + GRID_SIZE / 2,
            food.y * GRID_SIZE + GRID_SIZE / 2,
            GRID_SIZE / 2 - 2, 0, 2 * Math.PI
        );
        ctx.fill();

        // Draw Snake
        ctx.fillStyle = "#42b72a";
        snake.forEach((seg, i) => {
            const isHead = i === 0;
            ctx.fillStyle = isHead ? "#2e7d32" : "#42b72a";
            ctx.fillRect(seg.x * GRID_SIZE, seg.y * GRID_SIZE, GRID_SIZE - 2, GRID_SIZE - 2);
        });

    }, [snake, food, theme.palette.mode]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', pt: 4 }}>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
                <Paper elevation={3} sx={{ p: 4, borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', bgcolor: 'background.paper' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 2 }}>
                        <Typography variant="h5" fontWeight={800} color="primary">Score: {score}</Typography>
                    </Box>

                    <Box sx={{ border: `4px solid ${theme.palette.divider}`, borderRadius: 2, overflow: 'hidden', lineHeight: 0 }}>
                        <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} />
                    </Box>

                    <Typography variant="caption" color="text.secondary" sx={{ mt: 2, mb: 3 }}>
                        Sử dụng các phím mũi tên để di chuyển
                    </Typography>

                    {gameOver ? (
                        <Button
                            variant="contained"
                            size="large"
                            color="error"
                            onClick={resetGame}
                            startIcon={<Refresh />}
                            sx={{ borderRadius: 8, px: 4, py: 1.5, fontWeight: 700 }}
                        >
                            Game Over - Chơi lại
                        </Button>
                    ) : (
                        !isPlaying && (
                            <Button
                                variant="contained"
                                size="large"
                                onClick={resetGame}
                                startIcon={<PlayArrow />}
                                sx={{ borderRadius: 8, px: 4, py: 1.5, fontWeight: 700 }}
                            >
                                Bắt đầu
                            </Button>
                        )
                    )}
                </Paper>
            </Box>
        </Box>
    );
}
