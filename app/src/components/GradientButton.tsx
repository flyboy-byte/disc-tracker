// Primary call-to-action button with the shared purple gradient (theme `gradients.accent`).
// Drop-in for the app's solid-accent Pressables: pass the same padding/radius/alignment via
// `style` (applied to the button surface) and either a `label` or arbitrary `children`.
//
// The gradient is painted with react-native-svg — already a native dependency (it draws every
// flight arc) — rather than expo-linear-gradient, so no new native module is added (keeps the
// F-Droid dep set minimal). The surface has a solid-accent backgroundColor underneath, so it
// still reads correctly for the instant before the SVG paints and if SVG ever fails.
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { colors, gradients } from '../theme';

interface Props {
  onPress: () => void;
  label?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>; // padding / radius / alignment for the button surface
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

const [FROM, TO] = gradients.accent;

export default function GradientButton({ onPress, label, children, disabled, style, textStyle, accessibilityLabel, testID }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={({ pressed }) => [styles.surface, style, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
    >
      {/* Full-bleed gradient behind the content; overflow:hidden on the surface clips it to the
          caller's borderRadius. */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <SvgLinearGradient id="gbtn" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={FROM} />
            <Stop offset="1" stopColor={TO} />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#gbtn)" />
      </Svg>
      {children ?? (
        <View>
          <Text style={[styles.text, textStyle]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  surface: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, overflow: 'hidden' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  text: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
