// Scenario picker grid — ported from discsuggestion.html's #scenarioGrid. The website scales
// 2 → 3 → 6 columns by viewport width (480px/700px breakpoints) for desktop use; this is a
// phone-only app so a fixed 2-column grid covers the real device range without needing
// useWindowDimensions breakpoint logic.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import type { Scenario } from '../utils/scenarios';
import ScenarioIcon from './ScenarioIcon';

interface Props {
  scenarios: Scenario[];
  activeId: string | null;
  onSelect: (sc: Scenario) => void;
}

const WIND_SCENARIOS = new Set(['headwind', 'tailwind']);

export default function ScenarioGrid({ scenarios, activeId, onSelect }: Props) {
  return (
    <View style={styles.grid}>
      {scenarios.map((sc) => {
        const active = sc.id === activeId;
        const wind = WIND_SCENARIOS.has(sc.id);
        return (
          <Pressable
            key={sc.id}
            testID={`scenario-card-${sc.id}`}
            style={[styles.card, active && styles.cardActive]}
            onPress={() => onSelect(sc)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${sc.title}: ${sc.desc}`}
          >
            {/* One drawn icon language (react-native-svg, matching TabBarIcon.tsx) instead of
                the emoji/glyph mix — scales and tints cleanly, reads correctly in TalkBack. */}
            <View
              style={[
                styles.iconBadge,
                wind && styles.iconBadgeWind,
                active && (wind ? styles.iconBadgeWindActive : styles.iconBadgeActive),
              ]}
            >
              <ScenarioIcon id={sc.id} size={22} />
            </View>
            <Text style={styles.title}>{sc.title}</Text>
            <Text style={styles.desc}>{sc.desc}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 6,
  },
  cardActive: { borderColor: colors.accent, backgroundColor: 'rgba(145,94,255,0.1)' },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(145,94,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(145,94,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  iconBadgeActive: { backgroundColor: 'rgba(145,94,255,0.28)', borderColor: colors.accent },
  iconBadgeWind: { backgroundColor: 'rgba(56,189,248,0.12)', borderColor: 'rgba(56,189,248,0.22)' },
  iconBadgeWindActive: { backgroundColor: 'rgba(56,189,248,0.28)', borderColor: colors.sim },
  title: { color: colors.text, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  desc: { color: colors.muted, fontSize: 10, lineHeight: 14, textAlign: 'center' },
});
