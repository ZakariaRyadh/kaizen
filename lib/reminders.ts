import { cancelAll, ensurePermission, scheduleAt, scheduleDaily, scheduleWeekly } from '../services/notifications';
import { TODAY } from '../store/tasks';
import type { Task } from '../theme/tags';

// notification toggles from settings; undefined => on by default
type Notifs = Record<string, boolean>;
const on = (n: Notifs, k: string) => n[k] !== false;

// "09:00" -> {h:9, m:0}; returns null for "All day"/blank/garbage
function parseTime(t: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

/**
 * Reschedule every device reminder from scratch based on current tasks + toggles.
 * Call on launch and whenever tasks/settings change.
 */
export async function syncReminders(tasks: Task[], notifs: Notifs): Promise<void> {
  const granted = await ensurePermission();
  if (!granted) return;

  await cancelAll(); // wipe previous schedule, then rebuild

  // ---- task reminders: fire at each timed, unfinished task today ----
  if (on(notifs, 'tasks')) {
    for (const t of tasks) {
      if (t.date !== TODAY || t.done) continue;
      const hm = parseTime(t.time);
      if (!hm) continue;
      const when = new Date();
      when.setHours(hm.h, hm.m, 0, 0);
      await scheduleAt({ title: t.title, body: `Due now${t.tag ? ` · ${t.tag}` : ''}`, kind: 'task' }, when);
    }
  }

  // ---- daily workout nudge (17:00) ----
  if (on(notifs, 'workout')) {
    await scheduleDaily({ title: 'Workout time', body: 'Time to train. Open the Gym tab.', kind: 'workout' }, 17, 0);
  }

  // ---- daily learning nudge (19:30) ----
  if (on(notifs, 'learning')) {
    await scheduleDaily({ title: 'Learn something', body: 'Start a study session or pick a saved idea.', kind: 'learning' }, 19, 30);
  }

  // ---- weekly summary (Sunday 18:00; weekday 1 = Sunday) ----
  if (on(notifs, 'weekly')) {
    await scheduleWeekly({ title: 'Weekly recap', body: "Review the week and plan what's next.", kind: 'weekly' }, 1, 18, 0);
  }
}
