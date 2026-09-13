import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations from separate files
import en from '@/locales/en.json';
import vi from '@/locales/vi.json';
import gamesEn from '@/locales/games.en.json';
import gamesVi from '@/locales/games.vi.json';

import { useSettingsStore } from '@/stores/useSettingsStore';

// MUST stay identical to the zustand persist key in useSettingsStore so
// i18n boots with the same language the settings store will restore.
const SETTINGS_STORAGE_KEY = 'admin-settings-storage';

export type AppLanguage = 'vi' | 'en';

// Read the persisted settings language synchronously so SSR markup and the
// first client render agree (no post-mount override flash).
function getStoredLanguage(): AppLanguage | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { state?: { language?: unknown } };
        const language = parsed?.state?.language;
        return language === 'en' || language === 'vi' ? language : null;
    } catch {
        return null;
    }
}

const resources = {
    en: { translation: en, games: gamesEn },
    vi: { translation: vi, games: gamesVi }
};

const storedLanguage = getStoredLanguage();

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'vi',
        // Only pin the language when settings has a valid persisted value;
        // otherwise let the detector decide.
        ...(storedLanguage ? { lng: storedLanguage } : {}),
        interpolation: {
            escapeValue: false
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage']
        }
    });

// Single entry point for switching the app language: updates i18n AND the
// persisted settings store so both stay in sync across reloads.
export function changeAppLanguage(lng: AppLanguage): void {
    void i18n.changeLanguage(lng);
    useSettingsStore.getState().setLanguage(lng);
}

export default i18n;
