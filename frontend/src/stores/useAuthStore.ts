import { create } from 'zustand';

interface User {
    id: string;
    username: string;
    email?: string;
    fullName?: string;
    avatar?: string;
    role?: string;
    gender?: string;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    setUser: (user: User | null) => void;
    setLoading: (loading: boolean) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,

    setUser: (user) => set({
        user,
        isAuthenticated: !!user,
        isLoading: false
    }),

    setLoading: (loading) => set({ isLoading: loading }),

    logout: () => {
        // Xóa access token
        if (typeof window !== 'undefined') {
            localStorage.removeItem('accessToken');
        }
        set({
            user: null,
            isAuthenticated: false,
            isLoading: false
        });
    },
}));
