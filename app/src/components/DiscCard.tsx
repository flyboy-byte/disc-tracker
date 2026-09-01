// Card layout ported from templates/index.html's render() — mfr/mold head, 4-up flight
// number row, plastic/weight meta line, use + notes, disc-type word + stability badge,
// plus a per-disc flight-arc thumbnail (the website's signature — an arc on every card).
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { discType, stab, STAB_META, TYPE_META, type Disc } from '../utils/disc';
import { applyModifiers, type SliderValues } from '../utils/legacyPhysics';
import FlightArcSvg from './FlightArcSvg';

const HEX6 = /^#[0-9A-Fa-f]{6}$/;
type ArcView = 'RHBH' | 'RHFH' | 'LHBH' | 'LHFH';

// Card thumbnails always show the disc's own neutral flight (no wind/hyzer modifiers), so
// there is no ghost arc — the interactive shaping lives in the Flight Shaper tab.
const NEUTRAL: SliderValues = { hyzer: 0, nose: 0, wind: 0, armSpeed: 100, spin: 100 };

interface Props {
  disc: Disc;
  arcView: ArcView;
  // Callbacks receive the disc / new value so the parent can pass STABLE top-level handlers
  // (not per-item arrows). That's what lets React.memo below actually skip re-renders while
  // scrolling a large list — the B2 scroll-jank fix (b2-spike.md).
  onPress: (d: Disc) => void;
  onPressArc?: (d: Disc) => void;
  onToggleBag?: (id: number, nextInBag: boolean) => void;
  // Reorder controls (custom sort, unfiltered Collection). Replaces drag-reorder, which was
  // unreliable on-device (long-press latency + cards stacking). ⤒ top / ↑ up / ↓ down, keyed by id;
  // canMoveUp/Down disable the arrows at the ends of the list.
  onMoveToTop?: (id: number) => void;
  onMoveUp?: (id: number) => void;
  onMoveDown?: (id: number) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  // Multiselect (long-press to enter). While `selecting`, the card tap toggles selection instead
  // of opening the editor, the inner bag/arc controls go inert, and a checkbox shows on the left.
  onLongPress?: (d: Disc) => void;
  selecting?: boolean;
  checked?: boolean;
}

function DiscCardBase({ disc: d, arcView, onPress, onPressArc, onToggleBag, onMoveToTop, onMoveUp, onMoveDown, canMoveUp, canMoveDown, onLongPress, selecting, checked }: Props) {
  const s = STAB_META[stab(d)];
  const t = TYPE_META[discType(d)];
  const safeColor = d.color && HEX6.test(d.color) ? d.color : null;
  const metaLine = [d.plastic, d.weight].filter(Boolean).join(' · ');
  const adjusted = useMemo(() => applyModifiers(d, NEUTRAL), [d.speed, d.glide, d.turn, d.fade]);

  return (
    <Pressable
      testID={`disc-card-${d.id ?? d.mold}`}
      onPress={() => onPress(d)}
      onLongPress={onLongPress ? () => onLongPress(d) : undefined}
      delayLongPress={300}
      style={[
        styles.card,
        safeColor ? { borderLeftColor: safeColor, borderLeftWidth: 3 } : null,
        d.inBag ? styles.bagged : null,
        checked ? styles.selected : null,
      ]}
    >
      <View style={styles.body}>
        {selecting && (
          <View style={[styles.checkbox, checked && styles.checkboxOn]}>
            {checked && <Text style={styles.checkboxMark}>✓</Text>}
          </View>
        )}
        <View style={styles.main}>
          <View style={styles.head}>
            <View style={styles.headText}>
              <Text style={styles.mfr}>{d.mfr}</Text>
              <Text style={styles.mold}>{d.mold}</Text>
            </View>
            {onToggleBag && d.id != null && !selecting && (
              // Nested Pressable: RN routes the touch to the inner control, so tapping this
              // toggles the bag flag without also firing the card's onPress (edit) — no
              // stopPropagation needed the way the website's onclick handler required.
              <Pressable
                testID={`disc-card-toggle-bag-${d.id}`}
                onPress={() => onToggleBag(d.id!, !d.inBag)}
                hitSlop={{ top: 11, bottom: 11, left: 8, right: 8 }}
                style={[styles.bagCheck, d.inBag && styles.bagCheckOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: !!d.inBag }}
                accessibilityLabel={d.inBag ? `Remove ${d.mold} from today's bag` : `Add ${d.mold} to today's bag`}
              >
                <Text style={[styles.bagCheckText, d.inBag && styles.bagCheckTextOn]}>{d.inBag ? '✓ In bag' : 'In bag'}</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.nums}>
            <NumStat label="SPD" value={d.speed} />
            <NumStat label="GLI" value={d.glide} />
            <NumStat label="TRN" value={d.turn} />
            <NumStat label="FDE" value={d.fade} />
          </View>
          {metaLine ? (
            <Text style={styles.meta}>{metaLine}</Text>
          ) : (
            <Text style={[styles.meta, styles.metaUnknown]}>plastic / weight unknown</Text>
          )}
          {!!d.use && <Text style={styles.use}>{d.use}</Text>}
          {!!d.notes && (
            <Text style={styles.note} numberOfLines={2}>
              📝 {d.notes}
            </Text>
          )}
          <View style={styles.footerRow}>
            <Text style={styles.typeWord}>{t.word}</Text>
            <View style={[styles.badge, { backgroundColor: s.color }]}>
              <Text style={styles.badgeText}>{s.short}</Text>
            </View>
            {onMoveToTop && d.id != null && !selecting && (
              <View style={styles.reorder}>
                <ReorderBtn label="⤒" a11y={`Move ${d.mold} to top`} disabled={!canMoveUp} onPress={() => onMoveToTop(d.id!)} />
                <ReorderBtn label="↑" a11y={`Move ${d.mold} up`} disabled={!canMoveUp} onPress={() => onMoveUp?.(d.id!)} />
                <ReorderBtn label="↓" a11y={`Move ${d.mold} down`} disabled={!canMoveDown} onPress={() => onMoveDown?.(d.id!)} />
              </View>
            )}
          </View>
        </View>
        <Pressable
          style={styles.arcThumb}
          onPress={onPressArc && !selecting ? () => onPressArc(d) : undefined}
          // Nested Pressable captures the tap so the thumbnail opens arc-detail instead of
          // firing the card's edit onPress. With no handler it's inert (still no card tap).
          accessibilityRole={onPressArc ? 'button' : undefined}
          accessibilityLabel={onPressArc ? `Show ${d.mold} flight detail` : undefined}
        >
          <FlightArcSvg adjusted={adjusted} baseDisc={null} sliders={NEUTRAL} arcView={arcView} />
        </Pressable>
      </View>
    </Pressable>
  );
}

// Memoized: with stable callbacks + referentially-stable disc objects from state, this skips
// re-rendering unchanged cards while scrolling a large list. Default shallow prop compare is
// enough because the parent now passes stable handlers (see Props note above).
export default React.memo(DiscCardBase);

function NumStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.numStat}>
      <Text style={styles.numLbl}>{label}</Text>
      <Text style={styles.numVal}>{value}</Text>
    </View>
  );
}

