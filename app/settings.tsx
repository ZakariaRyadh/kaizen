import Constants from 'expo-constants';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { changePassword } from '../services/api';
import { ensurePermission, fireNow, Notifications } from '../services/notifications';
import { useAuth } from '../store/auth';
import { PROGRESS_OPTIONS, REST_OPTIONS, useSettings } from '../store/settings';
import { useAccent, withAlpha } from '../theme/AccentContext';
import { accentSwatches, colors, fonts } from '../theme/colors';

type Meta = { key: string; label: string; desc: string };

const WIDGET_META: Meta[] = [
  { key: 'today', label: 'Today progress', desc: 'Ring + task count' },
  { key: 'workout', label: 'Next workout', desc: 'Upcoming gym session' },
  { key: 'learn', label: 'Learning', desc: 'Study time today' },
  { key: 'calendar', label: 'Up next event', desc: 'Next calendar item' },
  { key: 'streak', label: 'Streak', desc: 'Daily streak counter' },
  { key: 'note', label: 'Quick note', desc: 'New note shortcut' },
];

const NOTIF_META: Meta[] = [
  { key: 'tasks', label: 'Task reminders', desc: 'Before a task is due' },
  { key: 'workout', label: 'Workout time', desc: 'Daily training nudge' },
  { key: 'rest', label: 'Rest timer done', desc: 'When rest finishes' },
  { key: 'learning', label: 'Learning nudge', desc: 'Daily reminder to study' },
  { key: 'weekly', label: 'Weekly summary', desc: 'Sunday recap' },
];

