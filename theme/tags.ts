// Preset task/note tags with their colors. Users can also type a custom
// name and pick any of these colors.
export const TAG_PRESETS = [
  { name: 'Work', color: '#3b82f6' },
  { name: 'Health', color: '#22c55e' },
  { name: 'Personal', color: '#f59e0b' },
  { name: 'Urgent', color: '#ef4444' },
  { name: 'Study', color: '#7c5df5' },
];

export const TAG_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#7c5df5', '#ec4899', '#14b8a6'];

export const REPEATS = [
  { key: '', label: 'None' },
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
] as const;

export type RepeatKey = (typeof REPEATS)[number]['key'];

export type Task = {
  id: string;
  title: string;
  time: string;
  tag: string;
  tagColor: string;
  repeat: RepeatKey;
  done: boolean;
  date: string; // 'YYYY-MM-DD' — which day this task belongs to
};
