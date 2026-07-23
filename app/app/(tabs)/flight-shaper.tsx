// Flight Shaper screen — PORT_PLAN.md Phase 5. Ported from templates/flightshape.html's
// setMode()/onSlider()/updateArc()/setBaseDisc()/loadBag()/onManualChange(). Physics-sim
// mode (server-side shotshaper) is intentionally NOT ported — the mobile app must not
// depend on the Flask server (CLAUDE.md hard constraint) — only the legacy Bézier arc.
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
// gesture-handler's ScrollView (not react-native's) — its NativeViewGestureHandler
// negotiates touch claims with nested native views (our rotated Slider) properly;
// plain RN ScrollView won on-device even with scrollEnabled toggling (confirmed
// 2026-07-23, see VerticalSlider.tsx).
import { ScrollView } from 'react-native-gesture-handler';
import AngleRefDiagrams from '../../src/components/AngleRefDiagrams';
import FlightArcSvg from '../../src/components/FlightArcSvg';
import HyzerReferenceDiagram from '../../src/components/HyzerReferenceDiagram';
import VerticalSlider from '../../src/components/VerticalSlider';
import { getDiscs, getMeta, getOrCreateDefaultUser, setMeta } from '../../src/db/db';
import { colors } from '../../src/theme';
import { STAB_META, stab, type Disc } from '../../src/utils/disc';
import { applyModifiers, estimateDist, type BaseDisc, type SliderValues } from '../../src/utils/legacyPhysics';

type ArcView = 'RHBH' | 'RHFH' | 'LHBH' | 'LHFH';
type Mode = 'bag' | 'manual';

const DEFAULT_SLIDERS: SliderValues = { hyzer: 0, nose: 0, wind: 0, armSpeed: 100, spin: 100 };

function sliderLabel(key: keyof SliderValues, v: number): string {
  if (key === 'wind') return v === 0 ? 'calm' : v > 0 ? `+${v} H` : `${Math.abs(v)} T`;
  if (key === 'armSpeed' || key === 'spin') return `${v}%`;
  return `${v > 0 ? '+' : ''}${v}°`;
}

