'use client';

import { Box, Toolbar, CssBaseline } from '@mui/material';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuthStore();
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                router.push('/auth/login');
            } else if (user.role !== 'ADMIN' && user.role !== 'EMPLOYEE') {
                router.push('/');
            } else {
                setIsAuthorized(true);
            }
        }
    }, [user, isLoading, router]);

    const handleMobileMenuToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const handleMobileMenuClose = () => {
        setMobileOpen(false);
    };

    if (isLoading || !isAuthorized) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 2 }}>
                <div>Checking permissions...</div>
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            <AdminHeader onMenuClick={handleMobileMenuToggle} />
            <AdminSidebar mobileOpen={mobileOpen} onMobileClose={handleMobileMenuClose} />
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: { xs: 1.5, sm: 2, md: 3 },
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? '#18191a' : '#f0f2f5',
                    minHeight: '100vh',
                    overflow: 'auto'
                }}
            >
                <Toolbar sx={{ minHeight: { xs: 56, md: 64 } }} />
                {children}
            </Box>
        </Box>
    );
}


