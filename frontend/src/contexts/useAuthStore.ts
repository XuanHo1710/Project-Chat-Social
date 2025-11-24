// import { create } from 'zustand';
// import { authService } from '@/services/client/auth.service';
// import { toast } from 'sonner';
// import { AccountResponseType } from '@/schema/account.schema';
// /**
//  * Authentication Store using Zustand
//  * Manages global authentication state
//  * Store accessToken and set it to axios config
//  *
//  * @author: Nguyễn Xuân Hồ
//  * @date: 10/15/2025
//  */

// interface UserRequestType {
//     fullName: string;
//     dateOfBirth: Date;
//     gender: string;
// }

// interface AuthStoreState {
//     account: AccountResponseType | null;
//     accessToken: string | null;
//     loading: boolean;
//     isAuthenticated: boolean;
//     refreshToken: string | null;

//     // Actions
//     login: (email: string, password: string) => Promise<boolean>;
//     register: (email: string, password: string, phoneNumber: string, userRequest: UserRequestType) => Promise<{ success: boolean; accountId?: string }>;
//     logout: () => Promise<void>;
//     verifyOtp: (accountId: string, otpCode: string) => Promise<boolean>;
//     resendOtp: (accountId: string) => Promise<boolean>;
//     loginWithGoogle: () => Promise<void>;
//     authenticateWithGoogle: (code: string) => Promise<string | null>;
//     setAccessToken: (token: string) => void;
//     setRefreshToken: (token: string) => void;
//     setAccount: (account: AccountResponseType) => void;
//     clearAuth: () => void;
// }

// const useAuthStore = create<AuthStoreState>((set, get) => ({
//     account: null,
//     accessToken: null,
//     loading: false,
//     isAuthenticated: false,
//     refreshToken: null,

//     setAccount: (account: AccountResponseType) => {
//         set({ account });
//     },

//     setRefreshToken: (token: string) => {
//         set({ refreshToken: token });
//     },

//     // Set access token and update axios config
//     setAccessToken: (token: string) => {
//         set({ accessToken: token, isAuthenticated: true });
//     },

//     // Clear authentication
//     clearAuth: () => {
//         set({ accessToken: null, isAuthenticated: false, refreshToken: null, account: null });
//     },

//     // Login with email/password
//     login: async (email: string, password: string) => {
//         try {
//             set({ loading: true });
//             const response = await authService.login({ email, password });

//             if (response.code === 1000 && response.data) {
//                 const { accessToken, refreshToken } = response.data;
//                 set({ accessToken: accessToken, refreshToken: refreshToken, isAuthenticated: true });
//                 if (typeof window !== "undefined") {
//                     localStorage.setItem('accessToken', accessToken);
//                 }
//                 // Valid token and get account info
//                 const responseIntrospectToken = await authService.introspectToken(accessToken);
//                 if (responseIntrospectToken.data) {
//                     set({ account: responseIntrospectToken.data?.account || null });
//                 }
//                 return true;
//             } else {
//                 return false;
//             }
//         } catch {
//             return false;
//         } finally {
//             set({ loading: false });
//         }
//     },

//     // Register new account
//     register: async (email: string, password: string, phoneNumber: string, userRequest: { fullName: string; dateOfBirth: Date; gender: string; }) => {
//         set({ loading: true });
//         const response = await authService.register({
//             email,
//             password,
//             phoneNumber,
//             userRequest
//         });

//         if (response.data) {
//             set({ loading: false });
//             return {
//                 success: true,
//                 accountId: response.data.accountId
//             };
//         } else {
//             set({ loading: false });
//             return { success: false };
//         }


//     },

//     // Verify OTP
//     verifyOtp: async (accountId: string, otpCode: string) => {
//         try {
//             set({ loading: true });
//             const response = await authService.verifyOtp(accountId, otpCode);

//             if (response.data) {
//                 toast.success('Xác thực thành công! Bạn có thể đăng nhập ngay bây giờ.');
//                 return true;
//             } else {
//                 toast.error(response.message || 'Mã OTP không chính xác!');
//                 return false;
//             }
//         } catch {
//             toast.error('Xác thực thất bại! Vui lòng kiểm tra lại mã OTP.');
//             return false;
//         } finally {
//             set({ loading: false });
//         }
//     },

//     // Resend OTP
//     resendOtp: async (accountId: string) => {
//         try {
//             set({ loading: true });
//             const response = await authService.resendOtp(accountId);
//             if (response.code === 1000) {
//                 return true;
//             } else {
//                 return false;
//             }
//         } catch {
//             return false;
//         } finally {
//             set({ loading: false });
//         }
//     },

//     // Get Google OAuth URL and redirect
//     loginWithGoogle: async () => {
//         try {
//             const response = await authService.getGoogleOAuthUrl();
//             if (response.data?.url) {
//                 window.location.href = response.data.url;
//             } else {
//                 toast.error('Không thể kết nối đến Google. Vui lòng thử lại.');
//             }
//         } catch {
//             toast.error('Không thể đăng nhập với Google. Vui lòng thử lại.');
//         }
//     },

//     // Authenticate with Google OAuth code
//     authenticateWithGoogle: async (code: string) => {
//         try {
//             set({ loading: true });
//             const response = await authService.authenticateWithGoogle(code);
//             if (response.code === 1000 && response.data) {
//                 const { accessToken, refreshToken } = response.data;
//                 set({ accessToken: accessToken, refreshToken: refreshToken, isAuthenticated: true });
//                 // Valid token and get account info
//                 const responseIntrospectToken = await authService.introspectToken(accessToken);
//                 if (responseIntrospectToken.data) {
//                     set({ account: responseIntrospectToken.data?.account || null });
//                 }

//                 return accessToken;
//             } else {
//                 return null;
//             }
//         } catch {
//             return null;
//         } finally {
//             set({ loading: false });
//         }
//     },

//     // Logout
//     logout: async () => {
//         try {
//             const { accessToken } = get();
//             if (accessToken) {
//                 await authService.logout(accessToken);
//                 localStorage.removeItem("accessToken");
//                 toast.success("Đăng xuất thành công!")
//                 get().clearAuth();
//             }
//         } catch {
//             toast.error("Đăng xuất không thành công!")
//             get().clearAuth();
//         }
//     }
// }));

// export default useAuthStore;
