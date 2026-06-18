import {
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
} from '@expo-google-fonts/jetbrains-mono';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/space-grotesk';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuth } from '../store/auth';
import { AccentProvider } from '../theme/AccentContext';
import { colors } from '../theme/colors';

function RootNavigator() {
  const { ready, isLoggedIn, checkAuth } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // check for an existing session once on launch
  useEffect(() => {
    checkAuth();
  }, []);

  // redirect based on auth state: push to /login when signed out, to app when in
  useEffect(() => {
    if (!ready) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!isLoggedIn && !inAuthGroup) router.replace('/login');
    else if (isLoggedIn && inAuthGroup) router.replace('/');
  }, [ready, isLoggedIn, segments]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#7c5df5" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
  });

  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AccentProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AccentProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
