// The additive/optional-narrowing counterpart to SegmentedControl (ui-audit-plan.md T2-1).
// SegmentedControl is "pick exactly one, all options always shown, equal width"; FilterPillRow
// is "narrow a list down", wraps freely, and sizes to its content — the Bag tab's STABILITY and
// TYPE rows. The distinction is deliberate: A1's complaint was that five treatments existed for
// what is really only these two jobs, not that everything should look identical.
//
// Values here are lifted verbatim from index.tsx's own `pill`/`pillActive`/`pillText`/
// `pillTextActive` — that treatment was already the right one, this only promotes it out of a
// per-screen StyleSheet so the next screen that needs filters doesn't invent a sixth variant.
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, tints } from '../theme';

export interface FilterPillOption<T extends string> {
  key: T;
  label: string;
}

interface Props<T extends string> {
  items: readonly FilterPillOption<T>[];
  active: T;
  onPress: (key: T) => void;
  // Optional per-key count suffix (e.g. "Overstable 7"). The `all` key is skipped by convention
  // — it's a reset, and "All 34" reads as a filter that keeps everything rather than a clear.
  counts?: Record<T, number>;
  style?: StyleProp<ViewStyle>;
}

export default function FilterPillRow<T extends string>({ items, active, onPress, counts, style }: Props<T>) {
  return (
    <View style={[styles.row, style]}>
      {items.map((it) => {
        const selected = active === it.key;
        return (
          <Pressable
            key={it.key}
            onPress={() => onPress(it.key)}
            style={[styles.pill, selected && styles.pillActive]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={it.label}
          >
            <Text style={[styles.text, selected && styles.textActive]}>
              {it.label}
              {counts && it.key !== 'all' ? ` ${counts[it.key]}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  pill: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  pillActive: { borderColor: colors.accent, backgroundColor: tints.accentTintStrong },
  text: { color: colors.muted, fontSize: 12 },
  textActive: { color: colors.text, fontWeight: '700' },
});
