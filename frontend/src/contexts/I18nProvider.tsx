'use client';

import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
import { useSettingsStore } from '@/stores/useSettingsStore';

export function I18nProvider({ children }: { children: React.ReactNode }) {
    const { language } = useSettingsStore();

    useEffect(() => {
        // Sync i18n language with store
        if (i18n.language !== language) {
            i18n.changeLanguage(language);
        }
    }, [language]);

    return (
        <I18nextProvider i18n={i18n}>
            {children}
        </I18nextProvider>
    );
}