function ReorderBtn({ label, a11y, disabled, onPress }: { label: string; a11y: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      // Three of these sit side by side with a 6px gap (styles.reorder) — horizontal hitSlop
      // is capped at 3 so adjacent buttons' hit areas touch but never overlap into a mis-tap;
      // vertical has no such neighbor, so it gets the rest of the reach to the 44dp floor.
      hitSlop={{ top: 8, bottom: 8, left: 3, right: 3 }}
      style={[styles.reorderBtn, disabled && styles.reorderBtnDisabled]}
      accessibilityRole="button"
      accessibilityLabel={a11y}
    >
      <Text style={styles.reorderBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  },
  bagged: { borderColor: colors.accent },
  selected: { borderColor: colors.accent, backgroundColor: colors.cardHover },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  checkboxOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  checkboxMark: { color: '#fff', fontSize: 14, fontWeight: '800', lineHeight: 16 },
  body: { flexDirection: 'row', gap: 10 },
  main: { flex: 1, minWidth: 0 },
  arcThumb: {
    width: 58,
    height: 88,
    // Nudge down so the arc lines up against the flight-number row rather than the mfr
    // eyebrow, matching the website card's padding-top on the arc (index.html:657).
    marginTop: 18,
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  headText: { flex: 1, minWidth: 0 },
  bagCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bagCheckOn: { borderColor: colors.accent, backgroundColor: 'rgba(145,94,255,0.15)' },
  bagCheckText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  bagCheckTextOn: { color: colors.accent },
  reorder: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  reorderBtn: { width: 34, height: 30, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  reorderBtnDisabled: { opacity: 0.3 },
  reorderBtnText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  mfr: { color: colors.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  mold: { color: colors.text, fontSize: 18, fontWeight: '700' },
  nums: { flexDirection: 'row', gap: 14, marginBottom: 6 },
  numStat: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  numLbl: { color: colors.muted, fontSize: 11 },
  numVal: { color: colors.text, fontSize: 14, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  metaUnknown: { fontStyle: 'italic', opacity: 0.7 },
  use: { color: colors.text, fontSize: 13, marginBottom: 2 },
  note: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  typeWord: { color: colors.muted, fontSize: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: '#0b0e1a', fontSize: 11, fontWeight: '700' },
});