export default function FlightShaperScreen() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<number | null>(null);
  const [bagDiscs, setBagDiscs] = useState<Disc[]>([]);
  const [mode, setMode] = useState<Mode>('bag');
  const [selectedBagId, setSelectedBagId] = useState<number | null>(null);
  const [manual, setManual] = useState<BaseDisc>({ speed: 7, glide: 5, turn: 0, fade: 2 });
  const [sliders, setSliders] = useState<SliderValues>(DEFAULT_SLIDERS);
  const [arcView, setArcView] = useState<ArcView>('RHBH');
  const [scrollEnabled, setScrollEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      const uid = await getOrCreateDefaultUser();
      const [discs, meta] = await Promise.all([getDiscs(uid), getMeta(uid)]);
      setUserId(uid);
      setBagDiscs(discs);
      setArcView((meta.arcView as ArcView) || 'RHBH');
      const sorted = [...discs].sort((a, b) => b.speed - a.speed);
      if (sorted.length) {
        setSelectedBagId(sorted[0].id ?? null);
      } else {
        setMode('manual');
      }
      setLoading(false);
    })();
  }, []);

  const sortedBag = useMemo(() => [...bagDiscs].sort((a, b) => b.speed - a.speed), [bagDiscs]);
  const selectedBagDisc = useMemo(() => bagDiscs.find((d) => d.id === selectedBagId) ?? null, [bagDiscs, selectedBagId]);

  const baseDisc: (BaseDisc & { mold?: string; mfr?: string }) | null = mode === 'bag' ? selectedBagDisc : manual;

  const adjusted = useMemo(() => (baseDisc ? applyModifiers(baseDisc, sliders) : null), [baseDisc, sliders]);
  const dist = useMemo(
    () =>
      baseDisc && adjusted
        ? estimateDist(baseDisc, sliders.armSpeed, sliders.wind, adjusted.glide ?? 5, sliders.nose, sliders.hyzer)
        : null,
    [baseDisc, adjusted, sliders]
  );

  const changeArcView = async (v: ArcView) => {
    setArcView(v);
    if (userId != null) await setMeta(userId, { arcView: v });
  };

  const resetSliders = () => setSliders(DEFAULT_SLIDERS);
  const setSlider = (key: keyof SliderValues) => (v: number) => setSliders((s) => ({ ...s, [key]: Math.round(v) }));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} scrollEnabled={scrollEnabled}>
      <Text style={styles.title}>Flight Shaper</Text>
      <Text style={styles.substat}>Adjust throw conditions to see how your disc&apos;s flight changes</Text>

      {/* Disc picker */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>DISC</Text>
        <View style={styles.modeTabs}>
          <Pressable style={[styles.modeTab, mode === 'bag' && styles.modeTabActive]} onPress={() => setMode('bag')}>
            <Text style={[styles.modeTabText, mode === 'bag' && styles.modeTabTextActive]}>My Bag</Text>
          </Pressable>
          <Pressable style={[styles.modeTab, mode === 'manual' && styles.modeTabActive]} onPress={() => setMode('manual')}>
            <Text style={[styles.modeTabText, mode === 'manual' && styles.modeTabTextActive]}>Manual</Text>
          </Pressable>
        </View>

        {mode === 'bag' ? (
          sortedBag.length === 0 ? (
            <Text style={styles.emptyText}>Bag is empty — use Manual mode.</Text>
          ) : (
            <View>
              {sortedBag.map((d) => {
                const s = STAB_META[stab(d)];
                const selected = d.id === selectedBagId;
                return (
                  <Pressable
                    key={d.id}
                    style={[styles.bagItem, selected && styles.bagItemSelected]}
                    onPress={() => setSelectedBagId(d.id ?? null)}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.bagItemName}>{d.mold}</Text>
                      <Text style={styles.bagItemMfr}>{d.mfr}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: s.color }]}>
                      <Text style={styles.badgeText}>{s.short}</Text>
                    </View>
                    <Text style={styles.bagItemNums}>
                      {d.speed} / {d.glide} / {d.turn} / {d.fade}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )
        ) : (
          <View style={styles.fnGrid}>
            <ManualField label="Speed" value={manual.speed ?? 7} onChangeText={(v) => setManual((m) => ({ ...m, speed: v }))} />
            <ManualField label="Glide" value={manual.glide ?? 5} onChangeText={(v) => setManual((m) => ({ ...m, glide: v }))} />
            <ManualField label="Turn" value={manual.turn} onChangeText={(v) => setManual((m) => ({ ...m, turn: v }))} />
            <ManualField label="Fade" value={manual.fade} onChangeText={(v) => setManual((m) => ({ ...m, fade: v }))} />
          </View>
        )}

        {baseDisc && (
          <View style={styles.selectedDisc}>
            {mode === 'bag' && baseDisc.mold ? (
              <>
                <Text style={styles.selectedDiscMfr}>{baseDisc.mfr}</Text>
                <Text style={styles.selectedDiscMold}> {baseDisc.mold}</Text>
              </>
            ) : (
              <Text style={styles.selectedDiscMold}>Manual entry</Text>
            )}
            <Text style={styles.selectedDiscNums}>
              {baseDisc.speed} / {baseDisc.glide} / {baseDisc.turn} / {baseDisc.fade}
            </Text>
          </View>
        )}
      </View>

      {/* Conditions */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>CONDITIONS</Text>
          <Pressable style={styles.resetBtn} onPress={resetSliders}>
            <Text style={styles.resetBtnText}>Reset</Text>
          </Pressable>
        </View>

        <View style={styles.sliderBank}>
          <SliderCol label="Hyzer" formatKey="hyzer" unit="degrees" value={sliders.hyzer} min={-30} max={30} isDefault={sliders.hyzer === 0} onChange={setSlider('hyzer')} onScrollLock={setScrollEnabled} />
          <SliderCol label="Nose" formatKey="nose" unit="pitch" value={sliders.nose} min={-15} max={15} isDefault={sliders.nose === 0} onChange={setSlider('nose')} onScrollLock={setScrollEnabled} />
          <SliderCol label="Wind" formatKey="wind" unit="mph" value={sliders.wind} min={-20} max={20} isDefault={sliders.wind === 0} onChange={setSlider('wind')} onScrollLock={setScrollEnabled} />
          <SliderCol label="Arm" formatKey="armSpeed" unit="power" value={sliders.armSpeed} min={50} max={100} isDefault={sliders.armSpeed === 100} onChange={setSlider('armSpeed')} onScrollLock={setScrollEnabled} />
          <SliderCol label="Spin" formatKey="spin" unit="rpm" value={sliders.spin} min={50} max={100} isDefault={sliders.spin === 100} onChange={setSlider('spin')} onScrollLock={setScrollEnabled} />
        </View>

        <AngleRefDiagrams hyzer={sliders.hyzer} nose={sliders.nose} arcView={arcView} />
        <HyzerReferenceDiagram />
      </View>

      {/* Flight shape */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>FLIGHT SHAPE</Text>
          <View style={styles.arcViewRow}>
            {(['RHBH', 'RHFH', 'LHBH', 'LHFH'] as ArcView[]).map((v) => (
              <Pressable key={v} onPress={() => changeArcView(v)} style={[styles.arcViewPill, arcView === v && styles.arcViewPillActive]}>
                <Text style={[styles.arcViewPillText, arcView === v && styles.arcViewPillTextActive]}>{v}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.arcWrap}>
          {baseDisc && adjusted ? (
            <FlightArcSvg adjusted={adjusted} baseDisc={baseDisc} sliders={sliders} arcView={arcView} />
          ) : (
            <Text style={styles.emptyText}>Select a disc above</Text>
          )}
        </View>
        <View style={styles.teeRow}>
          <Text style={styles.teeLabel}>Tee</Text>
          <Text style={styles.teeLabel}>{arcView}</Text>
          <Text style={styles.teeLabel}>Landing</Text>
        </View>

        {baseDisc && adjusted && (
          <>
            <View style={styles.adjHeader}>
              <Text style={styles.adjLabel}>ADJUSTED</Text>
              <View style={[styles.badge, { backgroundColor: STAB_META[stab(adjusted)].color }]}>
                <Text style={styles.badgeText}>{STAB_META[stab(adjusted)].short}</Text>
              </View>
            </View>
            <View style={styles.numsRow}>
              <Text style={styles.numItem}>
                SPD <Text style={styles.numStrong}>{adjusted.speed}</Text>
              </Text>
              <Text style={styles.numItem}>
                GLI <Text style={styles.numStrong}>{adjusted.glide}</Text>
              </Text>
              <Text style={styles.numItem}>
                TRN <Text style={styles.numStrong}>{adjusted.turn}</Text>
              </Text>
              <Text style={styles.numItem}>
                FDE <Text style={styles.numStrong}>{adjusted.fade}</Text>
              </Text>
            </View>
            <Text style={styles.baseNums}>
              Base: {baseDisc.speed} / {baseDisc.glide} / {baseDisc.turn} / {baseDisc.fade}
            </Text>

            {dist != null && (
              <View style={styles.distPanel}>
                <View style={styles.rowBetween}>
                  <Text style={styles.distLabel}>EST. DISTANCE</Text>
                  <Text style={styles.distVal}>~{dist} ft</Text>
                </View>
                <View style={styles.distTrack}>
                  <View style={[styles.distBar, { width: `${Math.min(100, (dist / 450) * 100)}%` }]} />
                </View>
                <Text style={styles.distCaveat}>Est. distance — this is just an example</Text>
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function ManualField({ label, value, onChangeText }: { label: string; value: number; onChangeText: (v: number) => void }) {
  return (
    <View style={styles.fnField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={String(value)}
        onChangeText={(t) => onChangeText(parseFloat(t) || 0)}
        keyboardType="numeric"
      />
    </View>
  );
}

function SliderCol({
  label,
  unit,
  value,
  min,
  max,
  isDefault,
  onChange,
  formatKey,
  onScrollLock,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  isDefault: boolean;
  onChange: (v: number) => void;
  formatKey: keyof SliderValues;
  onScrollLock: (enabled: boolean) => void;
}) {
  return (
    <View style={styles.sliderCol}>
      <Text style={styles.sliderLabel}>{label}</Text>
      <Text style={[styles.sliderValue, { color: isDefault ? colors.muted : colors.accent }]}>{sliderLabel(formatKey, value)}</Text>
      <VerticalSlider
        minimumValue={min}
        maximumValue={max}
        value={value}
        onValueChange={onChange}
        onSlidingStart={() => onScrollLock(false)}
        onSlidingComplete={() => onScrollLock(true)}
      />
      <Text style={styles.sliderUnit}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 14, paddingTop: 56, paddingBottom: 40, gap: 12 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  substat: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: colors.muted, marginBottom: 14, textTransform: 'uppercase' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modeTabs: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  modeTab: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6 },
  modeTabActive: { borderColor: colors.accent, backgroundColor: 'rgba(145,94,255,0.1)' },
  modeTabText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  modeTabTextActive: { color: colors.accent },
  emptyText: { color: colors.muted, fontSize: 13, paddingVertical: 4 },
  bagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  bagItemSelected: { backgroundColor: 'rgba(145,94,255,0.1)', borderColor: 'rgba(145,94,255,0.3)' },
  bagItemName: { color: colors.text, fontWeight: '600', fontSize: 14 },
  bagItemMfr: { color: colors.muted, fontSize: 11 },
  bagItemNums: { color: colors.muted, fontSize: 11 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: '#0b0e1a', fontSize: 11, fontWeight: '700' },
  fnGrid: { flexDirection: 'row', gap: 8 },
  fnField: { flex: 1 },
  fieldLabel: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: colors.text },
  selectedDisc: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    backgroundColor: 'rgba(145,94,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(145,94,255,0.2)',
    borderRadius: 10,
  },
  selectedDiscMfr: { color: colors.muted, fontSize: 11 },
  selectedDiscMold: { color: colors.text, fontSize: 15, fontWeight: '700' },
  selectedDiscNums: { marginLeft: 'auto', color: colors.muted, fontSize: 11 },
  resetBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  resetBtnText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  sliderBank: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: 10 },
  sliderCol: { alignItems: 'center', gap: 6, minWidth: 84, flexBasis: '30%' },
  sliderLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: colors.muted, textTransform: 'uppercase' },
  sliderValue: { fontSize: 12, fontWeight: '700', minWidth: 44, textAlign: 'center' },
  sliderUnit: { fontSize: 9, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  arcViewRow: { flexDirection: 'row', gap: 4 },
  arcViewPill: { borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  arcViewPillActive: { borderColor: colors.accent, backgroundColor: 'rgba(145,94,255,0.1)' },
  arcViewPillText: { color: colors.muted, fontSize: 10 },
  arcViewPillTextActive: { color: colors.accent, fontWeight: '700' },
  arcWrap: {
    width: '100%',
    aspectRatio: 280 / 420,
    maxHeight: 420,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.015)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  teeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 8 },
  teeLabel: { fontSize: 10, color: colors.muted },
  adjHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, marginBottom: 8 },
  adjLabel: { fontSize: 10, color: colors.muted, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  numsRow: { flexDirection: 'row', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 8 },
  numItem: { color: colors.muted, fontSize: 13 },
  numStrong: { color: colors.text, fontWeight: '700' },
  baseNums: { fontSize: 10, color: colors.muted, textAlign: 'center' },
  distPanel: { marginTop: 10 },
  distLabel: { fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
  distVal: { fontSize: 13, fontWeight: '700', color: colors.accent },
  distTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  distBar: { height: '100%', backgroundColor: colors.accent, borderRadius: 2 },
  distCaveat: { fontSize: 9, color: colors.muted, textAlign: 'center', marginTop: 6, opacity: 0.5, fontStyle: 'italic' },
});
