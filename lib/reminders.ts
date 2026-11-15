import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { AppState } from 'react-native';

import {
  ACTION_DONE,
  cancelReminder,
  ensurePermission,
  hasPermission,
  Notifications,
  Reminder,
  scheduledReminderIds,
  scheduleReminder,
} from '../services/notifications';
import { useGym } from '../store/gym';
import { useLearning } from '../store/learning';
import { useNotifications } from '../store/notifications';
import { useSettings } from '../store/settings';
import { useTasks } from '../store/tasks';
import { todayIso } from '../store/today';

/*
 * Reminder engine.
 * - plan(): every reminder for the next 7 days, from current data + settings.
 *   Each has a stable id, so a resync only cancels/adds what actually changed.
 * - sync(): diff the plan against what the OS has scheduled. Runs (debounced)
 *   whenever tasks, workouts, study sessions or notification settings change.
 * - catchUp(): reminders that fired (even with the app closed) are written to
 *   the in-app inbox once, with the time they fired.
 * - Taps open the right tab; "Mark done" on a task reminder ticks the task.
 */

const HORIZON_DAYS = 7;
const MAX_SCHEDULED = 60; // iOS keeps at most 64 pending; leave room for the rest timer
const PLAN_KEY = 'reminders:plan';
const LOGGED_KEY = 'reminders:logged';

const WORKOUT_AT = { h: 17, m: 0 };
const LEARNING_AT = { h: 19, m: 30 };
const WEEKLY_AT = { h: 18, m: 0, weekday: 0 }; // Sunday

// "9:30", "09:30", "9:30 pm", "9pm", "21h30" -> {h, m}; null for "All day"/blank
export function parseTime(t: string): { h: number; m: number } | null {
  const m = /^\s*(\d{1,2})(?:[:h.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\s*$/i.exec(t ?? '');
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3]?.toLowerCase().replace(/\./g, '');
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (ap === 'pm' && h !== 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
  }
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

const at = (iso: string, h: number, m: number) => {
  const [y, mo, d] = iso.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m, 0, 0).getTime();
};
const addDays = (iso: string, n: number) => {
  const [y, mo, d] = iso.split('-').map(Number);
  const x = new Date(y, mo - 1, d + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

function plan(): Reminder[] {
  const now = Date.now();
  const today = todayIso();
  const { notifs, taskLead } = useSettings.getState();
  const on = (k: string) => notifs[k] !== false;
  const out: Reminder[] = [];
  const days = Array.from({ length: HORIZON_DAYS }, (_, i) => addDays(today, i));
  const last = days[days.length - 1];

  if (on('tasks')) {
    for (const t of useTasks.getState().tasks) {
      if (t.done || t.date < today || t.date > last) continue;
      const hm = parseTime(t.time);
      if (!hm) continue;
      const when = at(t.date, hm.h, hm.m) - taskLead * 60_000;
      if (when <= now) continue;
      const left = t.subtasks.filter((s) => !s.done).length;
      const bits = [taskLead ? `In ${taskLead} min · ${t.time}` : `Due now · ${t.time}`];
      if (t.tag) bits.push(t.tag);
      if (left) bits.push(`${left} subtask${left > 1 ? 's' : ''} left`);
      out.push({ id: `task-${t.id}`, title: t.title, body: bits.join(' · '), kind: 'task', at: when, taskId: t.id });
    }
  }

  // daily nudges skip today once it's already done
  const trainedToday = useGym.getState().sessions.some((s) => s.daysAgo === 0);
  const studiedToday = useLearning.getState().sessions.some((s) => s.done && s.date === today);
  for (const [i, d] of days.entries()) {
    if (on('workout') && !(i === 0 && trainedToday)) {
      const when = at(d, WORKOUT_AT.h, WORKOUT_AT.m);
      if (when > now) out.push({ id: `workout-${d}`, title: 'Workout time', body: 'Time to train — tap to open Gym.', kind: 'workout', at: when });
    }
    if (on('learning') && !(i === 0 && studiedToday)) {
      const when = at(d, LEARNING_AT.h, LEARNING_AT.m);
      if (when > now) out.push({ id: `learning-${d}`, title: 'Learn something', body: 'Start a study session or pick a saved idea.', kind: 'learning', at: when });
    }
    if (on('weekly') && new Date(at(d, 12, 0)).getDay() === WEEKLY_AT.weekday) {
      const when = at(d, WEEKLY_AT.h, WEEKLY_AT.m);
      if (when > now) out.push({ id: `weekly-${d}`, title: 'Weekly recap', body: 'Tap to look back at your week and plan the next one.', kind: 'weekly', at: when });
    }
  }

  return out.sort((a, b) => a.at - b.at).slice(0, MAX_SCHEDULED);
}

const sig = (r: Reminder) => `${r.at}|${r.title}|${r.body}`;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Put reminders that already fired into the in-app inbox (once each). */
export async function catchUp(): Promise<void> {
  if (!(await hasPermission())) return; // they were never shown
  const prev = await readJson<Record<string, Reminder>>(PLAN_KEY, {});
  const logged = await readJson<Record<string, number>>(LOGGED_KEY, {});
  const now = Date.now();
  const due = Object.values(prev)
    .filter((r) => r.at <= now + 5_000 && r.at > now - 3 * 86_400_000 && !logged[`${r.id}@${r.at}`])
    .sort((a, b) => a.at - b.at);
  for (const r of due) {
    logged[`${r.id}@${r.at}`] = r.at;
    useNotifications.getState().add(r.title, r.body, r.kind, new Date(r.at).toISOString()).catch(() => {});
  }
  for (const [k, t] of Object.entries(logged)) if (t < now - 8 * 86_400_000) delete logged[k];
  await AsyncStorage.setItem(LOGGED_KEY, JSON.stringify(logged)).catch(() => {});
}

let syncing: Promise<void> | null = null;
let again = false;

/** Make the OS schedule match plan(). Safe to call often. */
export async function sync(): Promise<void> {
  if (syncing) {
    again = true;
    return syncing;
  }
  syncing = (async () => {
    try {
      if (!useTasks.getState().loaded || !useSettings.getState().loaded) return; // plan needs real data
      await catchUp(); // log what fired before the plan is replaced
      if (!(await ensurePermission())) return;
      const next = plan();
      const prev = await readJson<Record<string, Reminder>>(PLAN_KEY, {});
      const scheduled = new Set(await scheduledReminderIds());
      const wanted = new Set(next.map((r) => r.id));
      for (const id of scheduled) if (!wanted.has(id)) await cancelReminder(id);
      for (const r of next) {
        if (!scheduled.has(r.id) || !prev[r.id] || sig(prev[r.id]) !== sig(r)) await scheduleReminder(r);
      }
      await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(Object.fromEntries(next.map((r) => [r.id, r])))).catch(() => {});
    } catch {
      // never let reminders break the app
    } finally {
      syncing = null;
      if (again) {
        again = false;
        sync();
      }
    }
  })();
  return syncing;
}

let timer: ReturnType<typeof setTimeout> | null = null;
/** Debounced sync, for "something changed" events. */
export function requestSync(delay = 700) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    sync();
  }, delay);
}

