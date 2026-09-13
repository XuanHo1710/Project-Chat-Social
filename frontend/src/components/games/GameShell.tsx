"use client";

import { Box, Button, Paper, Typography } from "@mui/material";
import type { SystemStyleObject, Theme } from "@mui/system";
import { Refresh } from "@mui/icons-material";
import type { SvgIconComponent } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";

interface GameShellProps {
    /** Optional icon rendered above the title. */
    icon?: SvgIconComponent;
    /** Translation KEY of the heading, resolved against the `games` namespace inside the shell. */
    titleKey?: string;
    /** Style overrides merged over the default `{ mb: 2, color: 'primary.main' }` heading styles. */
    titleSx?: SystemStyleObject<Theme>;
    /** Translation KEY of the score caption in the standard score row. */
    scoreLabelKey?: string;
    /** Score value shown under the caption. */
    score?: string | number;
    /** Color of the score value (e.g. "primary"). Omit to keep the default text color. */
    scoreValueColor?: string;
    /** Right-hand side of the standard score row (e.g. a timer). */
    scoreAside?: ReactNode;
    /** Style overrides merged over `{ display: 'flex', justifyContent: 'space-between' }` on the score row. */
    scoreRowSx?: SystemStyleObject<Theme>;
    /**
     * Custom content rendered last (trailing captions, or fully custom
     * button clusters when `onRestart` isn't a fit).
     */
    actions?: ReactNode;
    /** Standard restart handler; renders a contained Refresh button below the board. */
    onRestart?: () => void;
    /** Translation KEY of the restart button label (defaults to `common.playAgain`). */
    restartLabelKey?: string;
    /** Style overrides merged over the shared restart button styles. */
    restartSx?: SystemStyleObject<Theme>;
    /** Max width of the Paper card (px or CSS length). */
    maxWidth?: number | string;
    /** Shrink the Paper card to its content instead of stretching full width. */
    fitContent?: boolean;
    /**
     * Rare full replacement of the Paper layout styles (alignment/width block).
     * Padding, radius and background always stay.
     */
    paperSx?: SystemStyleObject<Theme>;
    /** The game board and any bespoke sections between header/score row and actions. */
    children: ReactNode;
}

export default function GameShell({
    icon,
    titleKey,
    titleSx,
    scoreLabelKey,
    score,
    scoreValueColor,
    scoreAside,
    scoreRowSx,
    actions,
    onRestart,
    restartLabelKey,
    restartSx,
    maxWidth,
    fitContent,
    paperSx,
    children
}: GameShellProps) {
    const { t } = useTranslation('games');
    const Icon = icon;

    const paperLayout: SystemStyleObject<Theme>[] | undefined = paperSx
        ? [paperSx]
        : [
              { textAlign: 'center' },
              { width: fitContent ? 'fit-content' : '100%' },
              ...(maxWidth !== undefined ? [{ maxWidth }] : [])
          ];

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', pt: 4 }}>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
                <Paper
                    elevation={3}
                    sx={[
                        { p: 4, borderRadius: 4, bgcolor: 'background.paper' },
                        ...(paperLayout ?? [])
                    ]}
                >
                    {Icon && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                            <Icon sx={{ fontSize: 48, color: 'primary.main' }} />
                        </Box>
                    )}

                    {titleKey !== undefined && (
                        <Typography
                            variant="h4"
                            fontWeight={900}
                            sx={{ mb: 2, color: 'primary.main', ...titleSx }}
                        >
                            {t(titleKey)}
                        </Typography>
                    )}

                    {(scoreLabelKey !== undefined || scoreAside !== undefined) && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', ...scoreRowSx }}>
                            {scoreLabelKey !== undefined && (
                                <Box>
                                    <Typography variant="caption" color="text.secondary">
                                        {t(scoreLabelKey)}
                                    </Typography>
                                    <Typography variant="h4" fontWeight={700} color={scoreValueColor}>
                                        {score ?? ''}
                                    </Typography>
                                </Box>
                            )}
                            {scoreAside}
                        </Box>
                    )}

                    {children}

                    {onRestart && (
                        <Button
                            variant="contained"
                            size="large"
                            onClick={onRestart}
                            startIcon={<Refresh />}
                            sx={{ borderRadius: 8, px: 4, py: 1.5, fontWeight: 700, ...restartSx }}
                        >
                            {t(restartLabelKey ?? 'common.playAgain')}
                        </Button>
                    )}

                    {actions}
                </Paper>
            </Box>
        </Box>
    );
}
