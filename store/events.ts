import { create } from 'zustand';

import { CalEvent, Priority } from '../components/EventSheet';
import { apiDelete, apiGet, apiPatch, apiPost } from '../services/api';
import { dateOf } from './tasks';

const toApi = (e: CalEvent) => ({
  title: e.title,
  date: dateOf(e.day),
  time: e.time,
  category_color: e.color,
  priority: e.priority,
});
const fromApi = (r: any): CalEvent => ({
  id: String(r.id),
  day: parseInt(String(r.date).split('-')[2], 10),
  time: r.time,
  title: r.title,
  color: r.category_color,
  priority: r.priority as Priority,
});

type State = {
  events: CalEvent[];
  loaded: boolean;
  load: () => Promise<void>;
  upsert: (e: CalEvent) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const useEvents = create<State>((set, get) => ({
  events: [],
  loaded: false,

  load: async () => {
    const rows = await apiGet<any[]>('/events/');
    set({ events: rows.map(fromApi), loaded: true });
  },

  upsert: async (e) => {
    const exists = get().events.some((x) => x.id === e.id);
    if (exists) {
      set((s) => ({ events: s.events.map((x) => (x.id === e.id ? e : x)) }));
      await apiPatch(`/events/${e.id}/`, toApi(e)).catch(() => {});
    } else {
      set((s) => ({ events: [...s.events, e] }));
      try {
        const saved = fromApi(await apiPost('/events/', toApi(e)));
        set((s) => ({ events: s.events.map((x) => (x.id === e.id ? saved : x)) }));
      } catch {}
    }
  },

  remove: async (id) => {
    set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
    await apiDelete(`/events/${id}/`).catch(() => {});
  },
}));
