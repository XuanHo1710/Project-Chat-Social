"use client";

import { useState, useEffect, useRef } from "react";
import { Box, Typography, Button, Paper, useTheme } from "@mui/material";
import { PlayArrow, Refresh } from "@mui/icons-material";

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const PADDLE_HEIGHT = 80;
const PADDLE_WIDTH = 10;
const BALL_SIZE = 10;

export default function PongPage() {
    const theme = useTheme();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [score, setScore] = useState({ player: 0, ai: 0 });
    const [isPlaying, setIsPlaying] = useState(false);

    // Game State Refs (for animation loop)
    const state = useRef({
        playerY: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
        aiY: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
        ball: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, dx: 4, dy: 4 }
    });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const relativeY = e.clientY - rect.top;

            // Limit paddle within canvas
            const y = Math.max(0, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, relativeY - PADDLE_HEIGHT / 2));
            state.current.playerY = y;
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    useEffect(() => {
        if (!isPlaying) return;

        const loop = setInterval(() => {
            const { ball, playerY, aiY } = state.current;

            // Move Ball
            ball.x += ball.dx;
            ball.y += ball.dy;

            // Bounce Top/Bottom
            if (ball.y <= 0 || ball.y >= CANVAS_HEIGHT - BALL_SIZE) {
                ball.dy *= -1;
            }

            // Paddle Collision (Player)
            if (
                ball.x <= PADDLE_WIDTH &&
                ball.y + BALL_SIZE >= playerY &&
                ball.y <= playerY + PADDLE_HEIGHT
            ) {
                ball.dx = Math.abs(ball.dx); // Bounce right
                ball.dx *= 1.05; // Speed up
            }

            // Paddle Collision (AI)
            if (
                ball.x >= CANVAS_WIDTH - PADDLE_WIDTH - BALL_SIZE &&
                ball.y + BALL_SIZE >= aiY &&
                ball.y <= aiY + PADDLE_HEIGHT
            ) {
                ball.dx = -Math.abs(ball.dx); // Bounce left
                ball.dx *= 1.05;
            }

            // AI Movement
            const centerAi = aiY + PADDLE_HEIGHT / 2;
            if (centerAi < ball.y - 10) state.current.aiY += 3;
            if (centerAi > ball.y + 10) state.current.aiY -= 3;
            // Clamp AI
            state.current.aiY = Math.max(0, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, state.current.aiY));

            // Scoring
            if (ball.x < 0) {
                setScore(s => ({ ...s, ai: s.ai + 1 }));
                resetBall();
            } else if (ball.x > CANVAS_WIDTH) {
                setScore(s => ({ ...s, player: s.player + 1 }));
                resetBall();
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
            ctx.fillStyle = theme.palette.mode === 'dark' ? '#1e1e1e' : '#000';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            ctx.fillStyle = "#fff";

            // Draw Player
            ctx.fillRect(0, state.current.playerY, PADDLE_WIDTH, PADDLE_HEIGHT);

            // Draw AI
            ctx.fillRect(CANVAS_WIDTH - PADDLE_WIDTH, state.current.aiY, PADDLE_WIDTH, PADDLE_HEIGHT);

            // Draw Ball
            ctx.beginPath();
            ctx.arc(state.current.ball.x, state.current.ball.y, BALL_SIZE / 2, 0, Math.PI * 2);
            ctx.fill();

            // Draw Net
            ctx.strokeStyle = "#ffffff33";
            ctx.setLineDash([10, 10]);
            ctx.beginPath();
            ctx.moveTo(CANVAS_WIDTH / 2, 0);
            ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
            ctx.stroke();

            requestAnimationFrame(render);
        };
        const animId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(animId);
    }, [theme]);

    const resetBall = () => {
        state.current.ball = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, dx: (Math.random() > 0.5 ? 4 : -4), dy: (Math.random() * 4 - 2) };
    };

    const toggleGame = () => {
        if (!isPlaying) {
            setScore({ player: 0, ai: 0 });
            resetBall();
        }
        setIsPlaying(!isPlaying);
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', pt: 4 }}>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
                <Paper elevation={3} sx={{ p: 4, borderRadius: 4, width: 'fit-content', textAlign: 'center', bgcolor: 'background.paper' }}>
                    <Typography variant="h4" fontWeight={900} sx={{ mb: 2, color: 'primary.main' }}>
                        Ping Pong
                    </Typography>

                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 8, mb: 2 }}>
                        <Box>
                            <Typography variant="caption" color="text.secondary">PLAYER</Typography>
                            <Typography variant="h3">{score.player}</Typography>
                        </Box>
                        <Box>
                            <Typography variant="caption" color="text.secondary">COMPUTER</Typography>
                            <Typography variant="h3">{score.ai}</Typography>
                        </Box>
                    </Box>

                    <Box sx={{ border: '4px solid #333', borderRadius: 2, overflow: 'hidden', lineHeight: 0, mb: 3 }}>
                        <canvas
                            ref={canvasRef}
                            width={CANVAS_WIDTH}
                            height={CANVAS_HEIGHT}
                            style={{ maxWidth: '100%', height: 'auto', cursor: 'none' }}
                        />
                    </Box>

                    <Typography color="text.secondary" sx={{ mb: 3 }}>
                        Di chuyển chuột lên/xuống để điều khiển vợt
                    </Typography>

                    <Button
                        variant="contained"
                        size="large"
                        onClick={toggleGame}
                        startIcon={isPlaying ? <Refresh /> : <PlayArrow />}
                        sx={{ borderRadius: 8, px: 4, py: 1.5, fontWeight: 700 }}
                    >
                        {isPlaying ? "Dừng Lại" : "Bắt Đầu"}
                    </Button>
                </Paper>
            </Box>
        </Box>
    );
}
