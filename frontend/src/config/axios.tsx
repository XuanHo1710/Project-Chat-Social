import { useAuthStore } from "@/stores/useAuthStore";
import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { toast } from "sonner";
// import useAuthStore from "../hooks/useAuthStore";

declare module "axios" {
  export interface AxiosRequestConfig {
    isSecure?: boolean; // Optional flag - defaults to false (public endpoint)
  }
}

const baseURL = process.env.NEXT_PUBLIC_BACKEND_API_URL;

const instance = axios.create({
  baseURL, // No /secure prefix here - will be added dynamically
  timeout: 10000,
  withCredentials: true, // Keep true for cookie support
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ Request interceptor: Add /secure prefix and token based on isSecure flag
instance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = typeof window !== "undefined" ? useAuthStore.getState().accessToken || "" : "";
    if (token && config.url !== "/auth/login" && config.url !== "/accounts/register") {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.isSecure && config.url) {
      config.url = `/secure${config.url}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// let isRefreshing = false;
let failedQueue: {
  resolve: (value?: unknown) => void;
  reject: (error: unknown) => void;
}[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

instance.interceptors.response.use(
  (response: AxiosResponse) => {
    // Return the full response (data will be extracted in service layer)
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // // 👉 Ẩn lỗi 401 trong lúc đang refresh token
    // if (error.response?.status === 401 && originalRequest.isSecure) {
    //   console.debug("Token expired, refreshing...");
    //   // Không console.error nữa
    // } else if (error.response?.status === 500 && originalRequest.isSecure) {
    //   console.debug("Temporary 500 while refreshing, ignore.");
    // } else {
    //   // Chỉ log các lỗi thực sự quan trọng
    //   console.error("Request error:", error);
    // }

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as {
        message: string;
        code: number;
        data?: unknown;
      };

      // // 🔄 Nếu accessToken hết hạn → refresh (only for secure endpoints)
      // if (
      //   status === 401 &&
      //   !originalRequest._retry &&
      //   originalRequest.isSecure
      // ) {
      //   originalRequest._retry = true;

      //   if (isRefreshing) {
      //     return new Promise((resolve, reject) => {
      //       failedQueue.push({ resolve, reject });
      //     })
      //       .then((token) => {
      //         if (originalRequest.headers) {
      //           originalRequest.headers["Authorization"] = `Bearer ${token}`;
      //         }
      //         return instance(originalRequest);
      //       })
      //       .catch((err) => Promise.reject(err));
      //   }

      //   isRefreshing = true;

      //   try {
      //     // const refreshToken = useAuthStore.getState().refreshToken;
      //     if (!refreshToken) {
      //       return;
      //     }

      //     // ✅ Gọi API refresh-token
      //     const response = await axios.post(
      //       `${baseURL}/auth/refresh`,
      //       { refreshToken: refreshToken }
      //     );


      //     if (!response.data?.data?.accessToken) {
      //       toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      //       return;
      //     }

      //     const newAccessToken = response.data.data.accessToken;
      //     localStorage.setItem("accessToken", newAccessToken);
      //     // useAuthStore.getState().setAccessToken(newAccessToken);

      //     // Gửi lại các request đang chờ
      //     processQueue(null, newAccessToken);

      //     if (originalRequest.headers) {
      //       originalRequest.headers[
      //         "Authorization"
      //       ] = `Bearer ${newAccessToken}`;
      //     }

      //     return instance(originalRequest);
      //   } catch (err) {
      //     processQueue(err, null);
      //     // useAuthStore.getState().clearAuth();
      //     toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      //     if (typeof window !== "undefined") {
      //       const pathname = window.location.pathname;
      //       localStorage.removeItem("accessToken");
      //       if (pathname.startsWith("/admin")) {
      //         window.location.href = ADMIN_PATH.LOGIN;
      //       } else {
      //         // window.location.href = CLIENT_PATH.AUTH;
      //       }
      //     }
      //     return Promise.reject(err);
      //   } finally {
      //     isRefreshing = false;
      //   }
      // }

      switch (status) {
        case 400:
          toast.error(
            Array.isArray(data.message) && data.message.length > 0
              ? data.message[0]
              : data.message || "Yêu cầu không hợp lệ (400)"
          );
          break;
        case 403:
          toast.error("Không có quyền truy cập (403)");
          break;
        case 404:
          toast.info("Không tìm thấy tài nguyên (404)");
          break;
        case 500:
          // toast.error("Lỗi máy chủ (500). Vui lòng thử lại sau.");
          break;
        default:
          toast.error(data.message || "Đã xảy ra lỗi không xác định");
      }
    } else if (error.request) {
      toast.error("Không thể kết nối đến máy chủ.");
    } else {
      toast.error("Lỗi khi gửi yêu cầu: " + error.message);
    }

    return Promise.reject(error);
  }
);

export default instance;

// ✅ Export legacy names for backward compatibility
export { instance as adminAxios, instance as publicAxios };
