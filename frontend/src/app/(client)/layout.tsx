"use client";
import React from "react";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    // Simply pass children through - ThemeProvider is already at root layout level
    // This ensures dark mode works consistently by using the same theme context
    return <>{children}</>;
}
