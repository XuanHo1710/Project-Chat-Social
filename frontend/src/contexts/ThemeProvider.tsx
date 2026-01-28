'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, CssBaseline, PaletteMode, ThemeOptions } from '@mui/material';
import { useThemeStore } from '@/stores/useThemeStore';
import { themeService, Theme } from '@/services/theme.service';
import { alpha } from '@mui/material/styles';

// Helper to create palette based on custom theme
const createPalette = (mode: PaletteMode, customTheme: Theme | null): ThemeOptions['palette'] => {
    // Debug log to check incoming theme data
    if (customTheme) {
        console.log("Applying Custom Theme:", customTheme);
    }

    // Validate customTheme has required colors before applying
    // Relaxed check: if at least primaryColor exists, try to use it.
    if (customTheme && customTheme.primaryColor) {
        const isDark = mode === 'dark';
        const primaryMain = customTheme.primaryColor;
        const secondaryMain = customTheme.secondaryColor || '#42b72a'; // Fallback
        const bgDark = customTheme.bgDarkMode || '#18191a';
        const bgLight = customTheme.bgLightMode || '#f0f2f5';

        return {
            mode,
            primary: {
                main: primaryMain,
                light: alpha(primaryMain, 0.5),
                dark: alpha(primaryMain, 0.9),
                contrastText: '#fff',
            },
            secondary: {
                main: secondaryMain,
                light: alpha(secondaryMain, 0.5),
                dark: alpha(secondaryMain, 0.9),
            },
            background: {
                default: isDark ? bgDark : bgLight,
                paper: isDark ? alpha(bgDark, 0.95) : '#ffffff',
            },
            text: {
                primary: isDark ? '#e4e6eb' : '#050505',
                secondary: isDark ? '#b0b3b8' : '#65676b',
            },
            divider: isDark ? '#3a3b3c' : '#e4e6eb',
        };
    }

    console.log("Using Default Theme (Custom theme missing or invalid)");

    // Fallback to default palettes if no custom theme or invalid colors
    return mode === 'dark' ? {
        mode: 'dark',
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
    } : {
        mode: 'light',
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
    };
};

// Custom component overrides
const getComponentOverrides = (mode: PaletteMode, customTheme: Theme | null) => {
    const bgPaper = customTheme
        ? (mode === 'dark' ? alpha(customTheme.bgDarkMode, 0.95) : '#ffffff')
        : (mode === 'dark' ? '#242526' : '#ffffff');

    const bgDefault = customTheme
        ? (mode === 'dark' ? customTheme.bgDarkMode : customTheme.bgLightMode)
        : (mode === 'dark' ? '#18191a' : '#f0f2f5');

    const hoverColor = mode === 'dark' ? alpha('#ffffff', 0.05) : alpha('#000000', 0.04);

    return {
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: bgPaper,
                    color: mode === 'dark' ? '#e4e6eb' : '#050505',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: bgPaper,
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundColor: bgPaper,
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
                        backgroundColor: hoverColor,
                    },
                },
            },
        },
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    '&:hover': {
                        backgroundColor: hoverColor,
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
                    backgroundColor: bgPaper,
                },
            },
        },
        MuiMenuItem: {
            styleOverrides: {
                root: {
                    '&:hover': {
                        backgroundColor: hoverColor,
                    },
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    backgroundColor: bgPaper,
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
    };
};

interface ThemeProviderProps {
    children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    // Subscribe directly to the actualTheme from store
    const actualTheme = useThemeStore((state) => state.actualTheme);
    const mode = useThemeStore((state) => state.mode);
    const customTheme = useThemeStore((state) => state.customTheme);
    const setActualTheme = useThemeStore((state) => state.setActualTheme);
    const setCustomTheme = useThemeStore((state) => state.setCustomTheme);
    const [mounted, setMounted] = useState(false);

    // Handle hydration
    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch active theme from backend
    useEffect(() => {
        const fetchActiveTheme = async () => {
            try {
                const response = await themeService.getActiveTheme();
                // Check if response has data property (standard APIResponse) or if it IS the data
                const themeData = response.data || response;
                setCustomTheme(themeData as any);
            } catch (error) {
                console.error("Failed to fetch active theme", error);
            }
        };
        fetchActiveTheme();
    }, [setCustomTheme]);

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
        return createTheme({
            palette: createPalette(actualTheme, customTheme),
            components: getComponentOverrides(actualTheme, customTheme),
            typography: {
                fontFamily: 'Arial, Helvetica, sans-serif',
            },
            shape: {
                borderRadius: 8,
            },
        });
    }, [actualTheme, customTheme]);

    // Prevent flash of wrong theme during hydration
    if (!mounted) {
        return (
            <MuiThemeProvider theme={createTheme({ palette: { mode: 'light' } })}>
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
