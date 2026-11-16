import { useEffect, useRef, useState } from 'react';
import { Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hhmm, parseTime } from '../lib/time';
import { withAlpha } from '../theme/AccentContext';
import { colors, fonts } from '../theme/colors';

const ITEM = 46;
const VISIBLE = 5; // rows shown; the middle one is the pick
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

type Props = {
  visible: boolean;
  value: string; // 'HH:MM'
  title?: string;
  accent: string;
  onClose: () => void;
  onDone: (v: string) => void;
};

/** App-styled hour + minute wheels in a bottom card. */
export function TimeWheelSheet({ visible, value, title = 'Pick a time', accent, onClose, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const p = parseTime(value) ?? { h: 9, m: 0 };
  const [h, setH] = useState(p.h);
  const [m, setM] = useState(Math.round(p.m / 5) * 5 % 60);

  // reset to the current value each time it opens
  useEffect(() => {
    if (!visible) return;
    const q = parseTime(value) ?? { h: 9, m: 0 };
    setH(q.h);
    setM((Math.round(q.m / 5) * 5) % 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // slide up + fade
  const [mounted, setMounted] = useState(visible);
  const a = useSharedValue(0);
  useEffect(() => {
    if (visible) {
      setMounted(true);
      a.value = withSpring(1, { damping: 20, stiffness: 230, mass: 0.7 });
    } else if (mounted) {
      a.value = withTiming(0, { duration: 180 }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const backdrop = useAnimatedStyle(() => ({ opacity: Math.min(1, a.value) }));
  const card = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - a.value) * 420 }] }));

  if (!mounted) return null;

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[{ flex: 1, backgroundColor: 'rgba(5,5,9,0.6)', justifyContent: 'flex-end' }, backdrop]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View
          style={[
            { backgroundColor: '#15151c', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18 + insets.bottom },
            card,
          ]}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#33333d', marginBottom: 14 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ color: colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>{title}</Text>
            <Text style={{ color: accent, fontFamily: fonts.monoSemi, fontSize: 22 }}>{hhmm(h, m)}</Text>
          </View>

          <View style={{ height: ITEM * VISIBLE, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginVertical: 6 }}>
            {/* selection band */}
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: ITEM * 2, height: ITEM, borderRadius: 14, backgroundColor: withAlpha(accent, 14), borderWidth: 1, borderColor: withAlpha(accent, 35) }} />
            <Wheel items={HOURS} value={h} onChange={setH} accent={accent} />
            <Text style={{ color: colors.textMid, fontFamily: fonts.monoSemi, fontSize: 26, marginHorizontal: 6, marginTop: -3 }}>:</Text>
            <Wheel items={MINUTES} value={m} onChange={setM} accent={accent} />
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Pressable onPress={onClose} style={({ pressed }) => ({ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: pressed ? '#24242e' : colors.card, borderWidth: 1, borderColor: colors.border })}>
              <Text style={{ color: colors.textSoft, fontFamily: fonts.uiSemi, fontSize: 15 }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onDone(hhmm(h, m));
                onClose();
              }}
              style={({ pressed }) => ({ flex: 1.4, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: accent, opacity: pressed ? 0.85 : 1 })}
            >
              <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 15 }}>Set {hhmm(h, m)}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function Wheel({ items, value, onChange, accent }: { items: number[]; value: number; onChange: (v: number) => void; accent: string }) {
  const ref = useRef<Animated.ScrollView>(null);
  const y = useSharedValue(Math.max(0, items.indexOf(value)) * ITEM);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });

  // a tapped row (or outside change) scrolls the wheel to it
  useEffect(() => {
    const i = Math.max(0, items.indexOf(value));
    if (Math.round(y.value / ITEM) !== i) ref.current?.scrollTo({ y: i * ITEM, animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(items.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ITEM)));
    if (items[i] !== value) onChange(items[i]);
  };

  return (
    <Animated.ScrollView
      ref={ref}
      style={{ width: 84 }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM}
      decelerationRate="fast"
      contentOffset={{ x: 0, y: Math.max(0, items.indexOf(value)) * ITEM }}
      contentContainerStyle={{ paddingVertical: ITEM * 2 }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onMomentumScrollEnd={settle}
      onScrollEndDrag={(e) => {
        // no fling: settle right away
        if (Math.abs(e.nativeEvent.velocity?.y ?? 0) < 0.05) settle(e);
      }}
      nestedScrollEnabled
    >
      {items.map((n, i) => (
        <Row key={n} index={i} y={y} label={String(n).padStart(2, '0')} accent={accent} onPress={() => onChange(n)} />
      ))}
    </Animated.ScrollView>
  );
}

function Row({ index, y, label, accent, onPress }: { index: number; y: SharedValue<number>; label: string; accent: string; onPress: () => void }) {
  const style = useAnimatedStyle(() => {
    const d = Math.abs(y.value / ITEM - index);
    return {
      opacity: interpolate(d, [0, 1, 2, 3], [1, 0.55, 0.25, 0.1], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(d, [0, 1, 2], [1, 0.86, 0.74], Extrapolation.CLAMP) }],
    };
  });
  const color = useAnimatedStyle(() => ({ color: Math.abs(y.value / ITEM - index) < 0.5 ? accent : colors.textMid }));
  return (
    <Pressable onPress={onPress} style={{ height: ITEM, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.Text style={[{ fontFamily: fonts.monoSemi, fontSize: 26 }, style, color]}>{label}</Animated.Text>
    </Pressable>
  );
}
