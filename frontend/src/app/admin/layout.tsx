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

    useEffect(() => {
        // Chỉ check khi hết loading
        if (!isLoading) {
            // Logic check quyền admin (hiện tại check user tồn tại và role)
            if (!user) {
                router.push('/auth/login');
            } else if (user.role !== 'ADMIN') {
                router.push('/');
            } else {
                setIsAuthorized(true);
            }
        }
    }, [user, isLoading, router]);


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
            <AdminHeader />
            <AdminSidebar />
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 4,  // Tăng padding
                    width: { sm: `calc(100% - 260px)` }, // Updated drawer width (260px)
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? '#0b0f19' : '#f4f6f8', // Premium background colors
                    minHeight: '100vh'
                }}
            >
                <Toolbar sx={{ minHeight: 70 }} /> {/* Spacer matching new header height */}
                {children}
            </Box>
        </Box>
    );
}
