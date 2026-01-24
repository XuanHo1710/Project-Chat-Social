'use client';

import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Tooltip } from '@mui/material';
import { Language as LanguageIcon, Check as CheckIcon } from '@mui/icons-material';
import { useState } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTranslation } from 'react-i18next';

const languages = [
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'en', name: 'English', flag: '🇺🇸' }
];

export default function LanguageSwitcher() {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const { language, setLanguage } = useSettingsStore();
    const { i18n, t } = useTranslation();

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleSelectLanguage = (code: string) => {
        setLanguage(code as any);
        i18n.changeLanguage(code);
        handleClose();
    };

    const currentLang = languages.find(l => l.code === language);

    return (
        <>
            <Tooltip title={t('settings.language')}>
                <IconButton
                    onClick={handleClick}
                    sx={{
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                        borderRadius: 2,
                        fontSize: '1.2rem'
                    }}
                >
                    {currentLang?.flag || <LanguageIcon />}
                </IconButton>
            </Tooltip>
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                {languages.map((lang) => (
                    <MenuItem
                        key={lang.code}
                        onClick={() => handleSelectLanguage(lang.code)}
                        selected={language === lang.code}
                    >
                        <ListItemIcon sx={{ fontSize: '1.3rem', minWidth: 36 }}>
                            {lang.flag}
                        </ListItemIcon>
                        <ListItemText>{lang.name}</ListItemText>
                        {language === lang.code && (
                            <CheckIcon fontSize="small" color="primary" sx={{ ml: 1 }} />
                        )}
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
}
