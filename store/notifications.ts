import { create } from 'zustand';

import { apiDelete, apiGet, apiPatch, apiPost } from '../services/api';
import { NotifKind } from '../services/notifications';

export type Notif = {
  id: string;
  title: string;
  body: string;
  kind: NotifKind;
  read: boolean;
  createdAt: string;
};

const fromApi = (r: any): Notif => ({
  id: String(r.id),
  title: r.title,
  body: r.body,
  kind: r.kind,
  read: r.read,
  createdAt: r.created_at,
});

type State = {
  items: Notif[];
  loaded: boolean;
  unread: () => number;
  load: () => Promise<void>;
  add: (title: string, body: string, kind: NotifKind, at?: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clear: () => Promise<void>;
};

export const useNotifications = create<State>((set, get) => ({
  items: [],
  loaded: false,

  unread: () => get().items.filter((n) => !n.read).length,

  load: async () => {
    const rows = await apiGet<any[]>('/notifications/');
    set({ items: rows.map(fromApi), loaded: true });
  },

  add: async (title, body, kind, at) => {
    const temp: Notif = { id: `tmp-${Date.now()}-${Math.random()}`, title, body, kind, read: false, createdAt: at ?? new Date().toISOString() };
    // newest first, by the time it fired
    set((s) => ({ items: [temp, ...s.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }));
    try {
      const saved = fromApi(await apiPost('/notifications/', { title, body, kind, ...(at ? { at } : {}) }));
      set((s) => ({ items: s.items.map((n) => (n.id === temp.id ? saved : n)) }));
    } catch {}
  },

  remove: async (id) => {
    set((s) => ({ items: s.items.filter((n) => n.id !== id) }));
    if (!id.startsWith('tmp-')) await apiDelete(`/notifications/${id}/`).catch(() => {});
  },

  markRead: async (id) => {
    set((s) => ({ items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
    await apiPatch(`/notifications/${id}/`, { read: true }).catch(() => {});
  },

  markAllRead: async () => {
    set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })) }));
    await apiPost('/notifications/read_all/', {}).catch(() => {});
  },

  clear: async () => {
    set({ items: [] });
    await apiPost('/notifications/clear/', {}).catch(() => {});
  },
}));
