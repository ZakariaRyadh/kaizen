import { create } from 'zustand';

import { apiDelete, apiGet, apiPatch, apiPost } from '../services/api';
import { Task } from '../theme/tags';

// The app's "today" — the real device date, computed once at launch.
const _pad = (n: number) => String(n).padStart(2, '0');
const _now = new Date();
export const YEAR = _now.getFullYear();
export const MONTH = _now.getMonth();              // 0-indexed
export const TODAY_DAY = _now.getDate();
export const MONTH_NAME = _now.toLocaleString('default', { month: 'long' });
export const TODAY = `${YEAR}-${_pad(MONTH + 1)}-${_pad(TODAY_DAY)}`;

// 'YYYY-MM-DD' for a day number in the current month (used by Calendar).
export const dateOf = (day: number) => `${YEAR}-${_pad(MONTH + 1)}-${_pad(day)}`;

// map between mobile Task and the Django Task JSON
const toApi = (t: Task) => ({
  title: t.title,
  time: t.time,
  tag: t.tag,
  tag_color: t.tagColor,
  repeat: t.repeat,
  done: t.done,
  due_date: t.date,
});
const fromApi = (r: any): Task => ({
  id: String(r.id),
  title: r.title,
  time: r.time,
  tag: r.tag,
  tagColor: r.tag_color,
  repeat: r.repeat,
  done: r.done,
  date: r.due_date ?? TODAY,
});

type State = {
  tasks: Task[];
  loaded: boolean;
  load: () => Promise<void>;
  upsert: (t: Task) => Promise<void>;
  remove: (id: string) => Promise<void>;
  toggle: (id: string) => Promise<void>;
  setTasks: (tasks: Task[]) => void; // local-only reorder
};

export const useTasks = create<State>((set, get) => ({
  tasks: [],
  loaded: false,

  load: async () => {
    const rows = await apiGet<any[]>('/tasks/');
    set({ tasks: rows.map(fromApi), loaded: true });
  },

  // create or update — optimistic, then reconcile the server id on create
  upsert: async (t) => {
    const exists = get().tasks.some((x) => x.id === t.id);
    if (exists) {
      set((s) => ({ tasks: s.tasks.map((x) => (x.id === t.id ? t : x)) }));
      await apiPatch(`/tasks/${t.id}/`, toApi(t)).catch(() => {});
    } else {
      set((s) => ({ tasks: [...s.tasks, t] }));
      try {
        const saved = fromApi(await apiPost('/tasks/', toApi(t)));
        set((s) => ({ tasks: s.tasks.map((x) => (x.id === t.id ? saved : x)) }));
      } catch {}
    }
  },

  remove: async (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    await apiDelete(`/tasks/${id}/`).catch(() => {});
  },

  toggle: async (id) => {
    const t = get().tasks.find((x) => x.id === id);
    if (!t) return;
    const next = { ...t, done: !t.done };
    set((s) => ({ tasks: s.tasks.map((x) => (x.id === id ? next : x)) }));
    await apiPatch(`/tasks/${id}/`, { done: next.done }).catch(() => {});
  },

  setTasks: (tasks) => set({ tasks }),
}));
