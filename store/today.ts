import { AppState } from 'react-native';
import { create } from 'zustand';

// The app's "today" as 'YYYY-MM-DD'. Live: rolls over at midnight and when
// the app returns to the foreground, so a long-open app never shows yesterday.
const pad = (n: number) => String(n).padStart(2, '0');
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

type State = { today: string; refresh: () => void };

export const useTodayStore = create<State>((set, get) => ({
  today: todayIso(),
  refresh: () => {
    const t = todayIso();
    if (t !== get().today) set({ today: t });
  },
}));

// React hook: re-renders the component when the day changes
export const useToday = () => useTodayStore((s) => s.today);

// Start once (from the tabs layout): foreground check + a timer at each midnight.
let started = false;
export function startTodayWatcher() {
  if (started) return;
  started = true;
  const refresh = () => useTodayStore.getState().refresh();
  AppState.addEventListener('change', (s) => {
    if (s === 'active') refresh();
  });
  const scheduleMidnight = () => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    setTimeout(() => {
      refresh();
      scheduleMidnight();
    }, next.getTime() - now.getTime());
  };
  scheduleMidnight();
}
