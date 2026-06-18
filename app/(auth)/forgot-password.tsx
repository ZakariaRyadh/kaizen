import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AuthButton, AuthError, AuthField, AuthShell } from '../../components/auth-ui';
import { requestOTP } from '../../services/api';
import { useAccent, withAlpha } from '../../theme/AccentContext';
import { colors, fonts } from '../../theme/colors';

export default function ForgotPassword() {
  const { accent } = useAccent();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!email.trim()) {
      setError('Enter your email.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await requestOTP(email.trim());
      router.push({ pathname: '/reset-password', params: { email: email.trim(), dev_code: res.dev_code ?? '' } });
    } catch {
      setError('Could not send the code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell showBack kicker="Account recovery" title="Reset password" subtitle="Enter the email linked to your account and we'll send a one-time code to verify it.">
      <AuthField label="Email" icon="mail" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
      <AuthError message={error} />
      <AuthButton label="Send code" onPress={send} loading={loading} />

      <View style={{ backgroundColor: withAlpha(accent, 10), borderRadius: 16, padding: 16 }}>
        <Text style={{ color: accent, fontFamily: fonts.uiBold, fontSize: 11.5, letterSpacing: 0.6, textTransform: 'uppercase' }}>Tip</Text>
        <Text style={{ color: colors.textSoft, fontFamily: fonts.uiSemi, fontSize: 14, marginTop: 4 }}>
          Use the email you signed up with so the code reaches the right account.
        </Text>
      </View>
    </AuthShell>
  );
}
