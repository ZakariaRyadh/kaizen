import { create } from 'zustand';

import { apiDelete, apiGet, apiPatch, apiPost } from '../services/api';
import { LoggedSession, Program, PROGRAMS } from '../theme/programs';
import { TODAY } from './tasks';

// ---- programs (nested days + exercises) ----
const programToApi = (p: Program) => ({
  name: p.name,
  meta: p.meta,
  days: p.days.map((d, i) => ({
    label: d.label,
    order: i,
    exercises: d.exercises.map((e, j) => ({
      name: e.name,
      sub: e.sub,
      sets: e.sets,
      reps: e.reps,
      weight: e.weight,
      is_pr: !!e.pr,
      order: j,
    })),
  })),
});
const programFromApi = (r: any): Program => ({
  id: String(r.id),
  name: r.name,
  meta: r.meta,
  days: (r.days ?? []).map((d: any) => ({
    label: d.label,
    exercises: (d.exercises ?? []).map((e: any) => ({
      name: e.name,
      sub: e.sub,
      sets: e.sets,
      reps: e.reps,
      weight: e.weight,
      pr: e.is_pr,
    })),
  })),
});

// ---- sessions ----
const daysBetween = (iso: string) =>
  Math.max(0, Math.round((new Date(TODAY).getTime() - new Date(iso).getTime()) / 86400000));
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const sessionToApi = (s: LoggedSession) => ({
  program_name: s.program,
  day_label: s.day,
  date: TODAY,
  duration_sec: s.durationSec,
  volume: s.volume,
  cardio: s.cardio,
  cardio_min: s.cardioMin,
});
const sessionFromApi = (r: any): LoggedSession => ({
  id: String(r.id),
  day: r.day_label,
  program: r.program_name,
  durationSec: r.duration_sec,
  volume: r.volume,
  cardio: r.cardio,
  cardioMin: r.cardio_min,
  date: daysBetween(r.date) === 0 ? 'Today' : fmtDate(r.date),
  daysAgo: daysBetween(r.date),
});

type State = {
  programs: Program[];
  sessions: LoggedSession[];
  loaded: boolean;
  load: () => Promise<void>;
  saveProgram: (p: Program) => Promise<void>;
  deleteProgram: (id: string) => Promise<void>;
  addSession: (s: LoggedSession) => Promise<void>;
};

export const useGym = create<State>((set, get) => ({
  programs: [],
  sessions: [],
  loaded: false,

  load: async () => {
    let rows = await apiGet<any[]>('/programs/');
    // brand-new account: seed the 3 starter splits so the screen isn't empty
    if (rows.length === 0) {
      for (const p of PROGRAMS) {
        await apiPost('/programs/', programToApi(p)).catch(() => {});
      }
      rows = await apiGet<any[]>('/programs/');
    }
    const sessions = await apiGet<any[]>('/sessions/');
    set({ programs: rows.map(programFromApi), sessions: sessions.map(sessionFromApi), loaded: true });
  },

  saveProgram: async (p) => {
    const exists = get().programs.some((x) => x.id === p.id);
    if (exists) {
      set((s) => ({ programs: s.programs.map((x) => (x.id === p.id ? p : x)) }));
      await apiPatch(`/programs/${p.id}/`, programToApi(p)).catch(() => {});
    } else {
      set((s) => ({ programs: [...s.programs, p] }));
      try {
        const saved = programFromApi(await apiPost('/programs/', programToApi(p)));
        set((s) => ({ programs: s.programs.map((x) => (x.id === p.id ? saved : x)) }));
      } catch {}
    }
  },

  deleteProgram: async (id) => {
    set((s) => ({ programs: s.programs.filter((p) => p.id !== id) }));
    await apiDelete(`/programs/${id}/`).catch(() => {});
  },

  addSession: async (s) => {
    set((st) => ({ sessions: [s, ...st.sessions] }));
    try {
      const saved = sessionFromApi(await apiPost('/sessions/', sessionToApi(s)));
      set((st) => ({ sessions: st.sessions.map((x) => (x.id === s.id ? saved : x)) }));
    } catch {}
  },
}));
