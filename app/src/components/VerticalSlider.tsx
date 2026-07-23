// Custom vertical slider — Reanimated 4 + react-native-gesture-handler Pan gesture, per
// PORT_PLAN.md Phase 5's original design ("Custom VerticalSlider.tsx using Reanimated 4 +
// useSharedValue — gives 60fps arc update on-device without threading headaches").
//
// A first pass tried the cheaper route: a horizontal @react-native-community/slider rotated
// -90deg (the same trick flightshape.html itself uses on a horizontal <input type="range">).
// That measurably failed on-device (2026-07-23): nested inside a ScrollView, a real drag on
// the slider always got claimed as a page scroll instead of a thumb drag — confirmed with
// both plain react-native's ScrollView and react-native-gesture-handler's ScrollView, at
// both fast and slow/deliberate drag speeds, so it wasn't a synthetic-input artifact. A
// native platform Slider's own touch-claim logic doesn't go through RNGH's gesture
// negotiation layer at all, which is exactly why nothing on the ScrollView side could fix
// it. A GestureDetector-driven Pan gesture on a plain View does go through that layer, which
// is what actually resolves the conflict — confirmed working on-device after switching.
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { colors } from '../theme';

interface Props {
  minimumValue: number;
  maximumValue: number;
  value: number;
  step?: number;
  onValueChange: (v: number) => void;
  length?: number;
  onSlidingStart?: () => void;
  onSlidingComplete?: () => void;
}

const TRACK_WIDTH = 4;
const THUMB_SIZE = 22;

export default function VerticalSlider({
  minimumValue,
  maximumValue,
  value,
  step = 1,
  onValueChange,
  length = 120,
  onSlidingStart,
  onSlidingComplete,
}: Props) {
  // Top of the track = maximumValue, bottom = minimumValue (matches the website's own
  // rotate(-90deg) convention — dragging up increases the value).
  //
  // 'worklet' directives are required here, not optional: these are called from inside
  // the Pan gesture's onBegin/onUpdate callbacks, which run on the UI thread. Without the
  // directive, Reanimated's babel plugin doesn't recognize these as worklets and calling
  // them throws "[Worklets] Tried to synchronously call a Remote Function" at runtime —
  // hit this exact error on-device (2026-07-23) before adding these.
  const clamp = (v: number, lo: number, hi: number) => {
    'worklet';
    return Math.max(lo, Math.min(hi, v));
  };
  const valueToY = (v: number) => {
    const frac = (v - minimumValue) / (maximumValue - minimumValue);
    return (1 - frac) * length;
  };
  const yToValue = (y: number) => {
    'worklet';
    const frac = 1 - clamp(y, 0, length) / length;
    const raw = minimumValue + frac * (maximumValue - minimumValue);
    const stepped = Math.round(raw / step) * step;
    return clamp(stepped, minimumValue, maximumValue);
  };

  const thumbY = useSharedValue(valueToY(value));
  // Keep the shared value in sync when `value` changes from outside (e.g. Reset button)
  // without an in-progress gesture driving it. Must run in an effect, not directly in the
  // render body — mutating a shared value during render triggers Reanimated's strict-mode
  // warning ("Writing to `value` during component render"), confirmed on-device.
  useEffect(() => {
    thumbY.value = valueToY(value);
  }, [value, minimumValue, maximumValue, length]);

  const emit = (v: number) => onValueChange(v);
  const emitStart = () => onSlidingStart?.();
  const emitComplete = () => onSlidingComplete?.();

  const pan = Gesture.Pan()
    .onBegin((e) => {
      thumbY.value = clamp(e.y, 0, length);
      if (onSlidingStart) runOnJS(emitStart)();
      runOnJS(emit)(yToValue(e.y));
    })
    .onUpdate((e) => {
      thumbY.value = clamp(e.y, 0, length);
      runOnJS(emit)(yToValue(e.y));
    })
    .onFinalize(() => {
      if (onSlidingComplete) runOnJS(emitComplete)();
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: thumbY.value - THUMB_SIZE / 2 }],
  }));
  const fillStyle = useAnimatedStyle(() => ({
    top: thumbY.value,
    height: length - thumbY.value,
  }));

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.hitArea, { height: length }]}>
        <View style={[styles.track, { height: length }]} />
        <Animated.View style={[styles.fill, fillStyle]} />
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  hitArea: { width: 44, alignItems: 'center' },
  track: { position: 'absolute', top: 0, width: TRACK_WIDTH, borderRadius: TRACK_WIDTH / 2, backgroundColor: colors.border },
  fill: { position: 'absolute', width: TRACK_WIDTH, borderRadius: TRACK_WIDTH / 2, backgroundColor: colors.accent },
  thumb: {
    position: 'absolute',
    top: 0,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
});
