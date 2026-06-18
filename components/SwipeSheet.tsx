import { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '../theme/colors';

const SCREEN = Dimensions.get('window').height;

/**
 * Bottom sheet that slides up smoothly and can be dragged down to dismiss.
 * Drag from the grabber/header area; the body below stays scrollable.
 */
export function SwipeSheet({
  visible,
  onClose,
  children,
  maxHeightPct = 0.92,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeightPct?: number;
}) {
  const [mounted, setMounted] = useState(visible);
  const ty = useSharedValue(SCREEN);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      ty.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.7 });
    } else if (mounted) {
      ty.value = withTiming(SCREEN, { duration: 220 }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // drag handle gesture — pull down past a threshold (or flick) to close
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      ty.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 110 || e.velocityY > 800) {
        ty.value = withTiming(SCREEN, { duration: 200 }, (done) => {
          if (done) runOnJS(onClose)();
        });
      } else {
        ty.value = withSpring(0, { damping: 22, stiffness: 220 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: interpolate(ty.value, [0, SCREEN], [1, 0]) }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,6,10,0.72)' }, backdropStyle]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: SCREEN * maxHeightPct },
          sheetStyle,
        ]}
      >
        <View
          style={{
            backgroundColor: colors.cardAlt,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            paddingBottom: 30,
            overflow: 'hidden',
          }}
        >
          {/* draggable grabber zone */}
          <GestureDetector gesture={pan}>
            <View style={{ paddingTop: 12, paddingBottom: 8, alignItems: 'center' }}>
              <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: '#3a3a45' }} />
            </View>
          </GestureDetector>

          <View style={{ paddingHorizontal: 20 }}>{children}</View>
        </View>
      </Animated.View>
    </Modal>
  );
}
