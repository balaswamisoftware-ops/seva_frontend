import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1',
  timeout: 15000,
});

// Attach access token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Refresh-token retry queue
let isRefreshing = false;
let queue: Array<(t: string | null) => void> = [];

const enqueue = () => new Promise<string | null>((resolve) => queue.push(resolve));
const flush = (token: string | null) => { queue.forEach((cb) => cb(token)); queue = []; };

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true;

      if (isRefreshing) {
        const token = await enqueue();
        if (!token) throw error;
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }

      isRefreshing = true;
      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          { refreshToken },
        );
        const newAccess = data.data.accessToken;
        const newRefresh = data.data.refreshToken;
        useAuthStore.getState().setTokens(newAccess, newRefresh);
        flush(newAccess);
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch (e) {
        flush(null);
        useAuthStore.getState().logout();
        if (location.pathname !== '/login') location.href = '/login';
        throw e;
      } finally {
        isRefreshing = false;
      }
    }
    throw error;
  },
);

export const unwrap = <T>(r: { data: { data: T } }) => r.data.data;
