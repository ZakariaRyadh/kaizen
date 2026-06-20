import { create } from 'zustand';

import { apiDelete, apiGet, apiPatch, apiPost } from '../services/api';
import { LoggedSession, Program, PROGRAMS, SetLog } from '../theme/programs';
import { TODAY } from './tasks';

// ---- programs (nested days + exercises) ----
const programToApi = (p: Program) => ({
  name: p.name,
  meta: p.meta,
  days: p.days.map((d, i) => ({
    label: d.label,
    order: i,
    is_cardio: !!d.isCardio,
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
  isActive: !!r.is_active,
  days: (r.days ?? []).map((d: any) => ({
    label: d.label,
    isCardio: !!d.is_cardio,
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

// ---- logged sets ----
const setLogFromApi = (r: any): SetLog => ({
  id: String(r.id),
  exercise: r.exercise,
  order: r.order,
  reps: r.reps,
  weight: r.weight,
  date: r.date,
  isPr: r.is_pr,
});

// one set the user is doing right now (client-side during a workout)
export type LiveSet = { reps: number; weight: number; done: boolean };

type State = {
  programs: Program[];
  sessions: LoggedSession[];
  setlogs: SetLog[];
  loaded: boolean;
  load: () => Promise<void>;
  saveProgram: (p: Program) => Promise<void>;
  deleteProgram: (id: string) => Promise<void>;
  setActiveProgram: (id: string) => Promise<void>;
  addSession: (s: LoggedSession) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  // log a full workout: a session + the sets done per exercise
  saveWorkout: (s: LoggedSession, sets: { exercise: string; reps: number; weight: number }[]) => Promise<void>;
  bestWeight: (exercise: string) => number;          // all-time best kg
  lastSets: (exercise: string) => SetLog[];          // most recent session's sets
};

export const useGym = create<State>((set, get) => ({
  programs: [],
  sessions: [],
  setlogs: [],
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
    const [sessions, setlogs] = await Promise.all([
      apiGet<any[]>('/sessions/'),
      apiGet<any[]>('/setlogs/'),
    ]);
    set({
      programs: rows.map(programFromApi),
      sessions: sessions.map(sessionFromApi),
      setlogs: setlogs.map(setLogFromApi),
      loaded: true,
    });
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

  setActiveProgram: async (id) => {
    set((s) => ({ programs: s.programs.map((p) => ({ ...p, isActive: p.id === id })) }));
    await apiPost(`/programs/${id}/set_active/`, {}).catch(() => {});
  },

  bestWeight: (exercise) =>
    get().setlogs.filter((s) => s.exercise === exercise).reduce((m, s) => Math.max(m, s.weight), 0),

  lastSets: (exercise) => {
    const rows = get().setlogs.filter((s) => s.exercise === exercise);
    if (rows.length === 0) return [];
    const lastDate = rows.reduce((d, s) => (s.date > d ? s.date : d), rows[0].date);
    return rows.filter((s) => s.date === lastDate).sort((a, b) => a.order - b.order);
  },

  saveWorkout: async (s, sets) => {
    // PR detection: a set is a PR if its weight beats the all-time best for that exercise
    const bestBefore: Record<string, number> = {};
    for (const sl of get().setlogs) {
      bestBefore[sl.exercise] = Math.max(bestBefore[sl.exercise] ?? 0, sl.weight);
    }
    const marked = sets.map((x, i) => {
      const pr = x.weight > (bestBefore[x.exercise] ?? 0);
      if (pr) bestBefore[x.exercise] = x.weight; // only the first to hit it counts
      return { ...x, order: i, isPr: pr };
    });

    // optimistic session
    set((st) => ({ sessions: [s, ...st.sessions] }));
    try {
      const savedSession = sessionFromApi(await apiPost('/sessions/', sessionToApi(s)));
      set((st) => ({ sessions: st.sessions.map((x) => (x.id === s.id ? savedSession : x)) }));
      // persist each set linked to the saved session
      const saved: SetLog[] = [];
      for (const m of marked) {
        try {
          const row = setLogFromApi(
            await apiPost('/setlogs/', {
              session: Number(savedSession.id),
              exercise: m.exercise,
              order: m.order,
              reps: m.reps,
              weight: m.weight,
              date: TODAY,
              is_pr: m.isPr,
            }),
          );
          saved.push(row);
        } catch {}
      }
      set((st) => ({ setlogs: [...saved, ...st.setlogs] }));
    } catch {}
  },

  addSession: async (s) => {
    set((st) => ({ sessions: [s, ...st.sessions] }));
    try {
      const saved = sessionFromApi(await apiPost('/sessions/', sessionToApi(s)));
      set((st) => ({ sessions: st.sessions.map((x) => (x.id === s.id ? saved : x)) }));
    } catch {}
  },

  deleteSession: async (id) => {
    set((st) => ({ sessions: st.sessions.filter((x) => x.id !== id) }));
    await apiDelete(`/sessions/${id}/`).catch(() => {});
  },
}));
