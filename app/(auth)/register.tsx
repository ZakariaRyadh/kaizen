import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AuthButton, AuthError, AuthField, AuthShell } from '../../components/auth-ui';
import { useAuth } from '../../store/auth';
import { useAccent } from '../../theme/AccentContext';
import { colors, fonts } from '../../theme/colors';

export default function Register() {
  const { accent } = useAccent();
  const { register, error } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLocalError(null);
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim());
      router.replace('/');
    } catch {
      /* store error */
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell showBack kicker="Get started" title="Create account" subtitle="Your tasks, workouts and notes — saved to your account and synced everywhere.">
      <AuthField label="Name" icon="mail" value={name} onChangeText={setName} placeholder="Your name" />
      <AuthField label="Email" icon="mail" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
      <AuthField label="Password" icon="lock" value={password} onChangeText={setPassword} placeholder="At least 6 characters" secure />
      <AuthError message={localError ?? error} />
      <AuthButton label="Create account" onPress={submit} loading={loading} />

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
        <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 13.5 }}>Already have an account?</Text>
        <Link href="/login" style={{ color: accent, fontFamily: fonts.uiBold, fontSize: 13.5 }}>Sign in</Link>
      </View>
    </AuthShell>
  );
}
