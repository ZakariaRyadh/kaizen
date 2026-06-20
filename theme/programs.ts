// Training programs. Each program has named days; each day has exercises.
// Users switch the active program from the picker — day tabs + exercises follow.

export type Exercise = {
  name: string;
  sub: string;
  sets: number;
  reps: string;
  weight: string;
  pr?: boolean;
};

export type ProgramDay = { label: string; exercises: Exercise[]; isCardio?: boolean };

export type Program = {
  id: string;
  name: string;
  meta: string;
  days: ProgramDay[];
  isActive?: boolean;
};

// one actual logged set (what you really lifted)
export type SetLog = {
  id: string;
  exercise: string;
  order: number;
  reps: number;
  weight: number;
  date: string;
  isPr: boolean;
};

export const PROGRAMS: Program[] = [
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    meta: '3 lift + cardio',
    days: [
      {
        label: 'Push',
        exercises: [
          { name: 'Bench Press', sub: 'Chest', sets: 4, reps: '6-8', weight: '80 kg', pr: true },
          { name: 'Overhead Press', sub: 'Shoulders', sets: 3, reps: '8-10', weight: '45 kg' },
          { name: 'Incline DB Press', sub: 'Upper chest', sets: 3, reps: '10-12', weight: '28 kg' },
          { name: 'Triceps Pushdown', sub: 'Triceps', sets: 3, reps: '12-15', weight: '30 kg' },
        ],
      },
      {
        label: 'Pull',
        exercises: [
          { name: 'Deadlift', sub: 'Back · posterior', sets: 3, reps: '5', weight: '120 kg', pr: true },
          { name: 'Pull-ups', sub: 'Lats', sets: 4, reps: '8-10', weight: 'BW' },
          { name: 'Barbell Row', sub: 'Mid back', sets: 3, reps: '8-10', weight: '70 kg' },
          { name: 'Face Pull', sub: 'Rear delts', sets: 3, reps: '15', weight: '25 kg' },
        ],
      },
      {
        label: 'Legs',
        exercises: [
          { name: 'Back Squat', sub: 'Quads', sets: 4, reps: '6-8', weight: '100 kg' },
          { name: 'Romanian Deadlift', sub: 'Hamstrings', sets: 3, reps: '10', weight: '80 kg' },
          { name: 'Leg Press', sub: 'Quads', sets: 3, reps: '12', weight: '160 kg' },
          { name: 'Calf Raise', sub: 'Calves', sets: 4, reps: '15', weight: '60 kg' },
        ],
      },
      { label: 'Cardio', exercises: [], isCardio: true },
    ],
  },
  {
    id: 'ul',
    name: 'Upper / Lower',
    meta: '2 days · strength',
    days: [
      {
        label: 'Upper',
        exercises: [
          { name: 'Bench Press', sub: 'Chest', sets: 4, reps: '5', weight: '85 kg' },
          { name: 'Weighted Pull-ups', sub: 'Back', sets: 4, reps: '6', weight: '+10 kg' },
          { name: 'Overhead Press', sub: 'Shoulders', sets: 3, reps: '8', weight: '47 kg' },
          { name: 'Barbell Curl', sub: 'Biceps', sets: 3, reps: '10', weight: '35 kg' },
        ],
      },
      {
        label: 'Lower',
        exercises: [
          { name: 'Back Squat', sub: 'Quads', sets: 5, reps: '5', weight: '105 kg' },
          { name: 'Romanian Deadlift', sub: 'Hamstrings', sets: 3, reps: '8', weight: '85 kg' },
          { name: 'Walking Lunge', sub: 'Legs', sets: 3, reps: '12', weight: '20 kg' },
          { name: 'Calf Raise', sub: 'Calves', sets: 4, reps: '15', weight: '65 kg' },
        ],
      },
    ],
  },
  {
    id: 'fb',
    name: 'Full Body',
    meta: '3 days · general',
    days: [
      {
        label: 'Day A',
        exercises: [
          { name: 'Squat', sub: 'Legs', sets: 3, reps: '5', weight: '95 kg' },
          { name: 'Bench Press', sub: 'Chest', sets: 3, reps: '5', weight: '80 kg' },
          { name: 'Barbell Row', sub: 'Back', sets: 3, reps: '8', weight: '65 kg' },
        ],
      },
      {
        label: 'Day B',
        exercises: [
          { name: 'Deadlift', sub: 'Posterior', sets: 1, reps: '5', weight: '130 kg' },
          { name: 'Overhead Press', sub: 'Shoulders', sets: 3, reps: '5', weight: '45 kg' },
          { name: 'Lat Pulldown', sub: 'Lats', sets: 3, reps: '10', weight: '60 kg' },
        ],
      },
      {
        label: 'Day C',
        exercises: [
          { name: 'Front Squat', sub: 'Quads', sets: 3, reps: '6', weight: '70 kg' },
          { name: 'Incline Press', sub: 'Upper chest', sets: 3, reps: '8', weight: '60 kg' },
          { name: 'Chin-ups', sub: 'Biceps · back', sets: 3, reps: '8', weight: 'BW' },
        ],
      },
    ],
  },
];

export const IMPORT_SOURCES = [
  { label: 'Spotify', color: '#1db954' },
  { label: 'Apple Music', color: '#fa57c1' },
  { label: 'YouTube Music', color: '#ff0000' },
  { label: 'SoundCloud', color: '#ff7700' },
];

export type LoggedSession = {
  id: string;
  day: string;
  program: string;
  durationSec: number;
  volume: number;
  cardio: boolean;
  cardioMin: number;
  date: string; // display label e.g. "Jun 14"
  daysAgo: number;
};

export const SEED_LOG: LoggedSession[] = [
  { id: 'l1', day: 'Push', program: 'PPL', durationSec: 52 * 60, volume: 8200, cardio: true, cardioMin: 18, date: 'Jun 14', daysAgo: 2 },
  { id: 'l2', day: 'Legs', program: 'PPL', durationSec: 61 * 60, volume: 11400, cardio: false, cardioMin: 0, date: 'Jun 12', daysAgo: 4 },
  { id: 'l3', day: 'Pull', program: 'PPL', durationSec: 47 * 60, volume: 7600, cardio: true, cardioMin: 22, date: 'Jun 10', daysAgo: 6 },
  { id: 'l4', day: 'Upper', program: 'U/L', durationSec: 44 * 60, volume: 6900, cardio: false, cardioMin: 0, date: 'Jun 8', daysAgo: 8 },
];
