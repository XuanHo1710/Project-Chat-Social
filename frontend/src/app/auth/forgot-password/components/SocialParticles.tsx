"use client";

import React, { useEffect, useState } from "react";
import { Box } from "@mui/material";
import { motion } from "framer-motion";

interface Particle {
    key: number;
    width: number;
    height: number;
    color: string;
    shadow: number;
    initialX: number;
    initialY: number;
    duration: number;
    delay: number;
    xPath: number[];
    yPath: number[];
}

export const SocialParticles = () => {
    const [particles, setParticles] = useState<Particle[]>([]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const newParticles = Array.from({ length: 60 }).map((_, i) => ({
            key: i,
            width: Math.random() * 6 + 2,
            height: Math.random() * 6 + 2,
            color: ['#1877f2', '#42b72a', '#e91e63', '#9c27b0', '#ffeb3b'][Math.floor(Math.random() * 5)],
            shadow: Math.random() * 10 + 5,
            initialX: Math.random() * window.innerWidth,
            initialY: Math.random() * window.innerHeight,
            duration: Math.random() * 20 + 10,
            delay: Math.random() * 5,
            xPath: [
                Math.random() * window.innerWidth,
                Math.random() * window.innerWidth,
                Math.random() * window.innerWidth
            ],
            yPath: [
                Math.random() * window.innerHeight,
                Math.random() * window.innerHeight,
                Math.random() * window.innerHeight
            ]
        }));
        setParticles(newParticles);
    }, []);

    return (
        <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
            {particles.map((p) => (
                <motion.div
                    key={p.key}
                    style={{
                        position: 'absolute',
                        width: p.width,
                        height: p.height,
                        borderRadius: '50%',
                        backgroundColor: p.color,
                        boxShadow: `0 0 ${p.shadow}px ${p.shadow / 2}px rgba(255,255,255,0.5)`,
                    }}
                    initial={{
                        x: p.initialX,
                        y: p.initialY,
                        opacity: 0,
                        scale: 0
                    }}
                    animate={{
                        x: p.xPath,
                        y: p.yPath,
                        opacity: [0, Math.random() * 0.8 + 0.2, 0],
                        scale: [0, Math.random() * 1.5 + 0.5, 0]
                    }}
                    transition={{
                        duration: p.duration,
                        repeat: Infinity,
                        ease: "linear",
                        delay: p.delay
                    }}
                />
            ))}
        </Box>
    );
};
