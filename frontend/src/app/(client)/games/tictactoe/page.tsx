"use client";

import { useState, useCallback } from "react";
import { Box, Typography, Paper, useTheme } from "@mui/material";
import GameShell from "@/components/games/GameShell";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

export default function TicTacToePage() {
    const theme = useTheme();
    const { t } = useTranslation('games');
    const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
    const [isXNext, setIsXNext] = useState(true);
    const [winner, setWinner] = useState<string | null>(null);

    const checkWinner = useCallback((squares: (string | null)[]) => {
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
        <GameShell
            maxWidth={500}
            onRestart={resetGame}
            restartLabelKey="common.playAgain"
            restartSx={{ textTransform: 'none' }}
        >
            <Typography variant="h4" fontWeight={900} sx={{ mb: 4, color: isXNext ? '#FF4081' : '#2196F3' }}>
                {winner ? (winner === "Draw" ? t('tictactoe.draw') : t('tictactoe.winner', { winner })) : t('tictactoe.turn', { player: isXNext ? "X" : "O" })}
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
        </GameShell>
    );
}
