import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Foreground behaviour: still show the banner + play sound while the app is open
// (except the silent "Resting…" status, which the gym screen already shows).
Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const live = n.request.content.data?.kind === 'rest-live';
    return { shouldShowBanner: !live, shouldShowList: true, shouldPlaySound: !live, shouldSetBadge: false };
  },
});

export type NotifKind = 'task' | 'workout' | 'rest' | 'learning' | 'weekly' | 'system';

// Android channels: users can tune each one in system settings.
//   tasks   → pops up with sound (it's a deadline)
//   nudges  → workout / learning / weekly, normal priority
//   rest-*  → gym rest timer (see below)
export const CHANNEL: Record<NotifKind, string> = {
  task: 'tasks',
  workout: 'nudges',
  learning: 'nudges',
  weekly: 'nudges',
  rest: 'rest-done',
  system: 'nudges',
};

// "Mark done" button on task reminders (opens the app and ticks the task)
export const TASK_CATEGORY = 'task';
export const ACTION_DONE = 'done';

let setupDone = false;
async function setup() {
  if (setupDone) return;
  setupDone = true;
  await Notifications.setNotificationCategoryAsync(TASK_CATEGORY, [
    { identifier: ACTION_DONE, buttonTitle: 'Mark done', options: { opensAppToForeground: true } },
  ]).catch(() => {});
  if (Platform.OS !== 'android') return;
  const PUBLIC = Notifications.AndroidNotificationVisibility.PUBLIC;
  await Notifications.setNotificationChannelAsync('tasks', {
    name: 'Task reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 120, 200],
    lockscreenVisibility: PUBLIC,
  });
  await Notifications.setNotificationChannelAsync('nudges', {
    name: 'Daily nudges',
    description: 'Workout, learning and weekly recap reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: PUBLIC,
  });
  await Notifications.setNotificationChannelAsync('rest-live', {
    name: 'Rest timer (running)',
    importance: Notifications.AndroidImportance.LOW, // no sound, no pop-up
    sound: null,
    enableVibrate: false,
    showBadge: false,
    lockscreenVisibility: PUBLIC,
  });
  await Notifications.setNotificationChannelAsync('rest-done', {
    name: 'Rest timer done',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 150, 250],
    lockscreenVisibility: PUBLIC,
  });
  // the old catch-all channel from earlier versions
  await Notifications.deleteNotificationChannelAsync('default').catch(() => {});
}

/** True if we may post notifications (never prompts). */
export async function hasPermission(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).status === 'granted';
}

/** Ask for OS permission (prompts once). Returns true if we can post notifications. */
export async function ensurePermission(): Promise<boolean> {
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status === 'granted') await setup();
  return status === 'granted';
}

export type Reminder = {
  id: string;        // stable: same reminder → same id, so resyncs only touch what changed
  title: string;
  body: string;
  kind: NotifKind;
  at: number;        // ms timestamp
  taskId?: string;
};

/** Schedule (or replace) one reminder at its exact time. */
export async function scheduleReminder(r: Reminder): Promise<void> {
  await setup();
  await Notifications.scheduleNotificationAsync({
    identifier: r.id,
    content: {
      title: r.title,
      body: r.body,
      data: { kind: r.kind, taskId: r.taskId ?? null, at: r.at },
      categoryIdentifier: r.kind === 'task' ? TASK_CATEGORY : undefined,
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(r.at),
      ...(Platform.OS === 'android' ? { channelId: CHANNEL[r.kind] } : {}),
    },
  });
}

export async function cancelReminder(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

/** Ids of everything scheduled except a running rest timer. */
export async function scheduledReminderIds(): Promise<string[]> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.map((n) => n.identifier).filter((id) => id !== REST_ID);
}

/** Logout: nothing scheduled or showing from the previous account. */
export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync().catch(() => {});
}

// ---------------- rest timer outside the app ----------------
// One identifier for both notifications: the silent "Resting · next set at …"
// status is shown right away, and the "Rest done" alert scheduled with the same
// id replaces it on time, even if the app is closed or the phone is locked.
export const REST_ID = 'rest-timer';

const clockOf = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const lengthOf = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Show "Resting" now and schedule "Rest done" at endAt. Replaces any previous rest. */
export async function startRestAlerts(endAt: Date): Promise<void> {
  await clearRestAlerts();
  const secs = Math.round((endAt.getTime() - Date.now()) / 1000);
  if (secs <= 0 || !(await hasPermission())) return;
  await setup();
  const android = Platform.OS === 'android';
  await Notifications.scheduleNotificationAsync({
    identifier: REST_ID,
    content: {
      title: `Resting · ${lengthOf(secs)}`,
      body: `Next set at ${clockOf(endAt)}`,
      data: { kind: 'rest-live' },
      sound: false,
    },
    trigger: android ? { channelId: 'rest-live' } : null,
  });
  await Notifications.scheduleNotificationAsync({
    identifier: REST_ID,
    content: { title: 'Rest done', body: 'Back to it — next set.', data: { kind: 'rest' }, sound: 'default' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: endAt, ...(android ? { channelId: 'rest-done' } : {}) },
  });
}

/** Remove both the status and the pending alert (pause / reset / finish). */
export async function clearRestAlerts(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REST_ID).catch(() => {});
  await Notifications.dismissNotificationAsync(REST_ID).catch(() => {});
}

export { Notifications };
