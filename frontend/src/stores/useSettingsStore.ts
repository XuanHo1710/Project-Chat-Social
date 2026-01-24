import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeColor = 'blue' | 'purple' | 'green' | 'orange' | 'pink' | 'cyan';

interface SettingsState {
    themeColor: ThemeColor;
    fontSize: number;
    compactMode: boolean;
    enableMotion: boolean;
    language: 'vi' | 'en';

    setThemeColor: (color: ThemeColor) => void;
    setFontSize: (size: number) => void;
    toggleCompactMode: () => void;
    toggleMotion: () => void;
    setLanguage: (lang: 'vi' | 'en') => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            themeColor: 'blue',
            fontSize: 14,
            compactMode: false,
            enableMotion: true,
            language: 'vi',

            setThemeColor: (themeColor) => set({ themeColor }),
            setFontSize: (fontSize) => set({ fontSize }),
            toggleCompactMode: () => set((state) => ({ compactMode: !state.compactMode })),
            toggleMotion: () => set((state) => ({ enableMotion: !state.enableMotion })),
            setLanguage: (language) => set({ language }),
        }),
        {
            name: 'admin-settings-storage',
        }
    )
);

export const THEME_COLORS: Record<ThemeColor, string> = {
    blue: '#2196F3',
    purple: '#7B61FF',
    green: '#00C853',
    orange: '#FF9800',
    pink: '#E91E63',
    cyan: '#00BCD4'
};
