// General-purpose UI glyphs, drawn with react-native-svg (ui-audit-plan.md T2-1, from
// UX_AUDIT.md A3). Same approach and reasoning as TabBarIcon.tsx — no @expo/vector-icons, no
// npm install, keeps the dependency set F-Droid-minimal — but kept as its own file because
// TabBarIcon is tab-bar-specific (its `name` union is the five tabs) and shouldn't grow a
// second, unrelated vocabulary inside it.
//
// These replace text glyphs that render inconsistently across fonts/locales and can't be sized
// or aligned reliably: ▾/▴ (filter chevrons), ⤒/↑/↓ (reorder buttons), ✕ (modal close), ✓ (bag
// check), ›/‹ (settings rows, hole nav). Note UX_AUDIT.md A3/E6's exception: `Σ` is NOT an icon
// fix — that one becomes the text "Tot".
//
// `strokeWidth` 1.8 and `viewBox="0 0 24 24"` match TabBarIcon so a 24px Icon and a 24px
// TabBarIcon sit at the same visual weight.
import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export type IconName =
  | 'chevron-up'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'close'
  | 'check'
  | 'arrow-up'
  | 'arrow-down'
  | 'arrow-to-top'
  | 'more-vertical';

interface Props {
  name: IconName;
  color: ColorValue;
  size?: number;
  // Chevrons and arrows read as slightly heavy at small sizes next to 12sp text; call sites that
  // need a lighter line can dial it down without forking the path data.
  strokeWidth?: number;
}

const PATHS: Record<IconName, string> = {
  'chevron-up': 'M6 14.5 12 8.5l6 6',
  'chevron-down': 'M6 9.5l6 6 6-6',
  'chevron-left': 'M14.5 6 8.5 12l6 6',
  'chevron-right': 'M9.5 6l6 6-6 6',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  check: 'M5 12.5l4.5 4.5L19 7',
  'arrow-up': 'M12 19V5M12 5l-5.5 5.5M12 5l5.5 5.5',
  'arrow-down': 'M12 5v14M12 19l-5.5-5.5M12 19l5.5-5.5',
  // "Send to top": an up arrow with a bar over it, matching the ⤒ it replaces.
  'arrow-to-top': 'M5 4h14M12 20V8M12 8l-5 5M12 8l5 5',
  // Overflow (⋮). Three dots drawn as zero-length round-capped strokes, so it inherits the
  // same strokeWidth/linecap as every other glyph instead of needing <Circle> elements.
  'more-vertical': 'M12 5.5v0M12 12v0M12 18.5v0',
};

export default function Icon({ name, color, size = 20, strokeWidth = 1.8 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={PATHS[name]} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
