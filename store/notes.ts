import { create } from 'zustand';

import { Note } from '../components/NoteSheet';
import { apiDelete, apiGet, apiPatch, apiPost } from '../services/api';

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

const toApi = (n: Note) => ({ title: n.title, body: n.body, tag: n.tag, tag_color: n.tagColor, pinned: n.pinned });
const fromApi = (r: any): Note => ({
  id: String(r.id),
  title: r.title,
  body: r.body,
  tag: r.tag,
  tagColor: r.tag_color,
  pinned: r.pinned,
  date: fmtDate(r.updated_at ?? r.created_at),
});

type State = {
  notes: Note[];
  loaded: boolean;
  load: () => Promise<void>;
  upsert: (n: Note) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const useNotes = create<State>((set, get) => ({
  notes: [],
  loaded: false,

  load: async () => {
    const rows = await apiGet<any[]>('/notes/');
    set({ notes: rows.map(fromApi), loaded: true });
  },

  upsert: async (n) => {
    const exists = get().notes.some((x) => x.id === n.id);
    if (exists) {
      set((s) => ({ notes: s.notes.map((x) => (x.id === n.id ? n : x)) }));
      await apiPatch(`/notes/${n.id}/`, toApi(n)).catch(() => {});
    } else {
      set((s) => ({ notes: [n, ...s.notes] }));
      try {
        const saved = fromApi(await apiPost('/notes/', toApi(n)));
        set((s) => ({ notes: s.notes.map((x) => (x.id === n.id ? saved : x)) }));
      } catch {}
    }
  },

  remove: async (id) => {
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
    await apiDelete(`/notes/${id}/`).catch(() => {});
  },
}));
