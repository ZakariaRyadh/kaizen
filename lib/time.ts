// Time helpers shared by tasks, events and reminders.
// Times are stored as 'HH:MM' (24h, zero-padded, so they sort as text) or 'All day'.

export const ALL_DAY = 'All day';

// "9:30", "09:30", "9:30 pm", "9pm", "21h30", "7.45" -> {h, m}; null for "All day"/blank
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

const pad = (n: number) => String(n).padStart(2, '0');
export const hhmm = (h: number, m: number) => `${pad(h)}:${pad(m)}`;

/** Old free-text times ("9:30 pm") -> 'HH:MM'; anything unparseable -> 'All day'. */
export function normalizeTime(t: string): string {
  const p = parseTime(t);
  return p ? hhmm(p.h, p.m) : ALL_DAY;
}

/** 'HH:MM' + minutes -> 'HH:MM' (wraps past midnight). */
export function addMinutes(time: string, minutes: number): string {
  const p = parseTime(time);
  if (!p) return time;
  const total = (p.h * 60 + p.m + minutes) % (24 * 60);
  return hhmm(Math.floor(total / 60), total % 60);
}

/** 90 -> '1h 30m', 45 -> '45m', 120 -> '2h'. */
export function fmtDuration(min: number): string {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

/** '09:00' + 90 -> '09:00–10:30'; 'All day' stays as is. */
export function fmtRange(time: string, durationMin = 0): string {
  if (!parseTime(time)) return time || ALL_DAY;
  return durationMin ? `${time}–${addMinutes(time, durationMin)}` : time;
}

/** [start, end) in minutes of the day, or null for all-day. */
export function span(time: string, durationMin = 0): [number, number] | null {
  const p = parseTime(time);
  if (!p) return null;
  const start = p.h * 60 + p.m;
  return [start, start + Math.max(durationMin, 1)];
}

/** Next round half hour from now, e.g. 14:10 -> '14:30'. */
export function nextHalfHour(): string {
  const d = new Date();
  const total = Math.min(23 * 60 + 30, Math.ceil((d.getHours() * 60 + d.getMinutes() + 1) / 30) * 30);
  return hhmm(Math.floor(total / 60), total % 60);
}
