// Result card for the Disc Suggest screen — ported from discsuggestion.html's discCardHTML()
// + stabBar(), a distinct compact layout from the Bag tab's DiscCard (no plastic/weight/notes,
// has a type chip + a -4..+7 stability position bar instead of a plain badge).
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { stabClass, stabShort, typeShort, type ScenarioDisc } from '../utils/disc';
import type { Band } from '../utils/suggestScore';

const STAB_COLOR: Record<ReturnType<typeof stabClass>, string> = {
  'stab-os': colors.os,
  'stab-st': colors.st,
  'stab-us': colors.us,
};

// Match-quality band (B1). Great = strong green, good = accent purple, marginal = muted amber.
const BAND_META: Record<Band, { label: string; color: string }> = {
  great: { label: 'Great fit', color: colors.st },
  good: { label: 'Good fit', color: colors.accent },
  marginal: { label: 'Marginal', color: colors.us },
};

interface Props {
  disc: ScenarioDisc;
  inBag: boolean;
  band?: Band;
}

export default function SuggestResultCard({ disc: d, inBag, band }: Props) {
  const cls = stabClass(d.stability);
  const bandInfo = band ? BAND_META[band] : null;

  // Exact port of stabBar(): maps -4..+7 stability to a 0-100% position, zero pinned at
  // 4/11 of the track (matches the website's own bar so the visual reads identically).
  const MIN = -4;
  const MAX = 7;
  const RANGE = MAX - MIN;
  const pct = Math.round(((d.stability - MIN) / RANGE) * 100);
  const zeroPct = Math.round(((-MIN) / RANGE) * 100);
  const isOS = d.stability >= 0;
  const left = isOS ? zeroPct : pct;
  const width = Math.abs(pct - zeroPct);

  return (
    <View style={[styles.card, inBag && styles.cardInBag]}>
      <View style={styles.topLabels}>
        {inBag && <Text style={styles.inBagLabel}>In your bag</Text>}
        {bandInfo && (
          <View style={[styles.bandChip, { borderColor: bandInfo.color }]}>
            <View style={[styles.bandDot, { backgroundColor: bandInfo.color }]} />
            <Text style={[styles.bandText, { color: bandInfo.color }]}>{bandInfo.label}</Text>
          </View>
        )}
      </View>
      <Text style={styles.name}>{d.name}</Text>
      <Text style={styles.mfr}>{d.mfr}</Text>
      <View style={styles.metaRow}>
        <View style={styles.typeChip}>
          <Text style={styles.typeChipText}>{typeShort(d.type)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: STAB_COLOR[cls] }]}>
          <Text style={styles.badgeText}>{stabShort(d.stability)}</Text>
        </View>
      </View>
      <View style={styles.nums}>
        <Text style={styles.numStrong}>{d.speed}</Text>
        <Text style={styles.numMuted}>/</Text>
        <Text style={styles.numStrong}>{d.glide}</Text>
        <Text style={styles.numMuted}>/</Text>
        <Text style={styles.numStrong}>{d.turn}</Text>
        <Text style={styles.numMuted}>/</Text>
        <Text style={styles.numStrong}>{d.fade}</Text>
      </View>
      <View style={styles.barWrap}>
        <View style={[styles.barFill, { left: `${left}%`, width: `${width}%`, backgroundColor: STAB_COLOR[cls] }]} />
        <View style={[styles.barZero, { left: `${zeroPct}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 8 },
  cardInBag: { borderColor: 'rgba(145,94,255,0.4)', backgroundColor: 'rgba(145,94,255,0.06)' },
  topLabels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, minHeight: 14 },
  inBagLabel: { color: colors.accent, fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  bandChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 'auto' },
  bandDot: { width: 6, height: 6, borderRadius: 3 },
  bandText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  mfr: { color: colors.muted, fontSize: 11, marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  typeChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  typeChipText: { color: colors.muted, fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: '#0b0e1a', fontSize: 10, fontWeight: '700' },
  nums: { flexDirection: 'row', gap: 4 },
  numStrong: { color: colors.text, fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  numMuted: { color: colors.muted, fontSize: 11 },
  barWrap: { marginTop: 8, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.07)', position: 'relative' },
  barFill: { position: 'absolute', top: 0, height: 4, borderRadius: 2 },
  barZero: { position: 'absolute', top: -3, width: 1, height: 10, backgroundColor: 'rgba(255,255,255,0.3)' },
});
