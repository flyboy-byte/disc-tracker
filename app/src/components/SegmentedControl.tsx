// One shared "pick exactly one of N, all options always visible" control (ui-audit-plan.md
// T2-1, from UX_AUDIT.md A1). Before this, five hand-rolled treatments did the same job with
// different radii/tints — `segment` (Today's Bag/Collection), `arcViewPill` (RHBH/RHFH/LHBH/
// LHFH, also UX_AUDIT.md C1), `holePresetPill` (9/18/Custom), `pill` used single-select for
// SORT and for Settings' three preference rows.
//
// Deliberately NOT for `modeHalf` (disc-suggest's Throw/Buy): UX_AUDIT.md D2 calls that out as
// navigation wearing segment-control clothing, needing its own fix. Don't fold it in here.
//
// `minHeight: 44` is load-bearing — it satisfies the A2 touch-target floor for free at every
// call site this replaces, several of which needed hitSlop before.
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Pressable } from 'react-native';
import { colors, tints } from '../theme';

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
}

interface Props<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (key: T) => void;
  // Applied to the container — for call-site spacing only (margins), not for restyling the
  // control itself; the whole point of this component is that the look stops varying per screen.
  style?: StyleProp<ViewStyle>;
  // Per-option testID prefix, so existing testIDs like `bag-scope-today` survive migration.
  testIDPrefix?: string;
  accessibilityLabel?: string;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
  testIDPrefix,
  accessibilityLabel,
}: Props<T>) {
  return (
    <View style={[styles.container, style]} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((opt) => {
        const selected = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            testID={testIDPrefix ? `${testIDPrefix}-${opt.key}` : undefined}
            style={[styles.segment, selected && styles.segmentSelected]}
            onPress={() => onChange(opt.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.label}
          >
            <Text style={[styles.text, selected && styles.textSelected]} numberOfLines={1}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    padding: 3,
    minHeight: 44,
  },
  segment: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: { backgroundColor: tints.accentTint },
  text: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  textSelected: { color: colors.accent, fontWeight: '700' },
});
