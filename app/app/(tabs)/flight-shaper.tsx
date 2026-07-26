// Flight Shaper screen — PORT_PLAN.md Phase 5, layout reworked in R2 (2026-07-25).
// Ported from templates/flightshape.html's setMode()/onSlider()/updateArc()/setBaseDisc()/
// loadBag()/onManualChange(). Physics-sim mode (server-side shotshaper) is intentionally NOT
// ported — the mobile app must not depend on the Flask server (CLAUDE.md hard constraint) —
// only the legacy Bézier arc.
//
// R2 layout rework (layout-ONLY — physics/arc geometry/slider semantics unchanged): the disc
// selector + arc + adjusted stats are PINNED at the top so the arc stays visible while you
// adjust the sliders below; the reference diagrams collapse behind a toggle; the disc picker
// moved from a long inline list into a compact selector + bottom-sheet modal.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
// gesture-handler's ScrollView (not react-native's) — its NativeViewGestureHandler
// negotiates touch claims with nested native views (our rotated Slider) properly;
// plain RN ScrollView won on-device even with scrollEnabled toggling (confirmed
// 2026-07-23, see VerticalSlider.tsx).
import { ScrollView } from 'react-native-gesture-handler';
import { useFocusEffect } from 'expo-router';
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
  // R2 layout state: compact disc-picker modal + collapsed reference diagrams (collapsed by
  // default so the sliders sit right under the pinned arc). Pure presentation.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [diagramsOpen, setDiagramsOpen] = useState(false);
  // Guards the one-time "auto-select the fastest disc + fall back to Manual mode if the
  // bag is empty" behavior so it only fires on first load, not on every refocus below.
  const didInitialSelect = useRef(false);

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
      didInitialSelect.current = true;
      setLoading(false);
    })();
  }, []);

  // Real bug, confirmed on-device (2026-07-23): expo-router's tab screens stay mounted
  // when you switch tabs, so a plain "load once on mount" effect goes stale the moment
  // you add/edit a disc on the Bag tab and come back here — the newly added disc simply
  // never appeared. Refetch on every focus instead (skipping the very first one, since
  // the mount effect above already handles that).
  useFocusEffect(
    useCallback(() => {
      if (!didInitialSelect.current || userId == null) return;
      (async () => {
        // Also re-read the default arc view — it's settable from the Settings tab now.
        const [discs, meta] = await Promise.all([getDiscs(userId), getMeta(userId)]);
        setBagDiscs(discs);
        setArcView((meta.arcView as ArcView) || 'RHBH');
      })();
    }, [userId])
  );

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

  const pickBagDisc = (id: number | null) => {
    setSelectedBagId(id);
    setPickerOpen(false);
  };

  // Label shown on the compact selector button in the pinned header.
  const selectorTitle =
    mode === 'bag' ? (selectedBagDisc ? selectedBagDisc.mold : 'Select a disc') : 'Manual entry';
  const selectorSub = baseDisc ? `${baseDisc.speed} / ${baseDisc.glide} / ${baseDisc.turn} / ${baseDisc.fade}` : null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ===== PINNED TOP: selector + arc + adjusted (always visible) ===== */}
      <View style={styles.pinned}>
        <Text style={styles.title}>Flight Shaper</Text>

        <View style={styles.headerRow}>
          {/* compact disc selector — opens the picker modal */}
          <Pressable style={styles.discSelect} onPress={() => setPickerOpen(true)} accessibilityRole="button" accessibilityLabel="Choose disc">
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.discSelectName} numberOfLines={1}>{selectorTitle}</Text>
              {selectorSub && <Text style={styles.discSelectSub}>{selectorSub}</Text>}
            </View>
            <Text style={styles.chevron}>▾</Text>
          </Pressable>

          {/* arc-view pills */}
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
            <Text style={styles.emptyText}>Select a disc to see its flight</Text>
          )}
        </View>
        <View style={styles.teeRow}>
          <Text style={styles.teeLabel}>Tee</Text>
          <Text style={styles.teeLabel}>{arcView}</Text>
          <Text style={styles.teeLabel}>Landing</Text>
        </View>

        {baseDisc && adjusted && (
          <View style={styles.adjRow}>
            <Text style={styles.adjLabel}>ADJUSTED</Text>
            <View style={[styles.badge, { backgroundColor: STAB_META[stab(adjusted)].color }]}>
              <Text style={styles.badgeText}>{STAB_META[stab(adjusted)].short}</Text>
            </View>
            <Text style={styles.adjNums}>
              {adjusted.speed} / {adjusted.glide} / {adjusted.turn} / {adjusted.fade}
            </Text>
          </View>
        )}
      </View>

      {/* ===== SCROLLING: sliders + collapsible diagrams + distance ===== */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} scrollEnabled={scrollEnabled}>
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
        </View>

        {/* collapsible reference diagrams — collapsed by default so sliders sit near the arc */}
        <Pressable style={styles.collapseToggle} onPress={() => setDiagramsOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: diagramsOpen }}>
          <Text style={styles.collapseToggleText}>{diagramsOpen ? '▾' : '▸'}  Angle & hyzer reference</Text>
        </Pressable>
        {diagramsOpen && (
          <View style={styles.card}>
            <AngleRefDiagrams hyzer={sliders.hyzer} nose={sliders.nose} arcView={arcView} />
            <HyzerReferenceDiagram />
          </View>
        )}

        {baseDisc && adjusted && dist != null && (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={[styles.distLabel, { marginBottom: 0 }]}>EST. DISTANCE</Text>
              <Text style={styles.distVal}>~{dist} ft</Text>
            </View>
            <View style={styles.distTrack}>
              <View style={[styles.distBar, { width: `${Math.min(100, (dist / 450) * 100)}%` }]} />
            </View>
            <Text style={styles.baseNums}>
              Base: {baseDisc.speed} / {baseDisc.glide} / {baseDisc.turn} / {baseDisc.fade}
            </Text>
            <Text style={styles.distCaveat}>Est. distance — this is just an example</Text>
          </View>
        )}
      </ScrollView>

      {/* ===== disc picker modal (bag list / manual entry) ===== */}
      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose disc</Text>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={10}>
                <Text style={styles.modalClose}>Done</Text>
              </Pressable>
            </View>

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
                <ScrollView style={styles.pickerList}>
                  {sortedBag.map((d) => {
                    const s = STAB_META[stab(d)];
                    const selected = d.id === selectedBagId;
                    return (
                      <Pressable
                        key={d.id}
                        style={[styles.bagItem, selected && styles.bagItemSelected]}
                        onPress={() => pickBagDisc(d.id ?? null)}
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
                </ScrollView>
              )
            ) : (
              <View style={styles.fnGrid}>
                <ManualField label="Speed" value={manual.speed ?? 7} onChangeText={(v) => setManual((m) => ({ ...m, speed: v }))} />
                <ManualField label="Glide" value={manual.glide ?? 5} onChangeText={(v) => setManual((m) => ({ ...m, glide: v }))} />
                <ManualField label="Turn" value={manual.turn} onChangeText={(v) => setManual((m) => ({ ...m, turn: v }))} />
                <ManualField label="Fade" value={manual.fade} onChangeText={(v) => setManual((m) => ({ ...m, fade: v }))} />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
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
  // Pinned top block — does not scroll.
  pinned: { paddingHorizontal: 14, paddingTop: 56, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  discSelect: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  discSelectName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  discSelectSub: { color: colors.muted, fontSize: 11, marginTop: 1 },
  chevron: { color: colors.muted, fontSize: 12 },
  arcViewRow: { flexDirection: 'row', gap: 3, flexWrap: 'wrap', maxWidth: 132, justifyContent: 'flex-end' },
  arcViewPill: { borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  arcViewPillActive: { borderColor: colors.accent, backgroundColor: 'rgba(145,94,255,0.1)' },
  arcViewPillText: { color: colors.muted, fontSize: 10 },
  arcViewPillTextActive: { color: colors.accent, fontWeight: '700' },
  // Pinned arc — fixed height so the sliders below stay on-screen. The SVG scales to fit.
  arcWrap: {
    height: 230,
    aspectRatio: 280 / 420,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.015)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  teeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 6 },
  teeLabel: { fontSize: 10, color: colors.muted },
  adjRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  adjLabel: { fontSize: 10, color: colors.muted, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  adjNums: { color: colors.text, fontSize: 13, fontWeight: '600' },
  // Scrolling region.
  scroll: { flex: 1 },
  scrollContent: { padding: 14, paddingBottom: 40, gap: 12 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: colors.muted, marginBottom: 14, textTransform: 'uppercase' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  emptyText: { color: colors.muted, fontSize: 13, paddingVertical: 4, textAlign: 'center' },
  resetBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  resetBtnText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  sliderBank: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: 10 },
  sliderCol: { alignItems: 'center', gap: 6, minWidth: 84, flexBasis: '30%' },
  sliderLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: colors.muted, textTransform: 'uppercase' },
  sliderValue: { fontSize: 12, fontWeight: '700', minWidth: 44, textAlign: 'center' },
  sliderUnit: { fontSize: 9, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  collapseToggle: { paddingVertical: 4, paddingHorizontal: 4 },
  collapseToggleText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  distLabel: { fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
  distVal: { fontSize: 13, fontWeight: '700', color: colors.accent },
  distTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  distBar: { height: '100%', backgroundColor: colors.accent, borderRadius: 2 },
  baseNums: { fontSize: 10, color: colors.muted, textAlign: 'center', marginTop: 8 },
  distCaveat: { fontSize: 9, color: colors.muted, textAlign: 'center', marginTop: 6, opacity: 0.5, fontStyle: 'italic' },
  // Picker modal.
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  modalClose: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  modeTabs: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  modeTab: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6 },
  modeTabActive: { borderColor: colors.accent, backgroundColor: 'rgba(145,94,255,0.1)' },
  modeTabText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  modeTabTextActive: { color: colors.accent },
  pickerList: { maxHeight: 380 },
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
});
