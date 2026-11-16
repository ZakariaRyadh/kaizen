import { create } from 'zustand';

import { apiGet, apiPatch } from '../services/api';
import { TAG_PRESETS, TagDef } from '../theme/tags';

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
};

export const REST_OPTIONS = [60, 90, 120, 180];
export const DEFAULT_REST = 90;
export const PROGRESS_OPTIONS = [7, 14, 30]; // days
export const LEAD_OPTIONS = [0, 5, 15, 30]; // minutes before a task
export const DEFAULT_PROGRESS = 14;

type State = {
  widgets: Record<string, boolean>;
  notifs: Record<string, boolean>;
  accent: string | null;
  restSeconds: number;
  progressDays: number;
  taskLead: number;
  tags: TagDef[];
  loaded: boolean;
  load: () => Promise<{ accent: string | null }>;
  setWidget: (key: string, on: boolean) => void;
  setNotif: (key: string, on: boolean) => void;
  setRest: (seconds: number) => void;
  setProgress: (days: number) => void;
  setTaskLead: (min: number) => void;
  addTag: (tag: TagDef) => void;
  removeTag: (name: string) => void;
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
  taskLead: 0,
  tags: TAG_PRESETS,
  loaded: false,

  load: async () => {
    try {
      const r = await apiGet<any>('/settings/');
      const widgets = { ...DEFAULT_WIDGETS, ...(r.widgets ?? {}) };
      const notifs = { ...DEFAULT_NOTIFS, ...(r.notifications ?? {}) };
      set({ widgets, notifs, accent: r.accent ?? null, restSeconds: r.rest_seconds ?? DEFAULT_REST, progressDays: r.progress_days ?? DEFAULT_PROGRESS, taskLead: r.task_lead_min ?? 0, tags: Array.isArray(r.tags) ? r.tags : TAG_PRESETS, loaded: true });
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
  },

  setRest: (seconds) => {
    set({ restSeconds: seconds });
    persist({ accent: get().accent, widgets: get().widgets, notifs: get().notifs, restSeconds: seconds, progressDays: get().progressDays });
  },

  setProgress: (days) => {
    set({ progressDays: days });
    persist({ accent: get().accent, widgets: get().widgets, notifs: get().notifs, restSeconds: get().restSeconds, progressDays: days });
  },

  setTaskLead: (min) => {
    set({ taskLead: min });
    apiPatch('/settings/', { task_lead_min: min }).catch(() => {});
  },

  addTag: (tag) => {
    const name = tag.name.trim();
    if (!name || get().tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) return;
    const tags = [...get().tags, { name, color: tag.color }];
    set({ tags });
    apiPatch('/settings/', { tags }).catch(() => {});
  },

  removeTag: (name) => {
    const tags = get().tags.filter((t) => t.name !== name);
    set({ tags });
    apiPatch('/settings/', { tags }).catch(() => {});
  },

  pushAccent: (hex) => {
    set({ accent: hex });
    persist({ accent: hex, widgets: get().widgets, notifs: get().notifs, restSeconds: get().restSeconds, progressDays: get().progressDays });
  },
}));