export default function Settings() {
  const { accent, setAccent } = useAccent();
  const { user, logout, updateName, setAvatar } = useAuth();
  const { widgets, notifs, restSeconds, progressDays, setWidget, setNotif, setRest, setProgress, pushAccent } = useSettings();

  // OS notification permission status (so toggles aren't a silent no-op)
  const [permGranted, setPermGranted] = useState<boolean | null>(null);
  useEffect(() => {
    Notifications.getPermissionsAsync().then((p) => setPermGranted(p.status === 'granted'));
  }, []);
  const enableNotifs = async () => {
    const ok = await ensurePermission();
    setPermGranted(ok);
    if (!ok) Alert.alert('Blocked', 'Enable notifications for Kaizen in your phone settings.');
  };
  const sendTest = async () => {
    const ok = await ensurePermission();
    setPermGranted(ok);
    if (!ok) return Alert.alert('Blocked', 'Allow notifications first.');
    await fireNow({ title: 'Test notification', body: 'Notifications are working 🎉', kind: 'system' });
    Alert.alert('Sent', 'You should see a notification now.');
  };

  // profile photo: pick → crop square → shrink to 256px JPEG → base64 → save
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (res.canceled) return;
    setUploadingPhoto(true);
    try {
      const out = await ImageManipulator.manipulateAsync(
        res.assets[0].uri,
        [{ resize: { width: 256, height: 256 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      await setAvatar(`data:image/jpeg;base64,${out.base64}`);
    } catch {
      Alert.alert('Error', 'Could not set the photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

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

  // username
  const [name, setName] = useState(displayName);
  const [savingName, setSavingName] = useState(false);
  const saveName = async () => {
    const n = name.trim();
    if (!n || n === displayName) return;
    setSavingName(true);
    try {
      await updateName(n);
      Alert.alert('Saved', 'Username updated.');
    } catch {
      Alert.alert('Error', 'Could not update username.');
    } finally {
      setSavingName(false);
    }
  };

  // password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const savePassword = async () => {
    if (!currentPw || !newPw) return Alert.alert('Missing fields', 'Enter your current and new password.');
    if (newPw.length < 6) return Alert.alert('Too short', 'New password must be at least 6 characters.');
    if (newPw !== confirmPw) return Alert.alert("Doesn't match", 'New password and confirmation must match.');
    setSavingPw(true);
    try {
      await changePassword(currentPw, newPw);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      Alert.alert('Saved', 'Password updated.');
    } catch (e: any) {
      Alert.alert('Error', 'Current password is incorrect.');
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 28, gap: 22 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 6 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="back" size={17} color={colors.textSoft} />
          </Pressable>
          <Text style={{ fontSize: 25, color: colors.text, fontFamily: fonts.uiBold }}>Settings</Text>
        </View>

        {/* profile */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16 }}>
          <Pressable onPress={pickPhoto} disabled={uploadingPhoto}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={{ width: 56, height: 56, borderRadius: 28, opacity: uploadingPhoto ? 0.5 : 1 }} />
            ) : (
              <LinearGradient colors={[accent, '#3a2a7e']} style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 18 }}>{initial}</Text>
              </LinearGradient>
            )}
            {/* little edit badge */}
            <View style={{ position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: accent, borderWidth: 2, borderColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={11} color="#fff" />
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, color: colors.textMid, fontFamily: fonts.uiSemi }}>{displayName}</Text>
            <Text style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.ui, marginTop: 1 }}>{user?.email ?? 'Not signed in'}</Text>
            <Text style={{ fontSize: 11.5, color: colors.textFaint, fontFamily: fonts.ui, marginTop: 4 }}>
              {uploadingPhoto ? 'Updating photo…' : 'Tap photo to change'}
            </Text>
          </View>
        </View>

        {/* username */}
        <Section title="Username">
          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 14, gap: 10 }}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Display name"
              placeholderTextColor={colors.textFaint}
              style={{ color: colors.text, fontFamily: fonts.uiSemi, fontSize: 15, paddingVertical: 4 }}
            />
            <Pressable
              onPress={saveName}
              disabled={savingName || !name.trim() || name.trim() === displayName}
              style={{ backgroundColor: accent, borderRadius: 11, paddingVertical: 11, alignItems: 'center', opacity: savingName || !name.trim() || name.trim() === displayName ? 0.5 : 1 }}
            >
              <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 13.5 }}>{savingName ? 'Saving…' : 'Save username'}</Text>
            </Pressable>
          </View>
        </Section>

        {/* password */}
        <Section title="Password">
          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 14, gap: 10 }}>
            <TextInput
              value={currentPw}
              onChangeText={setCurrentPw}
              placeholder="Current password"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              style={{ color: colors.text, fontFamily: fonts.ui, fontSize: 14.5, paddingVertical: 4 }}
            />
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <TextInput
              value={newPw}
              onChangeText={setNewPw}
              placeholder="New password"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              style={{ color: colors.text, fontFamily: fonts.ui, fontSize: 14.5, paddingVertical: 4 }}
            />
            <TextInput
              value={confirmPw}
              onChangeText={setConfirmPw}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              style={{ color: colors.text, fontFamily: fonts.ui, fontSize: 14.5, paddingVertical: 4 }}
            />
            <Pressable
              onPress={savePassword}
              disabled={savingPw}
              style={{ backgroundColor: accent, borderRadius: 11, paddingVertical: 11, alignItems: 'center', opacity: savingPw ? 0.6 : 1 }}
            >
              <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 13.5 }}>{savingPw ? 'Saving…' : 'Change password'}</Text>
            </Pressable>
          </View>
        </Section>

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

        {/* rest timer length */}
        <Section title="Gym rest timer">
          <View style={{ flexDirection: 'row', gap: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 4 }}>
            {REST_OPTIONS.map((sec) => {
              const on = restSeconds === sec;
              return (
                <Pressable key={sec} onPress={() => setRest(sec)} style={{ flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center', backgroundColor: on ? accent : 'transparent' }}>
                  <Text style={{ color: on ? '#fff' : colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 13.5 }}>
                    {sec < 60 ? `${sec}s` : `${sec / 60}:${String(sec % 60).padStart(2, '0')}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* progress comparison window */}
        <Section title="Progress period">
          <View style={{ flexDirection: 'row', gap: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 4 }}>
            {PROGRESS_OPTIONS.map((days) => {
              const on = progressDays === days;
              return (
                <Pressable key={days} onPress={() => setProgress(days)} style={{ flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center', backgroundColor: on ? accent : 'transparent' }}>
                  <Text style={{ color: on ? '#fff' : colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 13.5 }}>
                    {days === 7 ? '1 week' : days === 30 ? 'Month' : `${days} days`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ fontSize: 11.5, color: colors.textFaint, fontFamily: fonts.ui, marginTop: 8 }}>
            Gym + Learn compare this period against the one before it.
          </Text>
        </Section>

        {/* notifications */}
        <Section title="Notifications">
          {/* permission status + test */}
          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 14, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: permGranted ? colors.green : permGranted === false ? colors.red : colors.textFaint }} />
              <Text style={{ flex: 1, color: colors.textSoft, fontFamily: fonts.uiSemi, fontSize: 13.5 }}>
                {permGranted == null ? 'Checking…' : permGranted ? 'Notifications allowed' : 'Notifications blocked'}
              </Text>
              {!permGranted && permGranted !== null && (
                <Pressable onPress={enableNotifs} style={{ backgroundColor: accent, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <Text style={{ color: '#fff', fontFamily: fonts.uiSemi, fontSize: 12 }}>Enable</Text>
                </Pressable>
              )}
            </View>
            <Pressable onPress={sendTest} style={{ borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 11, paddingVertical: 11, alignItems: 'center' }}>
              <Text style={{ color: colors.textSoft, fontFamily: fonts.uiSemi, fontSize: 13 }}>Send test notification</Text>
            </Pressable>
          </View>

          <View style={{ height: 8 }} />
          {NOTIF_META.map((m) => (
            <ToggleRow key={m.key} label={m.label} desc={m.desc} on={notifs[m.key] !== false} accent={accent} onToggle={() => setNotif(m.key, !(notifs[m.key] !== false))} />
          ))}
        </Section>

        <Pressable onPress={signOut} style={{ backgroundColor: withAlpha(colors.red, 12), borderWidth: 1, borderColor: withAlpha(colors.red, 30), borderRadius: 15, paddingVertical: 15, alignItems: 'center' }}>
          <Text style={{ color: colors.red, fontFamily: fonts.uiBold, fontSize: 14.5 }}>Sign out</Text>
        </Pressable>

        <Text style={{ textAlign: 'center', color: '#3f3f48', fontSize: 12, fontFamily: fonts.mono, paddingTop: 4 }}>
          {Constants.expoConfig?.name ?? 'Kaizen'} · v{Constants.expoConfig?.version ?? '1.0.0'}
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
