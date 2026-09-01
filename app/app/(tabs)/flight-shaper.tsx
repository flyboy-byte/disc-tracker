// Flight Shaper screen — PORT_PLAN.md Phase 5, layout reworked in R2 (2026-07-25).
// Ported from templates/flightshape.html's setMode()/onSlider()/updateArc()/setBaseDisc()/
// loadBag()/onManualChange().
//
// Physics-sim mode (R4.5, 2026-07-29): the vendored shotshaper rigid-body simulator is now
// ported to run FULLY ON-DEVICE (src/physics/sim/*, a faithful RK45 reimplementation gated by a
// parity harness against the real numpy/scipy engine) — so this no longer needs the Flask server
// the website's sim mode calls. Opt-in per screen (off by default); when on, the arc swaps for the
// simulated trajectory + an archetype picker + the slow-disc caveat, exactly like the website.
//
// R2 layout rework (layout-ONLY — physics/arc geometry/slider semantics unchanged): the disc
// selector + arc + adjusted stats are PINNED at the top so the arc stays visible while you
// adjust the sliders below; the reference diagrams collapse behind a toggle; the disc picker
// moved from a long inline list into a compact selector + bottom-sheet modal.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
// gesture-handler's ScrollView (not react-native's) — its NativeViewGestureHandler
// negotiates touch claims with nested native views (our rotated Slider) properly;
// plain RN ScrollView won on-device even with scrollEnabled toggling (confirmed
// 2026-07-23, see VerticalSlider.tsx).
import { ScrollView } from 'react-native-gesture-handler';
import { useFocusEffect } from 'expo-router';
import AngleRefDiagrams from '../../src/components/AngleRefDiagrams';
import FlightArcSvg from '../../src/components/FlightArcSvg';
import SimArcSvg from '../../src/components/SimArcSvg';
import HyzerReferenceDiagram from '../../src/components/HyzerReferenceDiagram';
import NumberInput from '../../src/components/NumberInput';
import VerticalSlider from '../../src/components/VerticalSlider';
import { getDiscs, getMeta, getOrCreateDefaultUser, setMeta } from '../../src/db/db';
import Icon from '../../src/components/Icon';
import { colors, tints } from '../../src/theme';
import { STAB_META, stab, type Disc } from '../../src/utils/disc';
import { applyModifiers, estimateDist, type BaseDisc, type SliderValues } from '../../src/utils/legacyPhysics';
import { simulateShot } from '../../src/physics/sim/simulateShot';
import { pickArchetype } from '../../src/physics/sim/pickArchetype';
import type { Archetype } from '../../src/physics/sim/coeffs';

const ARCHETYPES: Archetype[] = ['fd2', 'cd5', 'cd1', 'dd2'];
// The physics sim is a port of shotshaper (GPLv3) by Knut Erik Teigen Giljarhus — credited here
// and in Settings, per its license and because it's the right thing to do.
const SHOTSHAPER_URL = 'https://github.com/kegiljarhus/shotshaper';

