import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, IconName } from './Icon';
import { useAccent, withAlpha } from '../theme/AccentContext';
import { colors, fonts } from '../theme/colors';

// Page shell shared by all auth screens: dark canvas + accent hero + scroll.
export function AuthShell({
  kicker,
  title,
  subtitle,
  children,
  showBack,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  showBack?: boolean;
}) {
  const { accent } = useAccent();
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <LinearGradient
        colors={[withAlpha(accent, 55), colors.canvas]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 300, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 }}
      />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22, paddingTop: 14, paddingBottom: 32 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {showBack && (
              <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="back" size={20} color="#fff" />
              </Pressable>
            )}
            <View style={{ marginTop: 30, gap: 8 }}>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontFamily: fonts.uiBold, letterSpacing: 2, textTransform: 'uppercase' }}>{kicker}</Text>
              <Text style={{ fontSize: 33, color: '#fff', fontFamily: fonts.uiBold }}>{title}</Text>
              <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', fontFamily: fonts.ui, lineHeight: 22, maxWidth: 330 }}>{subtitle}</Text>
            </View>
            <View style={{ marginTop: 30, gap: 16, backgroundColor: colors.cardAlt, borderRadius: 28, borderWidth: 1, borderColor: colors.borderSoft, padding: 22 }}>
              {children}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

export function AuthField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
  maxLength,
  letterSpacing,
}: {
  label: string;
  icon: IconName;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  secure?: boolean;
  keyboardType?: 'email-address' | 'number-pad';
  maxLength?: number;
  letterSpacing?: number;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 13, color: colors.textSoft, fontFamily: fonts.uiSemi }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 16, paddingHorizontal: 14 }}>
        <Icon name={icon} size={18} color={colors.textMuted} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          secureTextEntry={secure}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoCapitalize="none"
          style={{ flex: 1, color: colors.text, fontFamily: fonts.ui, fontSize: 15, paddingVertical: 15, paddingLeft: 11, letterSpacing }}
        />
      </View>
    </View>
  );
}

export function AuthButton({ label, onPress, loading }: { label: string; onPress: () => void; loading?: boolean }) {
  const { accent } = useAccent();
  return (
    <Pressable onPress={onPress} disabled={loading} style={{ backgroundColor: accent, borderRadius: 18, paddingVertical: 16, alignItems: 'center', opacity: loading ? 0.7 : 1 }}>
      <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 15 }}>{loading ? 'Please wait…' : label}</Text>
    </Pressable>
  );
}

export function AuthError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={{ backgroundColor: withAlpha(colors.red, 14), borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 }}>
      <Text style={{ color: colors.red, fontFamily: fonts.uiSemi, fontSize: 13, textAlign: 'center' }}>{message}</Text>
    </View>
  );
}
