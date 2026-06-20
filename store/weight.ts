import { create } from 'zustand';

import { apiDelete, apiGet, apiPost } from '../services/api';

export type Weight = { id: string; date: string; kg: number };

const fromApi = (r: any): Weight => ({ id: String(r.id), date: r.date, kg: r.kg });

type State = {
  weights: Weight[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (date: string, kg: number) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const useWeight = create<State>((set, get) => ({
  weights: [],
  loaded: false,

  load: async () => {
    const rows = await apiGet<any[]>('/weights/');
    set({ weights: rows.map(fromApi), loaded: true });
  },

  add: async (date, kg) => {
    const temp: Weight = { id: `tmp-${Date.now()}`, date, kg };
    set((s) => ({ weights: [temp, ...s.weights].sort((a, b) => b.date.localeCompare(a.date)) }));
    try {
      const saved = fromApi(await apiPost('/weights/', { date, kg }));
      set((s) => ({ weights: s.weights.map((w) => (w.id === temp.id ? saved : w)) }));
    } catch {}
  },

  remove: async (id) => {
    set((s) => ({ weights: s.weights.filter((w) => w.id !== id) }));
    await apiDelete(`/weights/${id}/`).catch(() => {});
  },
}));
