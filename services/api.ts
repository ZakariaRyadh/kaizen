import Constants from 'expo-constants';

import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './storage';

// Deployed backend (used by real/production builds).
const PROD_URL = 'https://daily-tracker-api-pzxf.onrender.com/api';

// In Expo dev, talk to your LOCAL Django server. We read the dev machine's IP
// from Metro's host URI, so it works on any wifi without hardcoding an IP.
// (Local server: `python manage.py runserver 0.0.0.0:8000`)
function devUrl(): string {
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:8000/api` : PROD_URL;
}

// __DEV__ is true under `expo start`, false in a production build → auto-switch.
export const BASE_URL = __DEV__ ? devUrl() : PROD_URL;

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// refresh the access token once using the stored refresh token
async function tryRefresh(): Promise<boolean> {
  const refresh = await getRefreshToken();
  if (!refresh) return false;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.access) {
      await saveTokens(data.access, refresh);
      return true;
    }
  } catch {}
  return false;
}

async function request<T>(method: string, path: string, body?: object, auth = true, retried = false): Promise<T> {
  const headers = auth ? await authHeaders() : { 'Content-Type': 'application/json' };
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && auth && !retried) {
    if (await tryRefresh()) return request<T>(method, path, body, auth, true);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err === 'object' ? JSON.stringify(err) : String(err));
  }
  if (res.status === 204) return undefined as any;
  return res.json();
}

// ── Auth ──────────────────────────────────────────────
type Tokens = { access: string; refresh: string; user?: any };

export async function apiLogin(email: string, password: string) {
  const data = await request<Tokens>('POST', '/auth/login/', { email, password }, false);
  await saveTokens(data.access, data.refresh);
  return data;
}

export async function apiRegister(email: string, password: string, display_name: string) {
  await request('POST', '/auth/register/', { email, password, display_name }, false);
  return apiLogin(email, password); // auto-login after register
}

export async function apiLogout() {
  await clearTokens();
}

export const requestOTP = (email: string) =>
  request<{ message: string; dev_code?: string }>('POST', '/auth/request-otp/', { email }, false);

export const verifyOTP = (email: string, code: string, new_password: string) =>
  request<{ message: string }>('POST', '/auth/verify-otp/', { email, code, new_password }, false);

type MeResponse = { id: number; email: string; display_name: string; avatar?: string };

export const getMe = () => request<MeResponse>('GET', '/auth/me/');

export const updateMe = (display_name: string) =>
  request<MeResponse>('PATCH', '/auth/me/', { display_name });

export const updateAvatar = (avatar: string) =>
  request<MeResponse>('PATCH', '/auth/me/', { avatar });

export const changePassword = (current_password: string, new_password: string) =>
  request<{ message: string }>('POST', '/auth/change-password/', { current_password, new_password });

// ── generic CRUD (used later to sync tasks/notes/etc) ──
export const apiGet = <T>(path: string) => request<T>('GET', path);
export const apiPost = <T>(path: string, body: object) => request<T>('POST', path, body);
export const apiPatch = <T>(path: string, body: object) => request<T>('PATCH', path, body);
export const apiDelete = (path: string) => request<void>('DELETE', path);
