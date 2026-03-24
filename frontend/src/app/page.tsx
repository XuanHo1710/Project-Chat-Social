'use client';

import Header from '@/components/home/Header';
import Sidebar from '@/components/home/Sidebar';

import RightSidebar from '@/components/home/RightSidebar';
import MobileBottomNav from '@/components/home/MobileBottomNav';
import { Box, CircularProgress, useTheme } from '@mui/material';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { CLIENT_PATH } from '@/constants/paths';
import HomeFeed from '@/components/home/HomeFeed';


export default function Home() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(CLIENT_PATH.LOGIN);
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress sx={{ fontSize: 60, color: 'primary.main' }} />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return null;
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
            pb: { xs: '64px', md: 0 },
          }}
        >
          <HomeFeed />
        </Box>

        <RightSidebar />
      </Box>

      <MobileBottomNav />
    </Box>
  );
}
