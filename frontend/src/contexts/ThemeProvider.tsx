'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, CssBaseline, PaletteMode } from '@mui/material';
import { useThemeStore } from '@/stores/useThemeStore';

// Light theme palette
const lightPalette = {
    mode: 'light' as PaletteMode,
    primary: {
        main: '#1877f2',
        light: '#4293f5',
        dark: '#166fe5',
        contrastText: '#fff',
    },
    secondary: {
        main: '#42b72a',
        light: '#67c552',
        dark: '#36952a',
    },
    background: {
        default: '#f0f2f5',
        paper: '#ffffff',
    },
    text: {
        primary: '#050505',
        secondary: '#65676b',
    },
    divider: '#e4e6eb',
    error: {
        main: '#fa383e',
    },
    success: {
        main: '#31a24c',
    },
    warning: {
        main: '#f7b928',
    },
};

// Dark theme palette
const darkPalette = {
    mode: 'dark' as PaletteMode,
    primary: {
        main: '#2d88ff',
        light: '#5aa0ff',
        dark: '#1877f2',
        contrastText: '#fff',
    },
    secondary: {
        main: '#42b72a',
        light: '#67c552',
        dark: '#36952a',
    },
    background: {
        default: '#18191a',
        paper: '#242526',
    },
    text: {
        primary: '#e4e6eb',
        secondary: '#b0b3b8',
    },
    divider: '#3a3b3c',
    error: {
        main: '#fa383e',
    },
    success: {
        main: '#31a24c',
    },
    warning: {
        main: '#f7b928',
    },
};

// Custom component overrides
const getComponentOverrides = (mode: PaletteMode) => ({
    MuiAppBar: {
        styleOverrides: {
            root: {
                backgroundColor: mode === 'dark' ? '#242526' : '#ffffff',
                color: mode === 'dark' ? '#e4e6eb' : '#050505',
            },
        },
    },
    MuiPaper: {
        styleOverrides: {
            root: {
                backgroundImage: 'none',
            },
        },
    },
    MuiCard: {
        styleOverrides: {
            root: {
                backgroundColor: mode === 'dark' ? '#242526' : '#ffffff',
            },
        },
    },
    MuiButton: {
        styleOverrides: {
            root: {
                textTransform: 'none' as const,
            },
        },
    },
    MuiIconButton: {
        styleOverrides: {
            root: {
                '&:hover': {
                    backgroundColor: mode === 'dark' ? '#3a3b3c' : '#f0f2f5',
                },
            },
        },
    },
    MuiListItemButton: {
        styleOverrides: {
            root: {
                '&:hover': {
                    backgroundColor: mode === 'dark' ? '#3a3b3c' : '#f0f2f5',
                },
            },
        },
    },
    MuiDivider: {
        styleOverrides: {
            root: {
                borderColor: mode === 'dark' ? '#3a3b3c' : '#e4e6eb',
            },
        },
    },
    MuiTooltip: {
        styleOverrides: {
            tooltip: {
                backgroundColor: mode === 'dark' ? '#3a3b3c' : 'rgba(0,0,0,0.87)',
            },
        },
    },
    MuiMenu: {
        styleOverrides: {
            paper: {
                backgroundColor: mode === 'dark' ? '#242526' : '#ffffff',
            },
        },
    },
    MuiMenuItem: {
        styleOverrides: {
            root: {
                '&:hover': {
                    backgroundColor: mode === 'dark' ? '#3a3b3c' : '#f0f2f5',
                },
            },
        },
    },
    MuiDialog: {
        styleOverrides: {
            paper: {
                backgroundColor: mode === 'dark' ? '#242526' : '#ffffff',
            },
        },
    },
    MuiTextField: {
        styleOverrides: {
            root: {
                '& .MuiInputBase-root': {
                    color: mode === 'dark' ? '#e4e6eb' : '#050505',
                },
            },
        },
    },
});

interface ThemeProviderProps {
    children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    // Subscribe directly to the actualTheme from store
    const actualTheme = useThemeStore((state) => state.actualTheme);
    const mode = useThemeStore((state) => state.mode);
    const setActualTheme = useThemeStore((state) => state.setActualTheme);
    const [mounted, setMounted] = useState(false);

    // Handle hydration
    useEffect(() => {
        setMounted(true);
    }, []);

    // Listen for system theme changes when mode is 'system'
    useEffect(() => {
        if (mode === 'system' && typeof window !== 'undefined') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = (e: MediaQueryListEvent) => {
                setActualTheme(e.matches ? 'dark' : 'light');
            };
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }
    }, [mode, setActualTheme]);

    // Create theme based on actualTheme from store
    const theme = useMemo(() => {
        const palette = actualTheme === 'dark' ? darkPalette : lightPalette;
        return createTheme({
            palette,
            components: getComponentOverrides(actualTheme),
            typography: {
                fontFamily: 'Arial, Helvetica, sans-serif',
            },
            shape: {
                borderRadius: 8,
            },
        });
    }, [actualTheme]);

    // Prevent flash of wrong theme during hydration
    if (!mounted) {
        return (
            <MuiThemeProvider theme={createTheme({ palette: lightPalette })}>
                <CssBaseline />
                <div style={{ visibility: 'hidden' }}>{children}</div>
            </MuiThemeProvider>
        );
    }

    return (
        <MuiThemeProvider theme={theme}>
            <CssBaseline />
            {children}
        </MuiThemeProvider>
    );
}
