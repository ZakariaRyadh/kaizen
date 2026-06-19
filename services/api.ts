import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './storage';

// Hosted Django backend on Render (works from any network).
// For local dev against your own machine, swap to your LAN IP, e.g.
//   'http://192.168.1.11:8000/api'
export const BASE_URL = 'https://daily-tracker-api-pzxf.onrender.com/api';

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

export const getMe = () => request<{ id: number; email: string; display_name: string }>('GET', '/auth/me/');

// ── generic CRUD (used later to sync tasks/notes/etc) ──
export const apiGet = <T>(path: string) => request<T>('GET', path);
export const apiPost = <T>(path: string, body: object) => request<T>('POST', path, body);
export const apiPatch = <T>(path: string, body: object) => request<T>('PATCH', path, body);
export const apiDelete = (path: string) => request<void>('DELETE', path);