function crosswindLabel(v: number): string {
  if (v === 0) return 'calm';
  return v > 0 ? `+${v} R` : `${Math.abs(v)} L`;
}

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
  // Physics-sim mode (R4.5). Off by default. crosswind is a sim-only 6th input (the legacy
  // Bézier arc has no crosswind concept, so it lives outside SliderValues). manualArchetype is
  // set when the user overrides the auto-pick; simArchetypeManual re-arms auto on a new disc.
  const [physicsSimOn, setPhysicsSimOn] = useState(false);
  const [crosswind, setCrosswind] = useState(0);
  const [manualArchetype, setManualArchetype] = useState<Archetype | null>(null);
  const [simArchetypeManual, setSimArchetypeManual] = useState(false);
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

  // Real recorded weight (grams) as the sim mass, when the selected bag disc has one; manual
  // discs have no weight so the sim falls back to 175 g (handled inside simulateShot).
  const weightG = useMemo(() => {
    if (mode === 'bag' && selectedBagDisc?.weight) {
      const w = parseFloat(selectedBagDisc.weight);
      return Number.isFinite(w) ? w : undefined;
    }
    return undefined;
  }, [mode, selectedBagDisc]);

  // Auto-pick the nearest archetype from the disc's own numbers, unless the user overrode it.
  const simArchetype: Archetype = useMemo(() => {
    if (simArchetypeManual && manualArchetype) return manualArchetype;
    return baseDisc ? pickArchetype(baseDisc) : 'dd2';
  }, [simArchetypeManual, manualArchetype, baseDisc]);

  // Run the on-device sim only in sim mode. simulateShot is a few hundred RK45 steps — fast
  // enough to run synchronously on slider changes; if it ever janks, debounce here.
  const simResult = useMemo(() => {
    if (!physicsSimOn || !baseDisc) return null;
    return simulateShot({
      archetype: simArchetype,
      pdgaSpeed: baseDisc.speed ?? 7,
      hyzer: sliders.hyzer,
      nose: sliders.nose,
      wind: sliders.wind,
      crosswind,
      armSpeed: sliders.armSpeed,
      spin: sliders.spin,
      arcView,
      weightG,
    });
  }, [physicsSimOn, baseDisc, simArchetype, sliders, crosswind, arcView, weightG]);

  const showSim = physicsSimOn && simResult != null;
  const simCaveat = physicsSimOn && baseDisc != null && (baseDisc.speed ?? 7) <= 8;

  const changeArcView = async (v: ArcView) => {
    setArcView(v);
    if (userId != null) await setMeta(userId, { arcView: v });
  };

  const resetSliders = () => setSliders(DEFAULT_SLIDERS);
  const setSlider = (key: keyof SliderValues) => (v: number) => setSliders((s) => ({ ...s, [key]: Math.round(v) }));

  const pickBagDisc = (id: number | null) => {
    setSelectedBagId(id);
    setPickerOpen(false);
    setSimArchetypeManual(false); // a newly selected disc re-engages archetype auto-pick
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
          <Pressable style={styles.discSelect} onPress={() => setPickerOpen(true)} hitSlop={5} accessibilityRole="button" accessibilityLabel="Choose disc">
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.discSelectName} numberOfLines={1}>{selectorTitle}</Text>
              {selectorSub && <Text style={styles.discSelectSub}>{selectorSub}</Text>}
            </View>
            <Icon name="chevron-down" color={colors.muted} size={18} />
          </Pressable>

          {/* arc-view pills */}
          <View style={styles.arcViewRow}>
            {(['RHBH', 'RHFH', 'LHBH', 'LHFH'] as ArcView[]).map((v) => (
              <Pressable key={v} onPress={() => changeArcView(v)} style={[styles.arcViewPill, arcView === v && styles.arcViewPillActive]} hitSlop={10}>
                <Text style={[styles.arcViewPillText, arcView === v && styles.arcViewPillTextActive]}>{v}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.arcWrap}>
          {showSim ? (
            <SimArcSvg points={simResult!.points} />
          ) : baseDisc && adjusted ? (
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

          {/* Physics-sim toggle (R4.5) — runs the on-device shotshaper sim in place of the arc. */}
          <View style={styles.simToggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.simToggleTitle}>Physics sim</Text>
              <Pressable onPress={() => Linking.openURL(SHOTSHAPER_URL)} accessibilityRole="link" accessibilityLabel="shotshaper source, opens GitHub">
                <Text style={styles.simToggleSub}>
                  Rigid-body trajectory via <Text style={styles.simCreditLink}>shotshaper</Text> — K.E.T. Giljarhus, GPLv3 ↗
                </Text>
              </Pressable>
            </View>
            <Switch
              value={physicsSimOn}
              onValueChange={setPhysicsSimOn}
              trackColor={{ false: colors.border, true: '#38bdf8' }}
              thumbColor="#fff"
              accessibilityLabel="Physics sim"
            />
          </View>

          {physicsSimOn && (
            <View style={styles.simInfo}>
              <Text style={styles.simInfoText}>
                <Text style={styles.simInfoBold}>These are two different models.</Text> The physics sim runs a real
                rigid-body flight model — more accurate to actual physics, but the research data only covers{' '}
                <Text style={styles.simInfoBold}>4 driver archetypes</Text> (no putters or mids), so a disc is matched to
                its nearest one. The default arc instead draws each disc&apos;s{' '}
                <Text style={styles.simInfoBold}>real-world expected flight</Text> from its flight numbers — shaped to
                look right, not simulated — so it covers every disc. Expect the two to disagree.
              </Text>
            </View>
          )}

          {physicsSimOn && (
            <View style={styles.archetypeRow}>
              <Text style={styles.archetypeLabel}>ARCHETYPE</Text>
              {ARCHETYPES.map((a) => {
                const active = simArchetype === a;
                const isAuto = active && !simArchetypeManual;
                return (
                  <Pressable
                    key={a}
                    onPress={() => {
                      setManualArchetype(a);
                      setSimArchetypeManual(true);
                    }}
                    style={[styles.archPill, active && styles.archPillActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.archPillText, active && styles.archPillTextActive]}>{isAuto ? `${a} ·auto` : a}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {simCaveat && (
            <View style={styles.caveat}>
              <Text style={styles.caveatText}>
                Extrapolating from driver-only data — shotshaper has no putter/midrange model, so slow discs use the fairway-driver archetype.
              </Text>
            </View>
          )}

          <View style={styles.sliderBank}>
            <SliderCol label="Hyzer" formatKey="hyzer" unit="degrees" value={sliders.hyzer} min={-30} max={30} isDefault={sliders.hyzer === 0} onChange={setSlider('hyzer')} onScrollLock={setScrollEnabled} />
            <SliderCol label="Nose" formatKey="nose" unit="pitch" value={sliders.nose} min={-15} max={15} isDefault={sliders.nose === 0} onChange={setSlider('nose')} onScrollLock={setScrollEnabled} />
            <SliderCol label="Wind" formatKey="wind" unit="mph" value={sliders.wind} min={-20} max={20} isDefault={sliders.wind === 0} onChange={setSlider('wind')} onScrollLock={setScrollEnabled} />
            {physicsSimOn && (
              <SliderCol label="Cross" formatKey="wind" unit="mph" valueText={crosswindLabel(crosswind)} value={crosswind} min={-20} max={20} isDefault={crosswind === 0} onChange={(v) => setCrosswind(Math.round(v))} onScrollLock={setScrollEnabled} />
            )}
            <SliderCol label="Arm" formatKey="armSpeed" unit="power" value={sliders.armSpeed} min={50} max={100} isDefault={sliders.armSpeed === 100} onChange={setSlider('armSpeed')} onScrollLock={setScrollEnabled} />
            <SliderCol label="Spin" formatKey="spin" unit="rpm" value={sliders.spin} min={50} max={100} isDefault={sliders.spin === 100} onChange={setSlider('spin')} onScrollLock={setScrollEnabled} />
          </View>
        </View>

        {/* collapsible reference diagrams — collapsed by default so sliders sit near the arc */}
        <Pressable style={styles.collapseToggle} onPress={() => setDiagramsOpen((v) => !v)} hitSlop={9} accessibilityRole="button" accessibilityState={{ expanded: diagramsOpen }}>
          <Icon name={diagramsOpen ? 'chevron-down' : 'chevron-right'} color={colors.accent} size={16} />
          <Text style={styles.collapseToggleText}>Angle & hyzer reference</Text>
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
      <NumberInput style={styles.input} value={value} onChangeValue={onChangeText} />
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
  valueText,
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
  valueText?: string; // overrides the SliderValues-keyed label (used by the sim-only crosswind col)
  onScrollLock: (enabled: boolean) => void;
}) {
  return (
    <View style={styles.sliderCol}>
      <Text style={styles.sliderLabel}>{label}</Text>
      <Text style={[styles.sliderValue, { color: isDefault ? colors.muted : colors.accent }]}>{valueText ?? sliderLabel(formatKey, value)}</Text>
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
  // Fixed 2×2 grid (each pill a set width so exactly two fit per row) — avoids the ragged 3+1
  // wrap the old maxWidth produced.
  arcViewRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', width: 128, justifyContent: 'flex-end' },
  arcViewPill: { width: 62, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingVertical: 4 },
  arcViewPillActive: { borderColor: colors.accent, backgroundColor: tints.accentTint },
  arcViewPillText: { color: colors.muted, fontSize: 10, fontWeight: '600' },
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
  // Physics-sim controls (R4.5).
  simToggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, marginBottom: 10 },
  simToggleTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  simToggleSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  simCreditLink: { color: '#38bdf8', fontWeight: '700' },
  simInfo: { backgroundColor: 'rgba(56,189,248,0.07)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.25)', borderRadius: 10, padding: 10, marginBottom: 12 },
  simInfoText: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  simInfoBold: { color: colors.text, fontWeight: '700' },
  archetypeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  archetypeLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: colors.muted, marginRight: 2 },
  archPill: { borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  archPillActive: { borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.12)' },
  archPillText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  archPillTextActive: { color: '#38bdf8' },
  caveat: { backgroundColor: 'rgba(251,191,36,0.08)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)', borderRadius: 8, padding: 8, marginBottom: 12 },
  caveatText: { color: '#fbbf24', fontSize: 11, lineHeight: 15 },
  sliderBank: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: 10 },
  sliderCol: { alignItems: 'center', gap: 6, minWidth: 84, flexBasis: '30%' },
  sliderLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: colors.muted, textTransform: 'uppercase' },
  sliderValue: { fontSize: 12, fontWeight: '700', minWidth: 44, textAlign: 'center' },
  sliderUnit: { fontSize: 9, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  collapseToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 4 },
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
