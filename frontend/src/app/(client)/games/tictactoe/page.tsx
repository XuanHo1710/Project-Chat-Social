"use client";

import { useState, useCallback, useEffect } from "react";
import { Box, Typography, Button, Paper, useTheme } from "@mui/material";
import { Refresh as RefreshIcon } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function TicTacToePage() {
    const theme = useTheme();
    const router = useRouter();
    const [board, setBoard] = useState(Array(9).fill(null));
    const [isXNext, setIsXNext] = useState(true);
    const [winner, setWinner] = useState<string | null>(null);

    const checkWinner = useCallback((squares: any[]) => {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];
        for (let i = 0; i < lines.length; i++) {
            const [a, b, c] = lines[i];
            if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
                return squares[a];
            }
        }
        return null;
    }, []);

    const handleClick = (i: number) => {
        if (winner || board[i]) return;
        const newBoard = [...board];
        newBoard[i] = isXNext ? "X" : "O";
        setBoard(newBoard);
        const win = checkWinner(newBoard);
        if (win) {
            setWinner(win);
        } else if (!newBoard.includes(null)) {
            setWinner("Draw");
        } else {
            setIsXNext(!isXNext);
        }
    };

    const resetGame = () => {
        setBoard(Array(9).fill(null));
        setIsXNext(true);
        setWinner(null);
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', pt: 4 }}>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
                <Paper elevation={3} sx={{ p: 4, borderRadius: 4, maxWidth: 500, width: '100%', textAlign: 'center', bgcolor: 'background.paper' }}>
                    <Typography variant="h4" fontWeight={900} sx={{ mb: 4, color: isXNext ? '#FF4081' : '#2196F3' }}>
                        {winner ? (winner === "Draw" ? "Hòa!" : `Người thắng: ${winner}`) : `Lượt chơi: ${isXNext ? "X" : "O"}`}
                    </Typography>

                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, maxWidth: 350, mx: 'auto', mb: 4 }}>
                        {board.map((cell, i) => (
                            <motion.div key={i} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <Paper
                                    onClick={() => handleClick(i)}
                                    sx={{
                                        height: 100,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '3rem',
                                        fontWeight: 900,
                                        cursor: 'pointer',
                                        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f5f5f5',
                                        color: cell === 'X' ? '#FF4081' : '#2196F3',
                                        boxShadow: 'none',
                                        border: `2px solid ${theme.palette.divider}`
                                    }}
                                >
                                    <AnimatePresence>
                                        {cell && (
                                            <motion.span
                                                initial={{ scale: 0, rotate: -45 }}
                                                animate={{ scale: 1, rotate: 0 }}
                                            >
                                                {cell}
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </Paper>
                            </motion.div>
                        ))}
                    </Box>

                    <Button
                        variant="contained"
                        size="large"
                        onClick={resetGame}
                        startIcon={<RefreshIcon />}
                        sx={{ borderRadius: 8, px: 4, py: 1.5, fontWeight: 700, textTransform: 'none' }}
                    >
                        Chơi lại
                    </Button>
                </Paper>
            </Box>
        </Box>
    );
}
