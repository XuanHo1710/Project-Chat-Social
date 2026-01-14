"use client";

import { useState, useEffect, useCallback } from "react";
import { Box, Typography, Button, Paper, useTheme } from "@mui/material";
import { Refresh } from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";

export default function Game2048Page() {
    const theme = useTheme();
    const [board, setBoard] = useState(Array(16).fill(0));
    const [score, setScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);

    // Initialize
    useEffect(() => {
        initGame();
    }, []);

    const initGame = () => {
        const newBoard = Array(16).fill(0);
        addNumber(newBoard);
        addNumber(newBoard);
        setBoard(newBoard);
        setScore(0);
        setGameOver(false);
    };

    const addNumber = (currentBoard: number[]) => {
        const emptyIndices = currentBoard.reduce((acc: number[], val, idx) =>
            val === 0 ? [...acc, idx] : acc, []);

        if (emptyIndices.length > 0) {
            const idx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
            currentBoard[idx] = Math.random() < 0.9 ? 2 : 4;
        }
    };

    const getColor = (value: number) => {
        const colors: { [key: number]: string } = {
            2: '#eee4da',
            4: '#ede0c8',
            8: '#f2b179',
            16: '#f59563',
            32: '#f67c5f',
            64: '#f65e3b',
            128: '#edcf72',
            256: '#edcc61',
            512: '#edc850',
            1024: '#edc53f',
            2048: '#edc22e'
        };
        return colors[value] || '#3c3a32';
    };

    const getTextColor = (value: number) => {
        return value <= 4 ? '#776e65' : '#f9f6f2';
    };

    // Game Logic (Simplified Up Movement)
    const moveLeft = (currentBoard: number[]) => {
        let newBoard = [...currentBoard];
        let moved = false;
        let addedScore = 0;

        for (let r = 0; r < 4; r++) {
            let row = newBoard.slice(r * 4, r * 4 + 4);
            let filteredRow = row.filter(val => val !== 0);

            for (let i = 0; i < filteredRow.length - 1; i++) {
                if (filteredRow[i] === filteredRow[i + 1]) {
                    filteredRow[i] *= 2;
                    addedScore += filteredRow[i];
                    filteredRow.splice(i + 1, 1);
                    moved = true;
                }
            }

            while (filteredRow.length < 4) filteredRow.push(0);

            // Check if row changed
            if (filteredRow.some((val, i) => val !== row[i])) moved = true;

            for (let c = 0; c < 4; c++) {
                newBoard[r * 4 + c] = filteredRow[c];
            }
        }
        return { newBoard, moved, addedScore };
    };

    const rotateBoard = (currentBoard: number[]) => {
        const newBoard = Array(16).fill(0);
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                newBoard[c * 4 + (3 - r)] = currentBoard[r * 4 + c];
            }
        }
        return newBoard;
    };

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (gameOver) return;

        let newBoard = [...board];
        let moved = false;
        let addedScore = 0;
        let result;

        if (e.key === 'ArrowLeft') {
            result = moveLeft(newBoard);
        } else if (e.key === 'ArrowUp') {
            newBoard = rotateBoard(newBoard);
            newBoard = rotateBoard(newBoard);
            newBoard = rotateBoard(newBoard);
            result = moveLeft(newBoard);
            newBoard = rotateBoard(newBoard);
        } else if (e.key === 'ArrowRight') {
            newBoard = rotateBoard(newBoard);
            newBoard = rotateBoard(newBoard);
            result = moveLeft(newBoard);
            newBoard = rotateBoard(newBoard);
            newBoard = rotateBoard(newBoard);
        } else if (e.key === 'ArrowDown') {
            newBoard = rotateBoard(newBoard);
            result = moveLeft(newBoard);
            newBoard = rotateBoard(newBoard);
            newBoard = rotateBoard(newBoard);
            newBoard = rotateBoard(newBoard);
        } else {
            return;
        }

        if (result && result.moved) {
            moved = true;
            addedScore = result.addedScore;
            newBoard = result.newBoard;
            addNumber(newBoard);
            setBoard(newBoard);
            setScore(s => s + addedScore);

            // Check Game Over
            if (!newBoard.includes(0)) {
                // Simplified game over check (just check empty for now for speed)
                setGameOver(true);
            }
        }

    }, [board, gameOver]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', pt: 4 }}>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
                <Paper elevation={3} sx={{ p: 4, borderRadius: 4, maxWidth: 500, width: '100%', textAlign: 'center', bgcolor: 'background.paper' }}>
                    <Typography variant="h4" fontWeight={900} sx={{ mb: 2, color: '#edc22e' }}>
                        2048
                    </Typography>

                    <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center', gap: 4 }}>
                        <Box sx={{ bgcolor: '#bbada0', p: 1, borderRadius: 1, minWidth: 100 }}>
                            <Typography variant="caption" sx={{ color: '#eee4da' }}>SCORE</Typography>
                            <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>{score}</Typography>
                        </Box>
                    </Box>

                    <Box sx={{
                        bgcolor: '#bbada0',
                        p: 1.5,
                        borderRadius: 2,
                        width: 320,
                        maxWidth: '100%',
                        aspectRatio: '1/1',
                        height: 320,
                        mx: 'auto',
                        mb: 4,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: 1.5
                    }}>
                        {board.map((cell, i) => (
                            <Box
                                key={i}
                                sx={{
                                    width: '100%',
                                    height: '100%',
                                    bgcolor: getColor(cell),
                                    borderRadius: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: getTextColor(cell),
                                    fontSize: cell > 100 ? 20 : 28,
                                    fontWeight: 700
                                }}
                            >
                                {cell > 0 ? cell : ''}
                            </Box>
                        ))}
                    </Box>

                    {gameOver && <Typography variant="h6" color="error" sx={{ mb: 2 }}>Game Over!</Typography>}

                    <Button
                        variant="contained"
                        size="large"
                        onClick={initGame}
                        startIcon={<Refresh />}
                        sx={{ borderRadius: 8, px: 4, py: 1.5, fontWeight: 700, bgcolor: '#8f7a66' }}
                    >
                        New Game
                    </Button>

                    <Typography variant="caption" sx={{ display: 'block', mt: 3, color: 'text.secondary' }}>
                        Sử dụng phím mũi tên để di chuyển các ô số
                    </Typography>
                </Paper>
            </Box>
        </Box>
    );
}
