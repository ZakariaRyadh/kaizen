import { create } from 'zustand';

import { toast } from '../components/Dialog';
import { apiDelete, apiGet, apiPatch, apiPost } from '../services/api';
import { todayIso } from './today';

export type Subject = { id: string; name: string; color: string; createdAt: string };

export type LearnSession = {
  id: string;
  subjectId: string | null;
  subjectName: string;
  date: string;
  durationSec: number;
  goal: string;
  summary: string;
  done: boolean;
};

const subjectFromApi = (r: any): Subject => ({ id: String(r.id), name: r.name, color: r.color, createdAt: r.created_at });

const sessionFromApi = (r: any): LearnSession => ({
  id: String(r.id),
  subjectId: r.subject ? String(r.subject) : null,
  subjectName: r.subject_name,
  date: r.date,
  durationSec: r.duration_sec,
  goal: r.goal,
  summary: r.summary,
  done: r.done,
});

const sessionToApi = (s: Omit<LearnSession, 'id'>) => ({
  subject: s.subjectId ?? null,
  subject_name: s.subjectName ?? '',
  date: s.date ?? todayIso(),
  duration_sec: s.durationSec ?? 0,
  goal: s.goal ?? '',
  summary: s.summary ?? '',
  done: s.done ?? false,
});

// PATCH body with only the fields being changed (never blanks the others)
const patchToApi = (p: Partial<LearnSession>) => {
  const out: Record<string, unknown> = {};
  if (p.subjectId !== undefined) out.subject = p.subjectId;
  if (p.subjectName !== undefined) out.subject_name = p.subjectName;
  if (p.date !== undefined) out.date = p.date;
  if (p.durationSec !== undefined) out.duration_sec = p.durationSec;
  if (p.goal !== undefined) out.goal = p.goal;
  if (p.summary !== undefined) out.summary = p.summary;
  if (p.done !== undefined) out.done = p.done;
  return out;
};

type State = {
  subjects: Subject[];
  sessions: LearnSession[];
  loaded: boolean;
  load: () => Promise<void>;
  addSubject: (name: string, color: string) => Promise<Subject | null>;
  deleteSubject: (id: string) => Promise<void>;
  addSession: (s: Omit<LearnSession, 'id'>) => Promise<void>;
  updateSession: (id: string, patch: Partial<LearnSession>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
};

export const useLearning = create<State>((set, get) => ({
  subjects: [],
  sessions: [],
  loaded: false,

  load: async () => {
    const [subjects, sessions] = await Promise.all([
      apiGet<any[]>('/learning-subjects/'),
      apiGet<any[]>('/learning-sessions/'),
    ]);
    set({
      subjects: subjects.map(subjectFromApi),
      sessions: sessions.map(sessionFromApi),
      loaded: true,
    });
  },

  addSubject: async (name, color) => {
    try {
      const saved = subjectFromApi(await apiPost('/learning-subjects/', { name, color }));
      set((s) => ({ subjects: [...s.subjects, saved] }));
      return saved;
    } catch {
      return null;
    }
  },

  deleteSubject: async (id) => {
    set((s) => ({ subjects: s.subjects.filter((x) => x.id !== id) }));
    await apiDelete(`/learning-subjects/${id}/`).catch(() => {});
  },

  addSession: async (s) => {
    const temp: LearnSession = { id: `tmp-${Date.now()}`, ...s };
    set((st) => ({ sessions: [temp, ...st.sessions] }));
    try {
      const saved = sessionFromApi(await apiPost('/learning-sessions/', sessionToApi(s)));
      set((st) => ({ sessions: st.sessions.map((x) => (x.id === temp.id ? saved : x)) }));
    } catch {
      set((st) => ({ sessions: st.sessions.filter((x) => x.id !== temp.id) }));
      toast("Couldn't save — check your connection", 'error');
    }
  },

  updateSession: async (id, patch) => {
    set((st) => ({ sessions: st.sessions.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
    try {
      const saved = sessionFromApi(await apiPatch(`/learning-sessions/${id}/`, patchToApi(patch)));
      set((st) => ({ sessions: st.sessions.map((x) => (x.id === id ? saved : x)) }));
    } catch {}
  },

  deleteSession: async (id) => {
    set((st) => ({ sessions: st.sessions.filter((x) => x.id !== id) }));
    await apiDelete(`/learning-sessions/${id}/`).catch(() => {});
  },
}));
