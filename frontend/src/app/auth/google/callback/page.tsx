'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { toast } from 'sonner';
import { CLIENT_PATH } from '@/constants/paths';
import axios from 'axios';
import { CircularProgress, Box } from '@mui/material';

export default function GoogleCallbackPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { setUser, setAccessToken } = useAuthStore();

    useEffect(() => {
        const error = searchParams.get('error');
        if (error) {
            toast.error('Đăng nhập Google thất bại!');
            router.replace('/auth/login');
            return;
        }

        const accessToken = searchParams.get('access_token');
        const sessionId = searchParams.get('session_id');
        const payloadStr = searchParams.get('payload');

        if (!accessToken || !sessionId || !payloadStr) {
            toast.error('Đăng nhập Google thất bại!');
            router.replace('/auth/login');
            return;
        }

        const processLogin = async () => {
            try {
                const payload = JSON.parse(payloadStr);

                const userData = {
                    id: payload._id,
                    username: payload.username,
                    fullName: payload.fullname,
                    role: payload.role,
                    gender: payload.gender,
                    email: payload.email,
                    avatar: payload.avatar,
                };

                setAccessToken(accessToken);
                setUser(userData);

                await axios.post('/api/auth/session', {
                    accessToken,
                    sessionId,
                });

                toast.success(`Xin chào ${payload.fullname}! Đăng nhập thành công!`);
                router.replace(CLIENT_PATH.HOME);
            } catch {
                toast.error('Đăng nhập Google thất bại!');
                router.replace('/auth/login');
            }
        };

        processLogin();
    }, [searchParams, router, setUser, setAccessToken]);

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress />
        </Box>
    );
}
