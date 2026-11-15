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

/** Ask for OS permission once. Returns true if we can post notifications. */
export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  return status === 'granted';
}

type Content = { title: string; body?: string; kind: NotifKind };

/** Fire once at a specific Date. */
export async function scheduleAt(content: Content, date: Date): Promise<string | null> {
  if (date.getTime() <= Date.now()) return null; // don't schedule in the past
  return Notifications.scheduleNotificationAsync({
    content: { title: content.title, body: content.body ?? '', data: { kind: content.kind } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
}

/** Repeat every day at hh:mm. */
export async function scheduleDaily(content: Content, hour: number, minute: number): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: { title: content.title, body: content.body ?? '', data: { kind: content.kind } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
}

/** Repeat weekly. weekday: 1=Sun … 7=Sat. */
export async function scheduleWeekly(content: Content, weekday: number, hour: number, minute: number): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: { title: content.title, body: content.body ?? '', data: { kind: content.kind } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour, minute },
  });
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await clearRestAlerts();
}

/** Cancel scheduled reminders but leave a running rest timer alone. */
export async function cancelReminders(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all.filter((n) => n.identifier !== REST_ID).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

// ---------------- rest timer outside the app ----------------
// One identifier for both notifications: the silent "Resting · next set at …"
// status is shown right away, and the "Rest done" alert scheduled with the same
// id replaces it on time, even if the app is closed or the phone is locked.
const REST_ID = 'rest-timer';
let restChannelsReady = false;

async function ensureRestChannels() {
  if (Platform.OS !== 'android' || restChannelsReady) return;
  await Notifications.setNotificationChannelAsync('rest-live', {
    name: 'Rest timer (running)',
    importance: Notifications.AndroidImportance.LOW, // no sound, no pop-up
    sound: null,
    enableVibrate: false,
    showBadge: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync('rest-done', {
    name: 'Rest timer done',
    importance: Notifications.AndroidImportance.HIGH, // sound + heads-up
    vibrationPattern: [0, 250, 150, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  restChannelsReady = true;
}

const clockOf = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const lengthOf = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Show "Resting" now and schedule "Rest done" at endAt. Replaces any previous rest. */
export async function startRestAlerts(endAt: Date): Promise<void> {
  await clearRestAlerts();
  const secs = Math.round((endAt.getTime() - Date.now()) / 1000);
  if (secs <= 0) return;
  if ((await Notifications.getPermissionsAsync()).status !== 'granted') return;
  await ensureRestChannels();
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
