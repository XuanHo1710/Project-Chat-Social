"use client";
import React from "react";
import Header from "@/components/home/Header";
import Sidebar from "@/components/home/Sidebar";
import RightSidebar from "@/components/home/RightSidebar";
import { Box } from "@mui/material";
import { usePathname } from "next/navigation";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isChat = pathname?.startsWith('/chat');
    const isReels = pathname?.startsWith('/reels');
    const isFriends = pathname?.startsWith('/friends');
    const isProfile = pathname?.startsWith('/profile');
    const isGroups = pathname?.startsWith('/groups');
    const isSettins = pathname?.startsWith('/settings');


    // If it's a standalone page like Chat or Reels (full screen), just render children
    if (isChat || isReels || isFriends || isProfile || isGroups || isSettins) {
        return <>{children}</>;
    }

    return (
        <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
            <Header />
            <Box sx={{ display: 'flex', pt: '56px', justifyContent: 'space-between' }}>
                <Sidebar />
                <Box
                    sx={{
                        flex: 1,
                        ml: { xs: 0, md: '280px' },
                        mr: { xs: 0, lg: '280px' },
                        minWidth: 0,
                    }}
                >
                    {children}
                </Box>
                <RightSidebar />
            </Box>
        </Box>
    );
}
