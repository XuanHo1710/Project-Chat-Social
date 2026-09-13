'use client';

import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';

// i18n language is initialized synchronously in lib/i18n.ts from the same
// persisted key the settings store uses, so no post-mount force override
// (which caused SSR/client hydration flash) is needed here.
export function I18nProvider({ children }: { children: React.ReactNode }) {
    return (
        <I18nextProvider i18n={i18n}>
            {children}
        </I18nextProvider>
    );
}
