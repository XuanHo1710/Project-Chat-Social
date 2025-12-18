import { UserLoginType } from '@/types/account';
import { create } from 'zustand';


interface AuthState {
    user: UserLoginType | null;
    isAuthenticated: boolean;
    accessToken?: string | null;
    isLoading: boolean;
    setUser: (user: UserLoginType | null) => void;
    setAccessToken: (token: string | null) => void;
    setLoading: (loading: boolean) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    accessToken: null,

    setAccessToken: (token) => set({ accessToken: token }),

    setUser: (user) => set({
        user,
        isAuthenticated: !!user,
        isLoading: false
    }),

    setLoading: (loading) => set({ isLoading: loading }),

    logout: () => {
        set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            accessToken: null
        });
    },
}));
