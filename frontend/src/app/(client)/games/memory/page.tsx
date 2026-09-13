"use client";

import { useState, useEffect } from "react";
import { Box, Typography, Grid, Paper, useTheme } from "@mui/material";
import type { SvgIconComponent } from "@mui/icons-material";
import {
    Pets,
    AcUnit,
    AccessAlarm,
    AccountBalance,
    AddReaction,
    AirplanemodeActive,
    Apartment,
    AttachFile
} from "@mui/icons-material";
import { motion } from "framer-motion";
import GameShell from "@/components/games/GameShell";
import { useTranslation } from "react-i18next";

const ICONS: SvgIconComponent[] = [Pets, AcUnit, AccessAlarm, AccountBalance, AddReaction, AirplanemodeActive, Apartment, AttachFile];

interface Card {
    id: number;
    icon: SvgIconComponent;
    isFlipped: boolean;
    isMatched: boolean;
}

export default function MemoryPage() {
    const theme = useTheme();
    const { t } = useTranslation('games');
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
        <GameShell titleKey="memory.name" maxWidth={600} onRestart={initializeGame} restartLabelKey="common.playAgain">
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center', gap: 4 }}>
                <Typography variant="h6" color="text.secondary">{t('memory.moves', { moves })}</Typography>
                {isWon && <Typography variant="h6" color="success.main" fontWeight={700}>{t('common.win')}</Typography>}
            </Box>

            <Grid container spacing={2} sx={{ maxWidth: 400, mx: 'auto', mb: 4 }}>
                {cards.map((card) => {
                    const IconComponent = card.icon;
                    return (
                        <Grid size={3} key={card.id}>
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
        </GameShell>
    );
}
