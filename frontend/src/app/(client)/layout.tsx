"use client";
import React from "react";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const theme = createTheme({
        palette: {
            mode: "light",
            primary: { main: "#1877f2" },
            background: { default: "#f0f2f5", paper: "#ffffff" },
        },
        shape: { borderRadius: 12 },
        typography: { fontFamily: "var(--font-roboto), Roboto, Arial, sans-serif" },
    });

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
        </ThemeProvider>
    );
}
