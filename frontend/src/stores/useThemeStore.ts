'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Theme } from '@/services/theme.service';

export type ThemeMode = 'light' | 'dark' | 'system';
export type FontSize = 'normal' | 'compact';

interface ThemeState {
    mode: ThemeMode;
    fontSize: FontSize;
    actualTheme: 'light' | 'dark';
    customTheme: Theme | null; // Added custom theme state
    _hasHydrated: boolean;
    setMode: (mode: ThemeMode) => void;
    setFontSize: (size: FontSize) => void;
    setActualTheme: (theme: 'light' | 'dark') => void;
    setCustomTheme: (theme: Theme | null) => void; // Added action
    setHasHydrated: (state: boolean) => void;
}

// Helper to calculate actual theme
const getActualTheme = (mode: ThemeMode): 'light' | 'dark' => {
    if (mode === 'system') {
        if (typeof window !== 'undefined') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return 'light';
    }
    return mode;
};

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            mode: 'light',
            fontSize: 'normal',
            actualTheme: 'light',
            customTheme: null,
            _hasHydrated: false,

            setMode: (mode: ThemeMode) => {
                const actualTheme = getActualTheme(mode);
                set({ mode, actualTheme });
            },

            setFontSize: (fontSize: FontSize) => {
                set({ fontSize });
            },

            setActualTheme: (actualTheme: 'light' | 'dark') => {
                set({ actualTheme });
            },

            setCustomTheme: (customTheme: Theme | null) => {
                set({ customTheme });
            },

            setHasHydrated: (_hasHydrated: boolean) => {
                set({ _hasHydrated });
            },
        }),
        {
            name: 'theme-storage',
            storage: createJSONStorage(() => localStorage),
            // Persist both mode, actualTheme and customTheme
            partialize: (state) => ({
                mode: state.mode,
                fontSize: state.fontSize,
                actualTheme: state.actualTheme,
                customTheme: state.customTheme
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    // Recalculate actualTheme on hydration in case system preference changed
                    const actualTheme = getActualTheme(state.mode);
                    state.actualTheme = actualTheme;
                    state._hasHydrated = true;
                }
            },
        }
    )
);
