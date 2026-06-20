import { create } from 'zustand';

import { syncReminders } from '../lib/reminders';
import { apiGet, apiPatch } from '../services/api';
import { useTasks } from './tasks';

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
  learning: true,
  weekly: false,
};

export const REST_OPTIONS = [60, 90, 120, 180];
export const DEFAULT_REST = 90;
export const PROGRESS_OPTIONS = [7, 14, 30]; // days
export const DEFAULT_PROGRESS = 14;

type State = {
  widgets: Record<string, boolean>;
  notifs: Record<string, boolean>;
  accent: string | null;
  restSeconds: number;
  progressDays: number;
  loaded: boolean;
  load: () => Promise<{ accent: string | null }>;
  setWidget: (key: string, on: boolean) => void;
  setNotif: (key: string, on: boolean) => void;
  setRest: (seconds: number) => void;
  setProgress: (days: number) => void;
  pushAccent: (hex: string) => void;
};

const persist = (s: { accent: string | null; widgets: Record<string, boolean>; notifs: Record<string, boolean>; restSeconds: number; progressDays: number }) =>
  apiPatch('/settings/', {
    ...(s.accent ? { accent: s.accent } : {}),
    widgets: s.widgets,
    notifications: s.notifs,
    rest_seconds: s.restSeconds,
    progress_days: s.progressDays,
  }).catch(() => {});

export const useSettings = create<State>((set, get) => ({
  widgets: DEFAULT_WIDGETS,
  notifs: DEFAULT_NOTIFS,
  accent: null,
  restSeconds: DEFAULT_REST,
  progressDays: DEFAULT_PROGRESS,
  loaded: false,

  load: async () => {
    try {
      const r = await apiGet<any>('/settings/');
      const widgets = { ...DEFAULT_WIDGETS, ...(r.widgets ?? {}) };
      const notifs = { ...DEFAULT_NOTIFS, ...(r.notifications ?? {}) };
      set({ widgets, notifs, accent: r.accent ?? null, restSeconds: r.rest_seconds ?? DEFAULT_REST, progressDays: r.progress_days ?? DEFAULT_PROGRESS, loaded: true });
      return { accent: r.accent ?? null };
    } catch {
      set({ loaded: true });
      return { accent: null };
    }
  },

  setWidget: (key, on) => {
    const widgets = { ...get().widgets, [key]: on };
    set({ widgets });
    persist({ accent: get().accent, widgets, notifs: get().notifs, restSeconds: get().restSeconds, progressDays: get().progressDays });
  },

  setNotif: (key, on) => {
    const notifs = { ...get().notifs, [key]: on };
    set({ notifs });
    persist({ accent: get().accent, widgets: get().widgets, notifs, restSeconds: get().restSeconds, progressDays: get().progressDays });
    // reschedule device reminders to match the new toggles
    syncReminders(useTasks.getState().tasks, notifs).catch(() => {});
  },

  setRest: (seconds) => {
    set({ restSeconds: seconds });
    persist({ accent: get().accent, widgets: get().widgets, notifs: get().notifs, restSeconds: seconds, progressDays: get().progressDays });
  },

  setProgress: (days) => {
    set({ progressDays: days });
    persist({ accent: get().accent, widgets: get().widgets, notifs: get().notifs, restSeconds: get().restSeconds, progressDays: days });
  },

  pushAccent: (hex) => {
    set({ accent: hex });
    persist({ accent: hex, widgets: get().widgets, notifs: get().notifs, restSeconds: get().restSeconds, progressDays: get().progressDays });
  },
}));
