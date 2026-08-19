// Gmail-style swipe-to-dismiss for Disc Suggest result cards (suggest-swipe-scope.md). A colored
// panel sits behind the card at all times and fades in as the card is dragged; past the
// threshold in either direction the card finishes leaving the screen and `onSwipe` fires — the
// caller (disc-suggest.tsx) is what decides what a swipe *means* (a plain per-scenario reorder in
// Throw mode, or that plus a learning-engine update in Buy mode). This component only knows about
// the gesture, never about scenarios/discs/persistence.
//
// Same Gesture.Pan() + GestureDetector + Reanimated shared-value pattern already proven out in
// VerticalSlider.tsx (chosen there specifically because it survives being nested inside a
// ScrollView, unlike gesture-handler's older class-based Swipeable) — reused here for the same
// reason, since these cards render inside a ScrollView/FlatList too.
import { useCallback, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { colors } from '../theme';

interface Props {
  onSwipe: () => void;
  children: React.ReactNode;
  testID?: string;
}

const SWIPE_THRESHOLD_FRACTION = 0.35;
const FALLBACK_WIDTH = 320;

export default function SwipeableSuggestCard({ onSwipe, children, testID }: Props) {
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  const translateX = useSharedValue(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  const threshold = width * SWIPE_THRESHOLD_FRACTION;
  const fireSwipe = () => onSwipe();

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > threshold) {
        const dir = e.translationX > 0 ? 1 : -1;
        translateX.value = withTiming(dir * width * 1.2, { duration: 200 }, (finished) => {
          if (finished) runOnJS(fireSwipe)();
        });
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(translateX.value), [0, threshold || 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.wrap} onLayout={onLayout} testID={testID}>
      <Animated.View style={[styles.panel, panelStyle]} pointerEvents="none">
        <Text style={styles.panelText}>Skip</Text>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={cardStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 8, // matches SuggestResultCard's own marginBottom, so the panel never peeks under it
    borderRadius: 12,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelText: { color: '#3a0d0d', fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
});
