import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const TOKEN_KEY = 'erp_access_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Dev runs behind the Vite proxy (relative path); prod points straight
// at the deployed backend origin since frontend and backend are hosted
// separately (Vercel + Render).
export const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

/** Absolute URL for a backend-served asset path like "uploads/logo-x.jpg". */
export function assetUrl(path: string): string {
  return `${API_BASE}/${path.replace(/^\/+/, '')}`;
}

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  refreshPromise ??= axios
    .post(`${API_BASE}/auth/refresh`, null, { withCredentials: true })
    .then((res) => {
      const token: string = res.data.data.accessToken;
      setToken(token);
      return token;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retried?: boolean;
    };
    const isAuthPath =
      original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !original?._retried && !isAuthPath) {
      original._retried = true;
      try {
        const token = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        setToken(null);
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);
