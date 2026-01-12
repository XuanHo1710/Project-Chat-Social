"use client";

import { useState, useEffect } from "react";
import { Box, Typography, Button, Paper, Grid, useTheme } from "@mui/material";
import {
    Refresh as RefreshIcon,
    Pets,
    AcUnit,
    AccessAlarm,
    AccountBalance,
    AddReaction,
    AirplanemodeActive,
    Apartment,
    AttachFile
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";

const ICONS = [Pets, AcUnit, AccessAlarm, AccountBalance, AddReaction, AirplanemodeActive, Apartment, AttachFile];

interface Card {
    id: number;
    icon: any;
    isFlipped: boolean;
    isMatched: boolean;
}

export default function MemoryPage() {
    const theme = useTheme();
    const [cards, setCards] = useState<Card[]>([]);
    const [flippedCards, setFlippedCards] = useState<number[]>([]);
    const [moves, setMoves] = useState(0);
    const [isWon, setIsWon] = useState(false);

    useEffect(() => {
        initializeGame();
    }, []);

    const initializeGame = () => {
        const gameIcons = [...ICONS, ...ICONS];
        // Shuffle
        for (let i = gameIcons.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [gameIcons[i], gameIcons[j]] = [gameIcons[j], gameIcons[i]];
        }

        setCards(gameIcons.map((icon, index) => ({
            id: index,
            icon,
            isFlipped: false,
            isMatched: false
        })));
        setFlippedCards([]);
        setMoves(0);
        setIsWon(false);
    };

    const handleCardClick = (id: number) => {
        if (flippedCards.length === 2 || cards[id].isFlipped || cards[id].isMatched) return;

        const newCards = [...cards];
        newCards[id].isFlipped = true;
        setCards(newCards);

        const newFlipped = [...flippedCards, id];
        setFlippedCards(newFlipped);

        if (newFlipped.length === 2) {
            setMoves(m => m + 1);
            checkForMatch(newFlipped);
        }
    };

    const checkForMatch = (flipped: number[]) => {
        const [first, second] = flipped;
        if (cards[first].icon === cards[second].icon) {
            setCards(prev => prev.map(card =>
                card.id === first || card.id === second
                    ? { ...card, isMatched: true }
                    : card
            ));
            setFlippedCards([]);

            // Check win
            if (cards.filter(c => !c.isMatched && c.id !== first && c.id !== second).length === 0) {
                setIsWon(true);
            }
        } else {
            setTimeout(() => {
                setCards(prev => prev.map(card =>
                    card.id === first || card.id === second
                        ? { ...card, isFlipped: false }
                        : card
                ));
                setFlippedCards([]);
            }, 1000);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', pt: 4 }}>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
                <Paper elevation={3} sx={{ p: 4, borderRadius: 4, maxWidth: 600, width: '100%', textAlign: 'center', bgcolor: 'background.paper' }}>
                    <Typography variant="h4" fontWeight={900} sx={{ mb: 2, color: 'primary.main' }}>
                        Lật Hình
                    </Typography>

                    <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center', gap: 4 }}>
                        <Typography variant="h6" color="text.secondary">Lượt: {moves}</Typography>
                        {isWon && <Typography variant="h6" color="success.main" fontWeight={700}>CHIẾN THẮNG!</Typography>}
                    </Box>

                    <Grid container spacing={2} sx={{ maxWidth: 400, mx: 'auto', mb: 4 }}>
                        {cards.map((card) => {
                            const IconComponent = card.icon;
                            return (
                                // @ts-ignore
                                <Grid item xs={3} key={card.id}>
                                    <motion.div
                                        animate={{ rotateY: card.isFlipped ? 180 : 0 }}
                                        transition={{ duration: 0.3 }}
                                        style={{ perspective: 1000 }}
                                    >
                                        <Paper
                                            onClick={() => handleCardClick(card.id)}
                                            sx={{
                                                height: 80,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                bgcolor: card.isFlipped
                                                    ? (card.isMatched ? 'success.light' : 'primary.light')
                                                    : (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'grey.200'),
                                                transform: card.isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                                                // Prevent symbol from being mirrored
                                                '& svg': {
                                                    transform: 'rotateY(180deg)'
                                                }
                                            }}
                                        >
                                            {card.isFlipped && <IconComponent sx={{ fontSize: 40, color: 'white' }} />}
                                        </Paper>
                                    </motion.div>
                                </Grid>
                            );
                        })}
                    </Grid>

                    <Button
                        variant="contained"
                        size="large"
                        onClick={initializeGame}
                        startIcon={<RefreshIcon />}
                        sx={{ borderRadius: 8, px: 4, py: 1.5, fontWeight: 700 }}
                    >
                        Chơi lại
                    </Button>
                </Paper>
            </Box>
        </Box>
    );
}
