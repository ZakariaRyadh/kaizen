import { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '../theme/colors';

const SCREEN = Dimensions.get('window').height;
const AnimatedGHScrollView = Animated.createAnimatedComponent(GHScrollView);

/**
 * Bottom sheet that slides up smoothly and can be dragged DOWN ANYWHERE to dismiss.
 *
 * Pass `scroll` when the body is long: the sheet owns the scroll so the drag-to-
 * dismiss gesture and the scroll coordinate — you can only fling the sheet away
 * while the content is scrolled to the very top.
 */
export function SwipeSheet({
  visible,
  onClose,
  children,
  scroll = false,
  scrollMaxHeightPct = 0.7,
  maxHeightPct = 0.92,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  scroll?: boolean;
  scrollMaxHeightPct?: number;
  maxHeightPct?: number;
}) {
  const [mounted, setMounted] = useState(visible);
  const ty = useSharedValue(SCREEN);
  const scrollY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      scrollY.value = 0;
      ty.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.7 });
    } else if (mounted) {
      ty.value = withTiming(SCREEN, { duration: 220 }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // native scroll gesture we can run simultaneously with the drag
  const nativeScroll = Gesture.Native();

  // drag-to-dismiss anywhere. Down-biased activation so upward scrolling is free;
  // only translate/dismiss when the inner content is already at the top.
  const pan = Gesture.Pan()
    .activeOffsetY([-9999, 10])
    .simultaneousWithExternalGesture(nativeScroll)
    .onUpdate((e) => {
      if (scrollY.value <= 0 && e.translationY > 0) ty.value = e.translationY;
    })
    .onEnd((e) => {
      const atTop = scrollY.value <= 0;
      if (atTop && (e.translationY > 110 || e.velocityY > 800)) {
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

  const body = scroll ? (
    <GestureDetector gesture={nativeScroll}>
      <AnimatedGHScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={{ maxHeight: SCREEN * scrollMaxHeightPct }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
      >
        {children}
      </AnimatedGHScrollView>
    </GestureDetector>
  ) : (
    <View style={{ paddingHorizontal: 20 }}>{children}</View>
  );

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,6,10,0.72)' }, backdropStyle]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* whole sheet is draggable — swipe down anywhere to dismiss */}
      <GestureDetector gesture={pan}>
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
            {/* grabber (visual cue) */}
            <View style={{ paddingTop: 12, paddingBottom: 8, alignItems: 'center' }}>
              <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: '#3a3a45' }} />
            </View>

            {body}
          </View>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}
