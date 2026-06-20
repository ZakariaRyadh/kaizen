import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AuthButton, AuthError, AuthField, AuthShell } from '../../components/auth-ui';
import { useAuth } from '../../store/auth';
import { useAccent } from '../../theme/AccentContext';
import { colors, fonts } from '../../theme/colors';

export default function Login() {
  const { accent } = useAccent();
  const { login, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/');
    } catch {
      /* error shown from store */
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell kicker="Welcome back" title="Kaizen" subtitle="Sign in to sync your tasks, workouts and notes across devices.">
      <AuthField label="Email" icon="mail" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
      <AuthField label="Password" icon="lock" value={password} onChangeText={setPassword} placeholder="Your password" secure />
      <AuthError message={error} />
      <AuthButton label="Sign in" onPress={submit} loading={loading} />

      <Pressable onPress={() => router.push('/forgot-password')} style={{ alignSelf: 'center' }}>
        <Text style={{ color: accent, fontFamily: fonts.uiSemi, fontSize: 13.5 }}>Forgot password?</Text>
      </Pressable>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
        <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 13.5 }}>No account?</Text>
        <Link href="/register" style={{ color: accent, fontFamily: fonts.uiBold, fontSize: 13.5 }}>Create one</Link>
      </View>
    </AuthShell>
  );
}
