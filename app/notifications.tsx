import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, IconName } from '../components/Icon';
import { useNotifications } from '../store/notifications';
import { useAccent, withAlpha } from '../theme/AccentContext';
import { colors, fonts } from '../theme/colors';

const KIND_META: Record<string, { icon: IconName; color: string }> = {
  task: { icon: 'home', color: '#3b82f6' },
  workout: { icon: 'gym', color: '#22c55e' },
  rest: { icon: 'flame', color: '#f59e0b' },
  learning: { icon: 'book', color: '#7c5df5' },
  weekly: { icon: 'calendar', color: '#ec4899' },
  system: { icon: 'bell', color: '#9a9aa6' },
};

function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const { accent } = useAccent();
  const items = useNotifications((s) => s.items);
  const { markRead, markAllRead, clear } = useNotifications();
  const hasUnread = items.some((n) => !n.read);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 28, gap: 16 }} showsVerticalScrollIndicator={false}>
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 6 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="back" size={17} color={colors.textSoft} />
          </Pressable>
          <Text style={{ fontSize: 25, color: colors.text, fontFamily: fonts.uiBold, flex: 1 }}>Notifications</Text>
          {items.length > 0 && (
            <Pressable onPress={clear} hitSlop={8}>
              <Text style={{ color: colors.textDim, fontFamily: fonts.uiSemi, fontSize: 13 }}>Clear</Text>
            </Pressable>
          )}
        </View>

        {hasUnread && (
          <Pressable
            onPress={markAllRead}
            style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: withAlpha(accent, 16), borderWidth: 1, borderColor: withAlpha(accent, 30), borderRadius: 11, paddingHorizontal: 13, paddingVertical: 8 }}
          >
            <Text style={{ color: accent, fontFamily: fonts.uiSemi, fontSize: 12.5 }}>Mark all read</Text>
          </Pressable>
        )}

        {items.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 60, gap: 10 }}>
            <Icon name="bell" size={38} color={colors.textFainter} />
            <Text style={{ color: colors.textFaint, fontFamily: fonts.ui, fontSize: 14 }}>No notifications yet.</Text>
            <Text style={{ color: colors.textFainter, fontFamily: fonts.ui, fontSize: 12.5, textAlign: 'center' }}>
              Reminders for tasks, workouts and learning will show up here.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 9 }}>
            {items.map((n) => {
              const meta = KIND_META[n.kind] ?? KIND_META.system;
              return (
                <Pressable
                  key={n.id}
                  onPress={() => !n.read && markRead(n.id)}
                  style={{
                    flexDirection: 'row',
                    gap: 13,
                    backgroundColor: n.read ? colors.card : withAlpha(accent, 10),
                    borderWidth: 1,
                    borderColor: n.read ? colors.border : withAlpha(accent, 26),
                    borderRadius: 16,
                    padding: 14,
                  }}
                >
                  <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: withAlpha(meta.color, 16), alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={meta.icon} size={19} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.text, fontFamily: fonts.uiSemi, fontSize: 14.5 }}>{n.title}</Text>
                      <Text style={{ color: colors.textFaint, fontFamily: fonts.mono, fontSize: 11 }}>{ago(n.createdAt)}</Text>
                    </View>
                    {!!n.body && <Text style={{ color: colors.textMuted, fontFamily: fonts.ui, fontSize: 13, marginTop: 3 }}>{n.body}</Text>}
                  </View>
                  {!n.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent, marginTop: 4 }} />}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
