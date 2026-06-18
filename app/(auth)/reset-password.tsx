import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { AuthButton, AuthError, AuthField, AuthShell } from '../../components/auth-ui';
import { requestOTP, verifyOTP } from '../../services/api';
import { useAccent } from '../../theme/AccentContext';
import { fonts } from '../../theme/colors';

export default function ResetPassword() {
  const { accent } = useAccent();
  const params = useLocalSearchParams<{ email?: string; dev_code?: string }>();
  const email = params.email ?? '';
  const [code, setCode] = useState(params.dev_code ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!code || !password) {
      setError('Fill in all fields.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await verifyOTP(email, code.trim(), password);
      router.replace('/login');
    } catch {
      setError('Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell showBack kicker="Verify identity" title="Enter code" subtitle={`We sent a 6-digit code to ${email || 'your email'}. Enter it and set a new password.`}>
      <AuthField label="6-digit code" icon="keypad" value={code} onChangeText={setCode} placeholder="000000" keyboardType="number-pad" maxLength={6} letterSpacing={6} />
      <AuthField label="New password" icon="lock" value={password} onChangeText={setPassword} placeholder="New password" secure />
      <AuthField label="Confirm password" icon="lock" value={confirm} onChangeText={setConfirm} placeholder="Repeat new password" secure />
      <AuthError message={error} />
      <AuthButton label="Reset password" onPress={submit} loading={loading} />

      <Pressable onPress={() => email && requestOTP(email)} style={{ alignSelf: 'center' }}>
        <Text style={{ color: accent, fontFamily: fonts.uiSemi, fontSize: 13.5 }}>Resend code</Text>
      </Pressable>
    </AuthShell>
  );
}
