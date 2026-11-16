import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { create } from 'zustand';

import { useAccent, withAlpha } from '../theme/AccentContext';
import { colors, fonts } from '../theme/colors';

/*
 * App-styled pop-ups, replacing the grey system Alert:
 *   await confirm({ title, message, confirmText, destructive })  -> true / false
 *   await notice({ title, message, tone })                       -> one "OK" button
 *   toast('Saved', 'success')                                     -> small banner, hides itself
 * <DialogHost /> is mounted once in the root layout.
 */

type Tone = 'danger' | 'success' | 'error' | 'info';
type Request = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string | null; // null = single button
  tone?: Tone;
};
type Toast = { id: number; text: string; tone: Tone };

const useDialogStore = create<{
  current: (Request & { resolve: (ok: boolean) => void }) | null;
  toast: Toast | null;
}>(() => ({ current: null, toast: null }));

export function confirm(r: Omit<Request, 'tone'> & { destructive?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    const prev = useDialogStore.getState().current;
    prev?.resolve(false);
    useDialogStore.setState({
      current: { cancelText: 'Cancel', confirmText: 'OK', ...r, tone: r.destructive ? 'danger' : 'info', resolve },
    });
  });
}

export function notice(r: { title: string; message?: string; tone?: Tone }): Promise<void> {
  return new Promise((resolve) => {
    useDialogStore.getState().current?.resolve(false);
    useDialogStore.setState({
      current: { confirmText: 'OK', cancelText: null, tone: 'info', ...r, resolve: () => resolve() },
    });
  });
}

let toastId = 0;
export function toast(text: string, tone: Tone = 'success') {
  useDialogStore.setState({ toast: { id: ++toastId, text, tone } });
}

const TONE_COLOR = (tone: Tone, accent: string) =>
  tone === 'danger' || tone === 'error' ? colors.red : tone === 'success' ? colors.green : accent;

function ToneIcon({ tone, color, size = 22 }: { tone: Tone; color: string; size?: number }) {
  const p = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {tone === 'danger' && <Path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5" {...p} />}
      {tone === 'success' && <Path d="M5 12.5l4.5 4.5L19 7.5" {...p} />}
      {tone === 'error' && <Path d="M12 7v6M12 16.5v.5M10.3 3.9 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" {...p} />}
      {tone === 'info' && (
        <>
          <Circle cx="12" cy="12" r="9" {...p} />
          <Path d="M12 11v5M12 8v.5" {...p} />
        </>
      )}
    </Svg>
  );
}

export function DialogHost() {
  const { accent } = useAccent();
  const current = useDialogStore((s) => s.current);
  const t = useDialogStore((s) => s.toast);
  const insets = useSafeAreaInsets();

  // ---- dialog animation (fade backdrop + pop card) ----
  const [shown, setShown] = useState<typeof current>(null);
  const a = useSharedValue(0);
  useEffect(() => {
    if (current) {
      setShown(current);
      a.value = withSpring(1, { damping: 18, stiffness: 260, mass: 0.6 });
    } else if (shown) {
      a.value = withTiming(0, { duration: 140 }, (done) => {
        if (done) runOnJS(setShown)(null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);
  const backdrop = useAnimatedStyle(() => ({ opacity: Math.min(1, a.value) }));
  const card = useAnimatedStyle(() => ({ opacity: Math.min(1, a.value), transform: [{ scale: 0.92 + 0.08 * a.value }] }));

  const close = (ok: boolean) => {
    const c = useDialogStore.getState().current;
    useDialogStore.setState({ current: null });
    c?.resolve(ok);
  };

  // ---- toast animation (slide from top, auto-hide) ----
  const ty = useSharedValue(-120);
  const [toastShown, setToastShown] = useState<Toast | null>(null);
  useEffect(() => {
    if (!t) return;
    setToastShown(t);
    ty.value = withSpring(0, { damping: 18, stiffness: 220 });
    const h = setTimeout(() => {
      ty.value = withTiming(-120, { duration: 220, easing: Easing.in(Easing.quad) }, (done) => {
        if (done) runOnJS(setToastShown)(null);
      });
    }, 2200);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t?.id]);
  const toastStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));

  const d = shown;
  const tone = d?.tone ?? 'info';
  const c = TONE_COLOR(tone, accent);

  return (
    <>
      <Modal visible={!!d} transparent statusBarTranslucent animationType="none" onRequestClose={() => close(false)}>
        <Animated.View style={[{ flex: 1, backgroundColor: 'rgba(5,5,9,0.72)', alignItems: 'center', justifyContent: 'center', padding: 28 }, backdrop]}>
          <Pressable style={{ position: 'absolute', inset: 0 } as any} onPress={() => d?.cancelText !== null && close(false)} />
          {d && (
            <Animated.View
              style={[
                { width: '100%', maxWidth: 360, backgroundColor: '#17171f', borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 22, alignItems: 'center' },
                card,
              ]}
            >
              <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: withAlpha(c, 14), alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <ToneIcon tone={tone} color={c} size={24} />
              </View>
              <Text style={{ color: colors.text, fontFamily: fonts.uiBold, fontSize: 18, textAlign: 'center' }}>{d.title}</Text>
              {!!d.message && (
                <Text style={{ color: colors.textDim, fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 }}>{d.message}</Text>
              )}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 22, alignSelf: 'stretch' }}>
                {d.cancelText !== null && (
                  <Pressable onPress={() => close(false)} style={({ pressed }) => ({ flex: 1, paddingVertical: 13, borderRadius: 13, alignItems: 'center', backgroundColor: pressed ? '#24242e' : colors.card, borderWidth: 1, borderColor: colors.border })}>
                    <Text style={{ color: colors.textSoft, fontFamily: fonts.uiSemi, fontSize: 14.5 }}>{d.cancelText}</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => close(true)} style={({ pressed }) => ({ flex: 1, paddingVertical: 13, borderRadius: 13, alignItems: 'center', backgroundColor: c, opacity: pressed ? 0.85 : 1 })}>
                  <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 14.5 }}>{d.confirmText}</Text>
                </Pressable>
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </Modal>

      {toastShown && (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, alignItems: 'center', zIndex: 1000 }, toastStyle]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1b1b24', borderRadius: 14, borderWidth: 1, borderColor: withAlpha(TONE_COLOR(toastShown.tone, accent), 35), paddingHorizontal: 14, paddingVertical: 11, maxWidth: 420 }}>
            <ToneIcon tone={toastShown.tone} color={TONE_COLOR(toastShown.tone, accent)} size={18} />
            <Text style={{ color: colors.text, fontFamily: fonts.uiSemi, fontSize: 13.5, flexShrink: 1 }}>{toastShown.text}</Text>
          </View>
        </Animated.View>
      )}
    </>
  );
}
