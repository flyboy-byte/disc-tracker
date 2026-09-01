// Disc Suggest scenario icons — drawn with react-native-svg in the same style as
// TabBarIcon.tsx, replacing the emoji/glyph mix scenarios.ts used to carry in its `icon`
// field (design_handoff_disc_tracker/UX_AUDIT.md finding D1 / A3: OEM font stacks render
// emoji and text glyphs inconsistently and TalkBack reads them literally). Paths for the
// scenarios that appeared in the design handoff's mockups are carried over verbatim; the
// rest (accurate_mid, hyzerflip, roller, flex) are drawn to match the same single-stroke,
// round-cap/join vocabulary.
import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme';

interface Props {
  id: string;
  color?: ColorValue;
  size?: number;
}

// The two wind-driven scenarios read as a family via colors.sim, same as the physics-sim
// toggle elsewhere in the app — everything else uses the accent purple.
const WIND_SCENARIOS = new Set(['headwind', 'tailwind']);

export default function ScenarioIcon({ id, color, size = 20 }: Props) {
  const stroke = color ?? (WIND_SCENARIOS.has(id) ? colors.sim : colors.accent);

  switch (id) {
    case 'straight':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M4 12h15M14 7l5 5-5 5" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'hyzer':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M18 5C18 13 14 17 7 19M7 19l5-1M7 19l1-5"
            stroke={stroke}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'distance':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 20V5M7 10l5-5 5 5" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'headwind':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M3 8h11a3 3 0 100-3M3 13h14a3 3 0 110 3M3 18h7"
            stroke={stroke}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'tailwind':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M4 8h13M4 12h16M4 16h10" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
      );
    case 'turnover':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M6 19C6 11 10 7 17 5M17 5l-5 1M17 5l-1 5"
            stroke={stroke}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'forehand':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M9 12V5.5a1.5 1.5 0 013 0V11m0-1.5a1.5 1.5 0 013 0V12m0-1a1.5 1.5 0 013 0v4a5 5 0 01-5 5h-2a5 5 0 01-5-5v-4a1.5 1.5 0 013 0"
            stroke={stroke}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'tomahawk':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M5 19L19 5M12 5h7v7" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M9 9l6 6" stroke={stroke} strokeWidth={2} strokeLinecap="round" opacity={0.45} />
        </Svg>
      );
    case 'approach':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={8} stroke={stroke} strokeWidth={1.8} />
          <Circle cx={12} cy={12} r={4} stroke={stroke} strokeWidth={1.8} />
          <Circle cx={12} cy={12} r={1.4} fill={stroke} />
        </Svg>
      );
    case 'accurate_mid':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={7.5} stroke={stroke} strokeWidth={1.8} />
          <Circle cx={12} cy={12} r={2.2} fill={stroke} />
        </Svg>
      );
    case 'hyzerflip':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M6 19C7 12 11 8 18 6M18 6l-5 1M18 6l-1 5"
            stroke={stroke}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'roller':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M5 19h14" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
          <Circle cx={12} cy={11} r={5} stroke={stroke} strokeWidth={1.8} />
          <Path d="M12 6v10" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
      );
    case 'flex':
      // Not in the design handoff mockups — drawn to match the same single-stroke,
      // curve-plus-arrowhead vocabulary as hyzer/turnover/hyzerflip above: an S-curve
      // (turns, then fades back straight) with an arrowhead at the finish.
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 18C4 13 9 15 10 11C11 7 16 9 18 5"
            stroke={stroke}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M18 5l-4.5 1.5M18 5l-1.5 4.5" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={8} stroke={stroke} strokeWidth={1.8} />
        </Svg>
      );
  }
}
