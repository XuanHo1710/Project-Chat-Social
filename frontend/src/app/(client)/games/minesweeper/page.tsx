"use client";

import { useState, useEffect } from "react";
import { Box, Typography } from "@mui/material";
import { Flag } from "@mui/icons-material";
import GameShell from "@/components/games/GameShell";
import { useTranslation } from "react-i18next";

const ROWS = 10;
const COLS = 10;
const MINES = 15;

interface Cell {
    id: number;
    hasMine: boolean;
    isRevealed: boolean;
    isFlagged: boolean;
    neighborMines: number;
}

export default function MinesweeperPage() {
    const { t } = useTranslation('games');
    const [board, setBoard] = useState<Cell[]>([]);
    const [gameOver, setGameOver] = useState(false);
    const [gameWon, setGameWon] = useState(false);

    useEffect(() => {
        initGame();
    }, []);

    const initGame = () => {
        let newBoard = Array(ROWS * COLS).fill(null).map((_, i) => ({
            id: i,
            hasMine: false,
            isRevealed: false,
            isFlagged: false,
            neighborMines: 0
        }));

        // Place mines
        let minesPlaced = 0;
        while (minesPlaced < MINES) {
            const idx = Math.floor(Math.random() * (ROWS * COLS));
            if (!newBoard[idx].hasMine) {
                newBoard[idx].hasMine = true;
                minesPlaced++;
            }
        }

        // Calculate neighbors
        newBoard.forEach((cell, idx) => {
            if (!cell.hasMine) {
                const neighbors = getNeighbors(idx);
                cell.neighborMines = neighbors.filter(i => newBoard[i].hasMine).length;
            }
        });

        setBoard(newBoard);
        setGameOver(false);
        setGameWon(false);
    };

    const getNeighbors = (index: number) => {
        const neighbors = [];
        const r = Math.floor(index / COLS);
        const c = index % COLS;

        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue;
                const nr = r + i;
                const nc = c + j;
                if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                    neighbors.push(nr * COLS + nc);
                }
            }
        }
        return neighbors;
    };

    const revealCell = (index: number) => {
        if (gameOver || gameWon || board[index].isRevealed || board[index].isFlagged) return;

        const newBoard = [...board];

        if (newBoard[index].hasMine) {
            // BOOM
            newBoard.forEach(c => {
                if (c.hasMine) c.isRevealed = true;
            });
            setBoard(newBoard);
            setGameOver(true);
            return;
        }

        // Flood fill
        const stack = [index];
        while (stack.length > 0) {
            const curr = stack.pop()!;
            if (newBoard[curr].isRevealed) continue;
            newBoard[curr].isRevealed = true;

            if (newBoard[curr].neighborMines === 0) {
                getNeighbors(curr).forEach(n => {
                    if (!newBoard[n].isRevealed && !newBoard[n].isFlagged) {
                        stack.push(n);
                    }
                });
            }
        }

        setBoard(newBoard);
        checkWin(newBoard);
    };

    const toggleFlag = (e: React.MouseEvent, index: number) => {
        e.preventDefault();
        if (gameOver || gameWon || board[index].isRevealed) return;
        const newBoard = [...board];
        newBoard[index].isFlagged = !newBoard[index].isFlagged;
        setBoard(newBoard);
    };

    const checkWin = (currentBoard: Cell[]) => {
        const hiddenNonMines = currentBoard.filter(c => !c.hasMine && !c.isRevealed).length;
        if (hiddenNonMines === 0) {
            setGameWon(true);
        }
    };

    return (
        <GameShell
            titleKey="minesweeper.name"
            titleSx={{ color: 'text.primary' }}
            maxWidth={500}
            onRestart={initGame}
            restartLabelKey="common.playAgain"
            actions={
                <Typography variant="caption" sx={{ display: 'block', mt: 3, color: 'text.secondary' }}>
                    {t('minesweeper.instructions')}
                </Typography>
            }
        >
            <Box sx={{ mb: 3 }}>
                {gameOver ?
                    <Typography color="error" variant="h6" fontWeight={700}>{t('minesweeper.gameOver')}</Typography> :
                    (gameWon ? <Typography color="success.main" variant="h6" fontWeight={700}>{t('common.win')}</Typography> :
                        <Typography sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                            <Flag color="error" /> {MINES - board.filter(c => c.isFlagged).length}
                        </Typography>)
                }
            </Box>

            <Box sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                gap: 0.5,
                maxWidth: 350,
                mx: 'auto',
                mb: 4,
                bgcolor: '#bdbdbd',
                p: 1,
                borderRadius: 1
            }}>
                {board.map((cell) => (
                    <Box
                        key={cell.id}
                        onClick={() => revealCell(cell.id)}
                        onContextMenu={(e) => toggleFlag(e, cell.id)}
                        sx={{
                            width: 30,
                            height: 30,
                            bgcolor: cell.isRevealed
                                ? (cell.hasMine ? '#ef5350' : '#e0e0e0')
                                : '#bdbdbd',
                            border: cell.isRevealed ? '1px solid #9e9e9e' : '4px outset #eceff1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 'bold',
                            color: [
                                '', 'blue', 'green', 'red', 'darkblue', 'brown', 'cyan', 'black', 'gray'
                            ][cell.neighborMines]
                        }}
                    >
                        {cell.isRevealed && !cell.hasMine && cell.neighborMines > 0 && cell.neighborMines}
                        {cell.isRevealed && cell.hasMine && '💣'}
                        {!cell.isRevealed && cell.isFlagged && <Flag color="error" sx={{ fontSize: 16 }} />}
                    </Box>
                ))}
            </Box>
        </GameShell>
    );
}
