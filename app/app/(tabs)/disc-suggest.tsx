// Disc Suggest screen — PORT_PLAN.md Phase 6, rewritten for B1 (accuracy rewrite). Pick a
// scenario; both the bag and the full library are ranked by ONE scoring model (suggestScore.ts)
// against the scenario's ideal flight profile and the user's skill preset, bucketed
// great/good/marginal. Replaces the old two-path filter (raw bagTest for the bag, stability-scalar
// filter + |stability-mid| sort for the library). Library results are deduped against the bag
// section by name+mfr (case-insensitive), same as the website.
//
// buying-mode-scope.md (2026-08-16): a second mode, toggled via the big Throw/Buy header below
// the title. Same scenario grid, same scorer — Throwing mode ranks discs you own (unchanged from
// above); Buying mode ranks the library minus what you already own, with category/stability/brand
// filters and a one-line bag-gap summary. Zero behavior change to Throwing mode from this addition.
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import ScenarioGrid from '../../src/components/ScenarioGrid';
import SuggestResultCard from '../../src/components/SuggestResultCard';
import { getDiscs, getMeta, getOrCreateDefaultUser, setMeta, type SuggestMode } from '../../src/db/db';
import { colors } from '../../src/theme';
import { bagToDisc, discType, stab, TYPE_META, type Disc, type DiscType, type ScenarioDisc, type Stability } from '../../src/utils/disc';
import { masterDiscs } from '../../src/utils/masterLibrary';
import { SCENARIOS, type Scenario } from '../../src/utils/scenarios';
import { PROFILES, rankDiscs, type Scored, type SkillPreset, type ThrowStyle } from '../../src/utils/suggestScore';

// Same shape check the website applies to the raw master JSON before treating a row as a
// valid ScenarioDisc — bundled discs_master.json already satisfies this, but stay defensive
// since this is the app's own copy of that file.
const LIBRARY_DISCS: ScenarioDisc[] = masterDiscs.filter(
  (d): d is ScenarioDisc => d.stability != null && !!d.type
);

const CATEGORY_FILTERS: { id: DiscType | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'putter', label: 'Putter' },
  { id: 'mid', label: 'Mid' },
  { id: 'fairway', label: 'Fairway' },
  { id: 'driver', label: 'Driver' },
];
const STABILITY_FILTERS: { id: Stability | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'understable', label: 'US' },
  { id: 'stable', label: 'ST' },
  { id: 'overstable', label: 'OS' },
];
const CATEGORY_LABEL: Record<DiscType, string> = {
  putter: 'Putt & Approach',
  mid: 'Mid Range',
  fairway: 'Control Driver',
  driver: 'Distance Driver',
};

