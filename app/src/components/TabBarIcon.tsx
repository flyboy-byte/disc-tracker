// Tab bar icons drawn with react-native-svg (already a dependency) rather than pulling in
// @expo/vector-icons — keeps the dependency set minimal (F-Droid) and avoids an npm install
// (which risks.md flags as a breakage vector for this project). Each icon takes the tint
// `color` the tab navigator passes in (active = accent, inactive = muted).
import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

interface Props {
  name: 'bag' | 'flight' | 'suggest' | 'settings';
  // The tab navigator passes its tint as ColorValue (string | OpaqueColorValue); our tokens
  // are plain hex strings, but accept the wider type so no cast is needed at the call site.
  color: ColorValue;
  size?: number;
}

export default function TabBarIcon({ name, color, size = 24 }: Props) {
  if (name === 'bag') {
    // A carry bag: rounded body + a handle arc on top.
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M5 8h14a1 1 0 0 1 1 1l-1 10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 9a1 1 0 0 1 1-1Z"
          stroke={color}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
        <Path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    );
  }
  if (name === 'flight') {
    // A flight arc: tee at bottom, curving up to a landing dot.
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M7 20C7 13 10 11 12.5 10C15.5 8.8 16 7 16.5 4.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        <Circle cx={16.8} cy={4} r={1.7} fill={color} />
        <Circle cx={7} cy={20} r={1.4} fill={color} />
      </Svg>
    );
  }
  if (name === 'settings') {
    // A gear: outer toothed ring (rounded octagon approximation) + inner hub.
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 3.2l1.6.7.9-1.5 1.9.9-.3 1.7 1.7.6 1 .5-.8 1.5 1.3 1.2v2.1l-1.3 1.2.8 1.5-1 .5-1.7.6.3 1.7-1.9.9-.9-1.5-1.6.7-1.6-.7-.9 1.5-1.9-.9.3-1.7-1.7-.6-1-.5.8-1.5-1.3-1.2v-2.1l1.3-1.2-.8-1.5 1-.5 1.7-.6-.3-1.7 1.9-.9.9 1.5z"
          stroke={color}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
        <Circle cx={12} cy={12} r={3.1} stroke={color} strokeWidth={1.6} />
      </Svg>
    );
  }
  // suggest: a target / bullseye — "which disc should I pick".
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={1.8} />
      <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={1.8} />
      <Circle cx={12} cy={12} r={1.4} fill={color} />
    </Svg>
  );
}
