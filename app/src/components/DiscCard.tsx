// Card layout ported from templates/index.html's render() — mfr/mold head, 4-up flight
// number row, plastic/weight meta line, use + notes, disc-type word + stability badge.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { discType, stab, STAB_META, TYPE_META, type Disc } from '../utils/disc';

const HEX6 = /^#[0-9A-Fa-f]{6}$/;

interface Props {
  disc: Disc;
  onPress: () => void;
  onLongPress?: () => void;
  dragActive?: boolean;
}

export default function DiscCard({ disc: d, onPress, onLongPress, dragActive }: Props) {
  const s = STAB_META[stab(d)];
  const t = TYPE_META[discType(d)];
  const safeColor = d.color && HEX6.test(d.color) ? d.color : null;
  const metaLine = [d.plastic, d.weight].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.card,
        safeColor ? { borderLeftColor: safeColor, borderLeftWidth: 3 } : null,
        d.inBag ? styles.bagged : null,
        dragActive ? styles.dragActive : null,
      ]}
    >
      <View style={styles.head}>
        <Text style={styles.mfr}>{d.mfr}</Text>
        <Text style={styles.mold}>{d.mold}</Text>
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
      </View>
    </Pressable>
  );
}

function NumStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.numStat}>
      <Text style={styles.numLbl}>{label}</Text>
      <Text style={styles.numVal}>{value}</Text>
    </View>
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
  dragActive: { backgroundColor: colors.cardHover, opacity: 0.9 },
  head: { marginBottom: 6 },
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
