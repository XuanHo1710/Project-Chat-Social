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
    timeout: 10000,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

const isAuthEndpoint = (url?: string) => {
    if (!url) return false;
    return (
        url.includes("/auth/login") ||
        url.includes("/auth/signup") ||
        url.includes("/auth/refresh-token") ||
        url.includes("/auth/password/")
    );
};

let isRefreshing = false;
let refreshQueue: {
    resolve: (value?: unknown) => void;
    reject: (error: unknown) => void;
}[] = [];

const processRefreshQueue = (error: unknown, token: string | null = null) => {
    refreshQueue.forEach((prom) => {
        if (error) prom.reject(error);
        else prom.resolve(token);
    });
    refreshQueue = [];
};

let isBootstrappingToken = false;
let bootstrapQueue: {
    resolve: (value: string | PromiseLike<string | null> | null) => void;
    reject: (error: unknown) => void;
}[] = [];

const processBootstrapQueue = (error: unknown, token: string | null = null) => {
    bootstrapQueue.forEach((prom) => {
        if (error) prom.reject(error);
        else prom.resolve(token);
    });
    bootstrapQueue = [];
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

    if (isBootstrappingToken) {
        return new Promise((resolve, reject) => {
            bootstrapQueue.push({ resolve, reject });
        });
    }

    isBootstrappingToken = true;
    try {
        const response = await axios.post("/api/auth/token");
        const accessToken = response?.data?.accessToken as string | undefined;
        const account = response?.data?.data?.account;

        if (!accessToken) {
            processBootstrapQueue(new Error("No access token"), null);
            return null;
        }

        useAuthStore.setState({
            accessToken,
            user: mapAccountToStoreUser(account),
        });

        processBootstrapQueue(null, accessToken);
        return accessToken;
    } catch (err) {
        processBootstrapQueue(err, null);
        return null;
    } finally {
        isBootstrappingToken = false;
    }
};

instance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
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

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    refreshQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        if (originalRequest.headers && token) {
                            originalRequest.headers.Authorization = `Bearer ${token}`;
                        }
                        return instance(originalRequest);
                    })
                    .catch((err) => Promise.reject(err));
            }

            isRefreshing = true;
            try {
                const response = await axios.post("/api/auth/token");
                const accessToken = response?.data?.accessToken as string | undefined;
                const account = response?.data?.data?.account;

                if (!accessToken) {
                    throw new Error("Refresh failed");
                }

                useAuthStore.setState({
                    accessToken,
                    user: mapAccountToStoreUser(account),
                });

                processRefreshQueue(null, accessToken);

                if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                }
                return instance(originalRequest);
            } catch (err) {
                processRefreshQueue(err, null);
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
            } finally {
                isRefreshing = false;
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

export default instance;
export { instance as adminAxios, instance as publicAxios };