export default function DiscSuggestScreen() {
  const [loading, setLoading] = useState(true);
  const [bagDiscs, setBagDiscs] = useState<Disc[]>([]);
  const [skill, setSkill] = useState<SkillPreset>('intermediate');
  const [throwStyle, setThrowStyle] = useState<ThrowStyle>('backhand');
  const [mode, setMode] = useState<SuggestMode>('throwing');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<DiscType | 'all'>('all');
  const [stabilityFilter, setStabilityFilter] = useState<Stability | 'all'>('all');
  const [brandFilter, setBrandFilter] = useState('');
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
        const [discs, meta] = await Promise.all([getDiscs(userIdRef.current), getMeta(userIdRef.current)]);
        setBagDiscs(discs);
        setSkill(meta.skill);
        setThrowStyle(meta.throwStyle);
        setMode(meta.suggestMode);
        setLoading(false);
      })();
    }, [])
  );

  const changeMode = (m: SuggestMode) => {
    setMode(m);
    if (userIdRef.current != null) setMeta(userIdRef.current, { suggestMode: m });
  };

  const activeScenario = useMemo(() => SCENARIOS.find((s) => s.id === activeId) ?? null, [activeId]);

  const { bagMatches, libOnly } = useMemo(() => {
    if (!activeScenario) return { bagMatches: [] as Scored[], libOnly: [] as Scored[] };
    // ONE scorer for both. Bag discs converted to the library shape first so they're scored
    // identically (fixes the old bag/library criteria mismatch). No cap on bag matches; library
    // capped inside rankDiscs.
    const bag = rankDiscs(bagDiscs.map(bagToDisc), activeScenario.id, skill, bagDiscs.length || undefined, throwStyle);
    const lib = rankDiscs(LIBRARY_DISCS, activeScenario.id, skill, 15, throwStyle);
    const bagNames = new Set(bag.map((s) => `${s.disc.name}|${s.disc.mfr}`.toLowerCase()));
    const libOnly = lib.filter((s) => !bagNames.has(`${s.disc.name}|${s.disc.mfr}`.toLowerCase()));
    return { bagMatches: bag, libOnly };
  }, [activeScenario, bagDiscs, skill, throwStyle]);

  // Buying mode: same scorer, wider net (every qualifying library disc, not just top 15), minus
  // whatever's already owned — filters below narrow it down, not the scorer itself.
  const buyResults = useMemo(() => {
    if (!activeScenario || mode !== 'buying') return [] as Scored[];
    const ownedNames = new Set(bagDiscs.map((d) => `${d.mold}|${d.mfr}`.toLowerCase()));
    const notOwned = LIBRARY_DISCS.filter((d) => !ownedNames.has(`${d.name}|${d.mfr}`.toLowerCase()));
    return rankDiscs(notOwned, activeScenario.id, skill, notOwned.length, throwStyle);
  }, [activeScenario, mode, bagDiscs, skill, throwStyle]);

  const filteredBuyResults = useMemo(() => {
    const brand = brandFilter.trim().toLowerCase();
    return buyResults.filter((s) => {
      if (categoryFilter !== 'all' && discType({ speed: s.disc.speed }) !== categoryFilter) return false;
      if (stabilityFilter !== 'all' && stab({ turn: s.disc.turn, fade: s.disc.fade }) !== stabilityFilter) return false;
      if (brand && !s.disc.mfr.toLowerCase().includes(brand)) return false;
      return true;
    });
  }, [buyResults, categoryFilter, stabilityFilter, brandFilter]);

  // Bag-gap summary — the actual differentiator vs. just re-filtering the library
  // (buying-mode-scope.md decision 5). Derives the active scenario's ideal category+stability
  // bucket from its own PROFILES target, then checks whether bagMatches already has a good-or-
  // better disc in that bucket. One line, computed, not stored — no new data model.
  const gapMessage = useMemo(() => {
    if (!activeScenario || mode !== 'buying') return null;
    const p = PROFILES[activeScenario.id];
    if (!p) return null;
    const idealType = discType({ speed: p.speed.target });
    const idealStability = stab({ turn: p.turn.target, fade: p.fade.target });
    const hasIt = bagMatches.some(
      (s) =>
        s.band !== 'marginal' &&
        discType({ speed: s.disc.speed }) === idealType &&
        stab({ turn: s.disc.turn, fade: s.disc.fade }) === idealStability
    );
    if (hasIt) return null;
    // "Stable" via net turn+fade can be a real cancellation of two individually large numbers
    // (Flex Shot targets turn -2/fade 2 — nets to "stable" but flies nothing like a normal
    // -1/+1 stable disc). direction-2026-08-08.md Decision 1 warns net-stability shouldn't drive
    // this kind of characterization on its own — so only assert the ST word when it isn't hiding
    // a cancellation; for OS/US the net is dominated by one real, non-cancelling number, so the
    // label stays trustworthy either way.
    const isMaskedCancellation = idealStability === 'stable' && Math.abs(p.turn.target) >= 1.5 && Math.abs(p.fade.target) >= 1.5;
    const stabWord = isMaskedCancellation ? '' : idealStability === 'understable' ? 'understable ' : idealStability === 'overstable' ? 'overstable ' : 'stable ';
    return `Your bag has no ${stabWord}${TYPE_META[idealType].word.toLowerCase()} for ${activeScenario.title.toLowerCase()}.`;
  }, [activeScenario, mode, bagMatches]);

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
      <Text style={styles.substat}>
        {mode === 'throwing' ? 'Pick a scenario — see what fits from your bag and the full library' : 'Pick a scenario — see what to add to your bag'}
      </Text>

      {/* buying-mode-scope.md decision: a thick 50/50 header, not a small pill — same engine
          either way, so this reads as one screen with two lenses, not two destinations. */}
      <View style={styles.modeBar}>
        <Pressable
          testID="suggest-mode-throw"
          style={[styles.modeHalf, styles.modeHalfLeft, mode === 'throwing' && styles.modeHalfActive]}
          onPress={() => changeMode('throwing')}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'throwing' }}
        >
          <Text style={[styles.modeText, mode === 'throwing' && styles.modeTextActive]}>Throw</Text>
        </Pressable>
        <Pressable
          testID="suggest-mode-buy"
          style={[styles.modeHalf, styles.modeHalfRight, mode === 'buying' && styles.modeHalfActive]}
          onPress={() => changeMode('buying')}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'buying' }}
        >
          <Text style={[styles.modeText, mode === 'buying' && styles.modeTextActive]}>Buy</Text>
        </Pressable>
      </View>

      <ScenarioGrid scenarios={SCENARIOS} activeId={activeId} onSelect={onSelect} />

      {activeScenario && mode === 'throwing' && (
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
            bagMatches.map((s) => (
              <SuggestResultCard key={`bag-${s.disc.id ?? `${s.disc.name}-${s.disc.mfr}`}`} disc={s.disc} inBag band={s.band} />
            ))
          )}

          <View style={styles.divider} />

          <View style={styles.resultsHeader}>
            <Text style={styles.resultsHeaderText}>All options</Text>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{libOnly.length}</Text>
            </View>
          </View>
          {libOnly.map((s) => (
            <SuggestResultCard key={`lib-${s.disc.name}-${s.disc.mfr}`} disc={s.disc} inBag={false} band={s.band} />
          ))}
        </View>
      )}

      {activeScenario && mode === 'buying' && (
        <View style={styles.results}>
          {gapMessage && (
            <View testID="buy-gap-banner" style={styles.gapBanner}>
              <Text style={styles.gapText}>{gapMessage}</Text>
            </View>
          )}

          <View style={styles.filterRow}>
            {CATEGORY_FILTERS.map((c) => (
              <Pressable
                key={c.id}
                testID={`buy-filter-category-${c.id}`}
                onPress={() => setCategoryFilter(c.id)}
                style={[styles.filterPill, categoryFilter === c.id && styles.filterPillActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: categoryFilter === c.id }}
              >
                <Text style={[styles.filterPillText, categoryFilter === c.id && styles.filterPillTextActive]}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.filterRow}>
            {STABILITY_FILTERS.map((s) => (
              <Pressable
                key={s.id}
                testID={`buy-filter-stability-${s.id}`}
                onPress={() => setStabilityFilter(s.id)}
                style={[styles.filterPill, stabilityFilter === s.id && styles.filterPillActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: stabilityFilter === s.id }}
              >
                <Text style={[styles.filterPillText, stabilityFilter === s.id && styles.filterPillTextActive]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            testID="buy-filter-brand"
            style={styles.brandInput}
            value={brandFilter}
            onChangeText={setBrandFilter}
            placeholder="Filter by brand…"
            placeholderTextColor={colors.muted}
          />

          <View style={styles.resultsHeader}>
            <Text style={styles.resultsHeaderText}>Discs to consider</Text>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{filteredBuyResults.length}</Text>
            </View>
          </View>
          {filteredBuyResults.length === 0 ? (
            <Text style={styles.emptyBag}>No library discs match these filters for this scenario.</Text>
          ) : (
            filteredBuyResults.map((s) => (
              <SuggestResultCard key={`buy-${s.disc.name}-${s.disc.mfr}`} disc={s.disc} inBag={false} band={s.band} />
            ))
          )}
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
  modeBar: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 2,
  },
  modeHalf: { flex: 1, alignItems: 'center', paddingVertical: 14, backgroundColor: colors.card },
  modeHalfLeft: { borderRightWidth: 1, borderRightColor: colors.border },
  modeHalfRight: {},
  modeHalfActive: { backgroundColor: 'rgba(145,94,255,0.16)' },
  modeText: { color: colors.muted, fontSize: 15, fontWeight: '700' },
  modeTextActive: { color: colors.accent },
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
  gapBanner: {
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  gapText: { color: colors.us, fontSize: 12.5, lineHeight: 18 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  filterPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  filterPillActive: { borderColor: colors.accent, backgroundColor: 'rgba(145,94,255,0.15)' },
  filterPillText: { color: colors.muted, fontSize: 12 },
  filterPillTextActive: { color: colors.accent, fontWeight: '600' },
  brandInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: colors.text,
    marginBottom: 12,
    fontSize: 13,
  },
});
