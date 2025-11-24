// 'use client'
// import useAuthStore from "@/hooks/useAuthStore";
// import { usePathname, useRouter } from "next/navigation";
// import { useEffect } from "react";
// import axios from "axios";
// import { ADMIN_PATH, CLIENT_PATH } from "@/constants/paths";
// import { authService } from "@/services/client/auth.service";
// import { RoleResponseType } from "@/schema/role.schema";

// export default function AuthProvider({ children }: { children: React.ReactNode }) {
//     const router = useRouter();
//     const pathname = usePathname();
//     const { clearAuth, setAccessToken, setAccount, account, setRefreshToken } = useAuthStore();
//     useEffect(() => {
//         const fetchAccount = async () => {
//             if (typeof window === "undefined") return;
//             const accessTokenFromLocalStorage = localStorage.getItem("accessToken") || "";
//             if (account !== null && accessTokenFromLocalStorage !== "") {
//                 return;
//             }
//             try {
//                 const res = await axios.post("/api/auth/token", { accessToken: accessTokenFromLocalStorage });
//                 if (res.status === 200 && res.data !== null) {
//                     console.log("Fetched account info:", res.data);
//                     const { accessToken, refreshToken, data } = res.data;
//                     const { account } = data;
//                     setAccessToken(accessToken);
//                     if (accessToken)
//                         localStorage.setItem("accessToken", accessToken);
//                     setRefreshToken(refreshToken);
//                     setAccount(account);
//                     if (pathname === CLIENT_PATH.AUTH) {
//                         router.replace(CLIENT_PATH.HOME);
//                     }

//                     if (account) {
//                         const hasUserRole = account.roles.some((role: RoleResponseType) => role.roleName === "USER");
//                         if (pathname === ADMIN_PATH.LOGIN) {
//                             if (hasUserRole) {
//                                 await authService.logout(accessTokenFromLocalStorage);
//                                 clearAuth();
//                                 localStorage.removeItem("accessToken");
//                                 router.replace(ADMIN_PATH.LOGIN);
//                             }
//                             else {
//                                 router.replace(ADMIN_PATH.DASHBOARD);
//                             }
//                         }
//                         if (pathname.startsWith("/admin") && hasUserRole) {
//                             await authService.logout(accessTokenFromLocalStorage);
//                             clearAuth();
//                             localStorage.removeItem("accessToken");
//                             router.replace(ADMIN_PATH.LOGIN);
//                         }
//                     }

//                     if (pathname === ADMIN_PATH.LOGIN) {
//                         router.replace(ADMIN_PATH.DASHBOARD);
//                     }


//                 }
//                 else {
//                     localStorage.removeItem("accessToken");
//                     clearAuth();
//                     if (pathname.startsWith("/admin")) {
//                         router.replace(ADMIN_PATH.LOGIN);
//                         return;
//                     }
//                 }
//             } catch {
//                 clearAuth();
//                 localStorage.removeItem("accessToken");
//                 if (pathname.startsWith("/admin")) {
//                     router.replace(ADMIN_PATH.LOGIN);
//                     return;
//                 }
//             }
//         };
//         fetchAccount();
//     }, [router, pathname, clearAuth, setAccessToken, setAccount, setRefreshToken, account]);

//     return <>{children}</>;
// }