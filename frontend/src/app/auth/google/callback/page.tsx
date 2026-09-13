'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CircularProgress, Box } from '@mui/material';
import rawAxios from 'axios';
import { toast } from 'sonner';
import { CLIENT_PATH } from '@/constants/paths';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/useAuthStore';

export default function GoogleCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasStarted = useRef(false);
  const { setUser, setAccessToken } = useAuthStore();

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const code = searchParams.get('code');
    if (searchParams.get('error') || !code) {
      toast.error('Đăng nhập Google thất bại!');
      router.replace('/auth/login');
      return;
    }

    const processLogin = async () => {
      try {
        const response = await authService.exchangeGoogleCode(code);
        const result = response.data;
        if (!result?.access_token || !result.session_id || !result.payload) {
          throw new Error('Invalid Google exchange response');
        }

        const payload = result.payload;
        await rawAxios.post('/api/auth/session', {
          accessToken: result.access_token,
          sessionId: result.session_id,
        });

        setAccessToken(result.access_token);
        setUser({
          id: payload._id,
          username: payload.username,
          fullName: payload.fullname,
          role: payload.role,
          gender: payload.gender,
          email: payload.email,
          avatar: payload.avatar,
        });

        toast.success(`Xin chào ${payload.fullname}! Đăng nhập thành công!`);
        router.replace(CLIENT_PATH.HOME);
      } catch {
        toast.error('Đăng nhập Google thất bại hoặc liên kết đã hết hạn!');
        router.replace('/auth/login');
      }
    };

    void processLogin();
  }, [router, searchParams, setAccessToken, setUser]);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress />
    </Box>
  );
}
