'use client';

import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';

import RightSidebar from '@/components/RightSidebar';
import { Box, CircularProgress } from '@mui/material';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { CLIENT_PATH } from '@/constants/paths';
import Feed from '@/components/Feed';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();

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
          bgcolor: '#f0f2f5',
        }}
      >
        <CircularProgress size={60} sx={{ color: '#1877f2' }} />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Box sx={{ bgcolor: '#f0f2f5', minHeight: '100vh' }}>
      <Header />

      <Box sx={{ display: 'flex', pt: '56px' }}>
        <Sidebar />

        <Box
          sx={{
            flex: 1,
            ml: { xs: 0, lg: '280px' },
            mr: { xs: 0, xl: '280px' },
          }}
        >
          <Feed />
        </Box>

        <RightSidebar />
      </Box>
    </Box>
  );
}
