import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Foreground behaviour: still show the banner + play sound while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
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

/** Fire immediately (used for the rest-timer-done ping). */
export async function fireNow(content: Content): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: { title: content.title, body: content.body ?? '', data: { kind: content.kind } },
    trigger: null,
  });
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export { Notifications };
