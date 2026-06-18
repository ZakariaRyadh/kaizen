import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../store/auth';
import { useSettings } from '../../store/settings';
import { useAccent, withAlpha } from '../../theme/AccentContext';
import { accentSwatches, colors, fonts } from '../../theme/colors';

type Meta = { key: string; label: string; desc: string };

const WIDGET_META: Meta[] = [
  { key: 'today', label: 'Today progress', desc: 'Ring + task count' },
  { key: 'workout', label: 'Next workout', desc: 'Upcoming gym session' },
  { key: 'calendar', label: 'Up next event', desc: 'Next calendar item' },
  { key: 'streak', label: 'Streak', desc: 'Daily streak counter' },
  { key: 'note', label: 'Quick note', desc: 'New note shortcut' },
];

const NOTIF_META: Meta[] = [
  { key: 'tasks', label: 'Task reminders', desc: 'Before a task is due' },
  { key: 'workout', label: 'Workout time', desc: 'Daily training nudge' },
  { key: 'rest', label: 'Rest timer done', desc: 'When rest finishes' },
  { key: 'weekly', label: 'Weekly summary', desc: 'Sunday recap' },
];

export default function Settings() {
  const { accent, setAccent } = useAccent();
  const { user, logout } = useAuth();
  const { widgets, notifs, setWidget, setNotif, pushAccent } = useSettings();

  const signOut = async () => {
    await logout();
    router.replace('/login');
  };

  const pickAccent = (hex: string) => {
    setAccent(hex);   // instant app-wide recolor (local + AsyncStorage)
    pushAccent(hex);  // persist to the account
  };

  const displayName = user?.display_name || user?.email?.split('@')[0] || 'Guest';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 28, gap: 22 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 25, color: colors.text, fontFamily: fonts.uiBold, paddingTop: 6 }}>Settings</Text>

        {/* profile */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16 }}>
          <LinearGradient colors={[accent, '#3a2a7e']} style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 18 }}>{initial}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, color: colors.textMid, fontFamily: fonts.uiSemi }}>{displayName}</Text>
            <Text style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.ui, marginTop: 1 }}>{user?.email ?? 'Not signed in'}</Text>
          </View>
        </View>

        {/* accent color */}
        <Section title="Accent color">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 18 }}>
            {accentSwatches.map((c) => {
              const on = c === accent;
              return (
                <Pressable
                  key={c}
                  onPress={() => pickAccent(c)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: c,
                    borderWidth: on ? 3 : 0,
                    borderColor: '#fff',
                  }}
                />
              );
            })}
          </View>
        </Section>

        {/* home widgets */}
        <Section title="Home widgets">
          {WIDGET_META.map((m) => (
            <ToggleRow key={m.key} label={m.label} desc={m.desc} on={widgets[m.key] !== false} accent={accent} onToggle={() => setWidget(m.key, !(widgets[m.key] !== false))} />
          ))}
        </Section>

        {/* notifications */}
        <Section title="Notifications">
          {NOTIF_META.map((m) => (
            <ToggleRow key={m.key} label={m.label} desc={m.desc} on={notifs[m.key] !== false} accent={accent} onToggle={() => setNotif(m.key, !(notifs[m.key] !== false))} />
          ))}
        </Section>

        <Pressable onPress={signOut} style={{ backgroundColor: withAlpha(colors.red, 12), borderWidth: 1, borderColor: withAlpha(colors.red, 30), borderRadius: 15, paddingVertical: 15, alignItems: 'center' }}>
          <Text style={{ color: colors.red, fontFamily: fonts.uiBold, fontSize: 14.5 }}>Sign out</Text>
        </Pressable>

        <Text style={{ textAlign: 'center', color: '#3f3f48', fontSize: 12, fontFamily: fonts.mono, paddingTop: 4 }}>
          Daily Tracker · v0.1.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={{ fontSize: 12, color: colors.textFainter, fontFamily: fonts.uiSemi, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 11 }}>
        {title}
      </Text>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

function ToggleRow({ label, desc, on, accent, onToggle }: { label: string; desc: string; on: boolean; accent: string; onToggle: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 15, paddingHorizontal: 16, paddingVertical: 14 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14.5, color: colors.textSoft, fontFamily: fonts.uiSemi }}>{label}</Text>
        <Text style={{ fontSize: 12, color: colors.textFaint, fontFamily: fonts.ui, marginTop: 2 }}>{desc}</Text>
      </View>
      <Pressable
        onPress={onToggle}
        style={{ width: 46, height: 27, borderRadius: 14, justifyContent: 'center', backgroundColor: on ? accent : '#2a2a33' }}
      >
        <View style={{ width: 21, height: 21, borderRadius: 11, backgroundColor: '#fff', marginLeft: on ? 22 : 3 }} />
      </Pressable>
    </View>
  );
}
