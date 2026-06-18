import { create } from 'zustand';

import { apiGet, apiPatch } from '../services/api';

export const DEFAULT_WIDGETS: Record<string, boolean> = {
  today: true,
  workout: true,
  calendar: true,
  streak: false,
  note: true,
};
export const DEFAULT_NOTIFS: Record<string, boolean> = {
  tasks: true,
  workout: true,
  rest: true,
  weekly: false,
};

type State = {
  widgets: Record<string, boolean>;
  notifs: Record<string, boolean>;
  accent: string | null;
  loaded: boolean;
  load: () => Promise<{ accent: string | null }>;
  setWidget: (key: string, on: boolean) => void;
  setNotif: (key: string, on: boolean) => void;
  pushAccent: (hex: string) => void;
};

const persist = (s: { accent: string | null; widgets: Record<string, boolean>; notifs: Record<string, boolean> }) =>
  apiPatch('/settings/', {
    ...(s.accent ? { accent: s.accent } : {}),
    widgets: s.widgets,
    notifications: s.notifs,
  }).catch(() => {});

export const useSettings = create<State>((set, get) => ({
  widgets: DEFAULT_WIDGETS,
  notifs: DEFAULT_NOTIFS,
  accent: null,
  loaded: false,

  load: async () => {
    try {
      const r = await apiGet<any>('/settings/');
      const widgets = { ...DEFAULT_WIDGETS, ...(r.widgets ?? {}) };
      const notifs = { ...DEFAULT_NOTIFS, ...(r.notifications ?? {}) };
      set({ widgets, notifs, accent: r.accent ?? null, loaded: true });
      return { accent: r.accent ?? null };
    } catch {
      set({ loaded: true });
      return { accent: null };
    }
  },

  setWidget: (key, on) => {
    const widgets = { ...get().widgets, [key]: on };
    set({ widgets });
    persist({ accent: get().accent, widgets, notifs: get().notifs });
  },

  setNotif: (key, on) => {
    const notifs = { ...get().notifs, [key]: on };
    set({ notifs });
    persist({ accent: get().accent, widgets: get().widgets, notifs });
  },

  pushAccent: (hex) => {
    set({ accent: hex });
    persist({ accent: hex, widgets: get().widgets, notifs: get().notifs });
  },
}));
