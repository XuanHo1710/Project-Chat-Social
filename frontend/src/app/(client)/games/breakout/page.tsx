"use client";

import { useState, useEffect, useRef } from "react";
import { Box, Typography, Button, Paper, useTheme } from "@mui/material";
import { PlayArrow, Refresh } from "@mui/icons-material";

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const PADDLE_WIDTH = 100;
const PADDLE_HEIGHT = 15;
const BALL_RADIUS = 8;
const BRICK_ROW_COUNT = 5;
const BRICK_COLUMN_COUNT = 8;
const BRICK_WIDTH = 65;
const BRICK_HEIGHT = 20;
const BRICK_PADDING = 10;
const BRICK_OFFSET_TOP = 30;
const BRICK_OFFSET_LEFT = 10; // Centered roughly

export default function BreakoutPage() {
    const theme = useTheme();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [score, setScore] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [gameOver, setGameOver] = useState(false);

    // Game State
    const state = useRef({
        paddleX: (CANVAS_WIDTH - PADDLE_WIDTH) / 2,
        ball: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 30, dx: 4, dy: -4 },
        bricks: [] as { x: number, y: number, status: number }[]
    });

    useEffect(() => {
        initBricks();
    }, []);

    const initBricks = () => {
        const newBricks = [];
        for (let c = 0; c < BRICK_COLUMN_COUNT; c++) {
            for (let r = 0; r < BRICK_ROW_COUNT; r++) {
                newBricks.push({ x: 0, y: 0, status: 1 });
            }
        }
        state.current.bricks = newBricks;
    };

    const initGame = () => {
        setScore(0);
        setGameOver(false);
        setIsPlaying(true);
        state.current.paddleX = (CANVAS_WIDTH - PADDLE_WIDTH) / 2;
        state.current.ball = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 30, dx: 4, dy: -4 };
        initBricks();
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const relativeX = e.clientX - rect.left;

            if (relativeX > 0 && relativeX < CANVAS_WIDTH) {
                state.current.paddleX = relativeX - PADDLE_WIDTH / 2;
            }
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    useEffect(() => {
        if (!isPlaying) return;

        const loop = setInterval(() => {
            const { ball, paddleX, bricks } = state.current;

            // Move Ball
            ball.x += ball.dx;
            ball.y += ball.dy;

            // Wall Collision
            if (ball.x + ball.dx > CANVAS_WIDTH - BALL_RADIUS || ball.x + ball.dx < BALL_RADIUS) {
                ball.dx = -ball.dx;
            }
            if (ball.y + ball.dy < BALL_RADIUS) {
                ball.dy = -ball.dy;
            } else if (ball.y + ball.dy > CANVAS_HEIGHT - BALL_RADIUS) {
                // Paddle Collision Check
                if (ball.x > paddleX && ball.x < paddleX + PADDLE_WIDTH) {
                    ball.dy = -ball.dy;
                    // Speed up slightly on paddle hit
                    ball.dx *= 1.05;
                    ball.dy *= 1.05;
                } else {
                    // Game Over
                    setIsPlaying(false);
                    setGameOver(true);
                    return;
                }
            }

            // Brick Collision
            for (let c = 0; c < BRICK_COLUMN_COUNT; c++) {
                for (let r = 0; r < BRICK_ROW_COUNT; r++) {
                    const b = bricks[c * BRICK_ROW_COUNT + r];
                    if (b.status === 1) {
                        const brickX = (c * (BRICK_WIDTH + BRICK_PADDING)) + BRICK_OFFSET_LEFT;
                        const brickY = (r * (BRICK_HEIGHT + BRICK_PADDING)) + BRICK_OFFSET_TOP;
                        b.x = brickX;
                        b.y = brickY;

                        if (
                            ball.x > brickX &&
                            ball.x < brickX + BRICK_WIDTH &&
                            ball.y > brickY &&
                            ball.y < brickY + BRICK_HEIGHT
                        ) {
                            ball.dy = -ball.dy;
                            b.status = 0;
                            setScore(s => s + 10);
                        }
                    }
                }
            }

        }, 1000 / 60);

        return () => clearInterval(loop);
    }, [isPlaying]);

    // Draw Loop
    useEffect(() => {
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;

        const render = () => {
            // Clear
            ctx.fillStyle = theme.palette.mode === 'dark' ? '#1e1e1e' : '#f0f2f5';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            // Draw Paddle
            ctx.fillStyle = "#1877f2";
            ctx.fillRect(state.current.paddleX, CANVAS_HEIGHT - PADDLE_HEIGHT, PADDLE_WIDTH, PADDLE_HEIGHT);

            // Draw Ball
            ctx.beginPath();
            ctx.arc(state.current.ball.x, state.current.ball.y, BALL_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = "#ff4081";
            ctx.fill();
            ctx.closePath();

            // Draw Bricks
            state.current.bricks.forEach((b, i) => {
                if (b.status === 1) {
                    const c = Math.floor(i / BRICK_ROW_COUNT);
                    const brickX = (c * (BRICK_WIDTH + BRICK_PADDING)) + BRICK_OFFSET_LEFT;
                    const brickY = (i % BRICK_ROW_COUNT * (BRICK_HEIGHT + BRICK_PADDING)) + BRICK_OFFSET_TOP;

                    ctx.beginPath();
                    ctx.rect(brickX, brickY, BRICK_WIDTH, BRICK_HEIGHT);
                    ctx.fillStyle = `hsl(${c * 45}, 70%, 50%)`;
                    ctx.fill();
                    ctx.closePath();
                }
            });

            requestAnimationFrame(render);
        };
        const animId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(animId);
    }, [theme]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', pt: 4 }}>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
                <Paper elevation={3} sx={{ p: 4, borderRadius: 4, width: 'fit-content', textAlign: 'center', bgcolor: 'background.paper' }}>
                    <Typography variant="h4" fontWeight={900} sx={{ mb: 2, color: 'primary.main' }}>
                        Phá Gạch (Breakout)
                    </Typography>

                    <Typography variant="h3" fontWeight={700} sx={{ mb: 3, color: 'text.primary' }}>
                        {score}
                    </Typography>

                    <Box sx={{ border: '4px solid #333', borderRadius: 2, overflow: 'hidden', lineHeight: 0, mb: 3 }}>
                        <canvas
                            ref={canvasRef}
                            width={CANVAS_WIDTH}
                            height={CANVAS_HEIGHT}
                            style={{ maxWidth: '100%', height: 'auto', cursor: 'none' }}
                        />
                    </Box>

                    <Typography color="text.secondary" sx={{ mb: 3 }}>
                        Di chuyển chuột trái/phải để hứng bóng
                    </Typography>

                    {!isPlaying && (
                        <Button
                            variant="contained"
                            size="large"
                            onClick={initGame}
                            startIcon={gameOver ? <Refresh /> : <PlayArrow />}
                            sx={{ borderRadius: 8, px: 4, py: 1.5, fontWeight: 700 }}
                        >
                            {gameOver ? "Chơi Lại" : "Bắt Đầu"}
                        </Button>
                    )}
                </Paper>
            </Box>
        </Box>
    );
}
