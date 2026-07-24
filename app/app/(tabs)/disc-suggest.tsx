// Disc Suggest screen — PORT_PLAN.md Phase 6. Ported from templates/discsuggestion.html:
// pick a scenario, see bag matches (via filterBag) and top-15 library matches (via
// filterLibrary), library results deduped against whatever's already shown in the bag
// section by name+mfr (case-insensitive), same as the website.
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import ScenarioGrid from '../../src/components/ScenarioGrid';
import SuggestResultCard from '../../src/components/SuggestResultCard';
import { getDiscs, getOrCreateDefaultUser } from '../../src/db/db';
import { colors } from '../../src/theme';
import { bagToDisc, type Disc, type ScenarioDisc } from '../../src/utils/disc';
import { masterDiscs } from '../../src/utils/masterLibrary';
import { filterBag, filterLibrary, SCENARIOS, type Scenario } from '../../src/utils/scenarios';

// Same shape check the website applies to the raw master JSON before treating a row as a
// valid ScenarioDisc — bundled discs_master.json already satisfies this, but stay defensive
// since this is the app's own copy of that file.
const LIBRARY_DISCS: ScenarioDisc[] = masterDiscs.filter(
  (d): d is ScenarioDisc => d.stability != null && !!d.type
);

export default function DiscSuggestScreen() {
  const [loading, setLoading] = useState(true);
  const [bagDiscs, setBagDiscs] = useState<Disc[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Resolve the user once and hold it in a ref so the focus effect below has stable ([])
  // deps — depending on a `userId` state instead caused a double-fetch on cold open (the
  // first run set the state, whose change re-fired the still-focused effect).
  const userIdRef = useRef<number | null>(null);

  // Refetch the bag on every tab focus (per PORT_PLAN.md's Phase 6 lesson — this screen
  // reads the same bag data Flight Shaper does, and a mount-only load already shipped one
  // stale-data bug there). Stable deps → fires only on real focus events, not state changes.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (userIdRef.current == null) userIdRef.current = await getOrCreateDefaultUser();
        const discs = await getDiscs(userIdRef.current);
        setBagDiscs(discs);
        setLoading(false);
      })();
    }, [])
  );

  const activeScenario = useMemo(() => SCENARIOS.find((s) => s.id === activeId) ?? null, [activeId]);

  const { bagMatches, libOnly } = useMemo(() => {
    if (!activeScenario) return { bagMatches: [] as ScenarioDisc[], libOnly: [] as ScenarioDisc[] };
    const bag = filterBag(activeScenario, bagDiscs).map(bagToDisc);
    const lib = filterLibrary(activeScenario, LIBRARY_DISCS);
    const bagNames = new Set(bag.map((d) => `${d.name}|${d.mfr}`.toLowerCase()));
    const libOnly = lib.filter((d) => !bagNames.has(`${d.name}|${d.mfr}`.toLowerCase()));
    return { bagMatches: bag, libOnly };
  }, [activeScenario, bagDiscs]);

  const onSelect = (sc: Scenario) => setActiveId(sc.id);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Disc Suggest</Text>
      <Text style={styles.substat}>Pick a scenario — see what fits from your bag and the full library</Text>

      <ScenarioGrid scenarios={SCENARIOS} activeId={activeId} onSelect={onSelect} />

      {activeScenario && (
        <View style={styles.results}>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsHeaderText}>From your bag</Text>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{bagMatches.length}</Text>
            </View>
          </View>
          {bagMatches.length === 0 ? (
            <Text style={styles.emptyBag}>No matches in your bag for this scenario.</Text>
          ) : (
            bagMatches.map((d) => <SuggestResultCard key={`bag-${d.name}-${d.mfr}`} disc={d} inBag />)
          )}

          <View style={styles.divider} />

          <View style={styles.resultsHeader}>
            <Text style={styles.resultsHeaderText}>All options</Text>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{libOnly.length}</Text>
            </View>
          </View>
          {libOnly.map((d) => (
            <SuggestResultCard key={`lib-${d.name}-${d.mfr}`} disc={d} inBag={false} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 14, paddingTop: 56, paddingBottom: 40, gap: 12 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  substat: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  results: { marginTop: 4 },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  resultsHeaderText: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: colors.muted, textTransform: 'uppercase' },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(145,94,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(145,94,255,0.25)',
  },
  countPillText: { color: colors.accent, fontSize: 10, fontWeight: '600' },
  emptyBag: { color: colors.muted, fontSize: 13, paddingVertical: 16, textAlign: 'center' },
  divider: { borderTopWidth: 1, borderTopColor: colors.border, marginVertical: 20 },
});
