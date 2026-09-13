import { CLIENT_PATH } from "@/constants/paths";
import { useAuthStore } from "@/stores/useAuthStore";
import { UserLoginType } from "@/types/account";
import axios, {
    AxiosError,
    AxiosResponse,
    InternalAxiosRequestConfig,
} from "axios";
import { toast } from "sonner";

declare module "axios" {
    export interface AxiosRequestConfig {
        isSecure?: boolean;
    }
}

const baseURL = process.env.NEXT_PUBLIC_BACKEND_API_URL;

const instance = axios.create({
    baseURL,
    allowAbsoluteUrls: false,
    timeout: 10000,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

const isAuthEndpoint = (url?: string) => {
    if (!url) return false;
    const pathname = url.split("?")[0];
    return (
        pathname === "/auth/login" ||
        pathname === "/auth/signup" ||
        pathname.startsWith("/auth/google/") ||
        pathname === "/auth/refresh-token" ||
        pathname.startsWith("/auth/password/")
    );
};

const isAbsoluteOrProtocolRelativeUrl = (url?: string) =>
    !!url && (/^[a-z][a-z\d+.-]*:\/\//i.test(url) || url.startsWith("//"));

interface TokenEndpointResult {
    accessToken: string;
    account?: Record<string, unknown>;
}

let tokenRequestInFlight = false;
let tokenWaiters: {
    resolve: (value: TokenEndpointResult) => void;
    reject: (error: unknown) => void;
}[] = [];

const processTokenQueue = (error: unknown, result: TokenEndpointResult | null = null) => {
    tokenWaiters.forEach((prom) => {
        if (error) prom.reject(error);
        else prom.resolve(result as TokenEndpointResult);
    });
    tokenWaiters = [];
};

// Single-flight POST /api/auth/token shared by cold-start bootstrap and the
// 401-refresh handler, so a concurrent burst never fires two overlapping
// rotations. Uses bare axios (never `instance`), so the request interceptor
// is bypassed exactly as before — no re-entry deadlock.
const postTokenEndpoint = async (): Promise<TokenEndpointResult> => {
    if (tokenRequestInFlight) {
        return new Promise((resolve, reject) => {
            tokenWaiters.push({ resolve, reject });
        });
    }

    tokenRequestInFlight = true;
    try {
        const response = await axios.post("/api/auth/token");
        const accessToken = response?.data?.accessToken as string | undefined;
        const account = response?.data?.data?.account;

        if (!accessToken) {
            throw new Error("Token endpoint returned no access token");
        }

        const result = { accessToken, account };
        processTokenQueue(null, result);
        return result;
    } catch (err) {
        processTokenQueue(err, null);
        throw err;
    } finally {
        tokenRequestInFlight = false;
    }
};

const mapAccountToStoreUser = (
    account: Record<string, unknown> | null | undefined
): UserLoginType | null => {
    const currentUser = useAuthStore.getState().user;
    if (!account) return currentUser;

    const firstName = (account.firstName as string | undefined) || "";
    const lastName = (account.lastName as string | undefined) || "";
    const id =
        (account._id as string | undefined) ||
        (account.username as string | undefined) ||
        currentUser?.id;
    const username = (account.username as string | undefined) || currentUser?.username;

    if (!id || !username) {
        return currentUser;
    }

    return {
        id,
        username,
        fullName: ((account.fullname as string | undefined) || `${firstName} ${lastName}`).trim(),
        email: account.email as string | undefined,
        avatar: account.avatar as string | undefined,
        role: account.role as string | undefined,
        gender: account.gender as string | undefined,
    };
};

const ensureAccessToken = async (): Promise<string | null> => {
    const currentToken = useAuthStore.getState().accessToken;
    if (currentToken) return currentToken;

    try {
        const { accessToken, account } = await postTokenEndpoint();
        useAuthStore.setState({
            accessToken,
            user: mapAccountToStoreUser(account),
        });
        return accessToken;
    } catch {
        return null;
    }
};

instance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
        if (isAbsoluteOrProtocolRelativeUrl(config.url)) {
            return Promise.reject(
                new Error("Authenticated API requests must use a relative backend path")
            );
        }
        const token =
            typeof window !== "undefined" ? useAuthStore.getState().accessToken || "" : "";

        let finalToken = token;
        if (!finalToken && !isAuthEndpoint(config.url) && typeof window !== "undefined") {
            finalToken = (await ensureAccessToken()) || "";
        }

        if (finalToken && !isAuthEndpoint(config.url)) {
            config.headers.Authorization = `Bearer ${finalToken}`;
        }

        if (config.isSecure && config.url) {
            config.url = `/secure${config.url}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

instance.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
        if (axios.isCancel(error)) {
            return Promise.reject(error);
        }
        const originalRequest = error.config as InternalAxiosRequestConfig & {
            _retry?: boolean;
        };

        if (!error.response) {
            if (error.request) toast.error("Không thể kết nối đến máy chủ.");
            else toast.error("Lỗi khi gửi yêu cầu: " + error.message);
            return Promise.reject(error);
        }

        const status = error.response.status;
        const data = error.response.data as {
            message: string;
            code: number;
            data?: unknown;
        };

        if (status === 401 && !originalRequest?._retry && !isAuthEndpoint(originalRequest?.url)) {
            originalRequest._retry = true;

            if (tokenRequestInFlight) {
                return postTokenEndpoint()
                    .then(({ accessToken }) => {
                        if (originalRequest.headers && accessToken) {
                            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                        }
                        return instance(originalRequest);
                    })
                    .catch((err) => Promise.reject(err));
            }

            try {
                const { accessToken, account } = await postTokenEndpoint();

                useAuthStore.setState({
                    accessToken,
                    user: mapAccountToStoreUser(account),
                });

                if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                }
                return instance(originalRequest);
            } catch (err) {
                useAuthStore.setState({ accessToken: null, user: null });

                if (typeof window !== "undefined") {
                    const pathname = window.location.pathname;
                    const isAuthPage = pathname.startsWith("/auth");
                    if (!isAuthPage) {
                        toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
                        window.location.href = CLIENT_PATH.LOGIN;
                    }
                }

                return Promise.reject(err);
            }
        }

        switch (status) {
            case 400:
                toast.error(
                    Array.isArray(data.message) && data.message.length > 0
                        ? data.message[0]
                        : data.message || "Yêu cầu không hợp lệ (400)"
                );
                break;
            case 401:
                // Handled by refresh flow above; avoid noisy duplicate toast
                break;
            case 403:
                toast.error("Không có quyền truy cập (403)");
                break;
            case 404:
                toast.info("Không tìm thấy tài nguyên (404)");
                break;
            case 500:
                break;
            default:
                toast.error(data.message || "Đã xảy ra lỗi không xác định");
        }

        return Promise.reject(error);
    }
);

export { ensureAccessToken };

export function unwrap<T>(payload: unknown): T {    const envelope = payload as { data?: unknown } | null | undefined;
    if (
        envelope &&
        typeof envelope === "object" &&
        "data" in envelope &&
        envelope.data !== undefined
    ) {
        return envelope.data as T;
    }
    return payload as T;
}

export default instance;