// ---------------- taps + actions ----------------
const ROUTE: Record<string, string> = { task: '/', workout: '/gym', rest: '/gym', 'rest-live': '/gym', learning: '/learn', weekly: '/' };
let handled = new Set<string>();

async function handleResponse(res: Notifications.NotificationResponse) {
  const key = `${res.notification.request.identifier}@${res.notification.date}@${res.actionIdentifier}`;
  if (handled.has(key)) return;
  handled.add(key);
  const data = res.notification.request.content.data ?? {};
  const kind = String(data.kind ?? '');
  Notifications.dismissNotificationAsync(res.notification.request.identifier).catch(() => {});

  if (res.actionIdentifier === ACTION_DONE && data.taskId) {
    const tasks = useTasks.getState();
    if (!tasks.loaded) await tasks.load().catch(() => {});
    const t = useTasks.getState().tasks.find((x) => x.id === String(data.taskId));
    if (t && !t.done) await useTasks.getState().toggle(t.id);
  }
  const path = ROUTE[kind];
  if (path) router.navigate(path as any);
}

/**
 * Start the engine (call once from the logged-in layout). Returns a cleanup fn.
 * Resyncs when data/settings change and when the app comes back to the front.
 */
export function startReminders(): () => void {
  handled = new Set();
  const subs = [
    useTasks.subscribe((s, p) => {
      if (s.tasks !== p.tasks || s.loaded !== p.loaded) requestSync();
    }),
    useGym.subscribe((s, p) => {
      if (s.sessions !== p.sessions) requestSync();
    }),
    useLearning.subscribe((s, p) => {
      if (s.sessions !== p.sessions) requestSync();
    }),
    useSettings.subscribe((s, p) => {
      if (s.notifs !== p.notifs || s.taskLead !== p.taskLead || s.loaded !== p.loaded) requestSync(200);
    }),
  ];
  const app = AppState.addEventListener('change', (st) => {
    if (st === 'active') requestSync(300); // also rolls the 7-day window forward
  });
  // a reminder arrived while the app is open → log it now
  const received = Notifications.addNotificationReceivedListener((n) => {
    const kind = n.request.content.data?.kind;
    if (kind !== 'rest' && kind !== 'rest-live') setTimeout(() => catchUp(), 1_000);
  });
  const response = Notifications.addNotificationResponseReceivedListener((r) => handleResponse(r));
  // app was opened by tapping a notification
  Notifications.getLastNotificationResponseAsync()
    .then((r) => {
      if (r && Date.now() - r.notification.date < 60_000) handleResponse(r);
    })
    .catch(() => {});
  requestSync(0);

  return () => {
    subs.forEach((u) => u());
    app.remove();
    received.remove();
    response.remove();
  };
}

/** Logout: forget this account's plan + inbox log. */
export async function resetReminders(): Promise<void> {
  await AsyncStorage.multiRemove([PLAN_KEY, LOGGED_KEY]).catch(() => {});
}
