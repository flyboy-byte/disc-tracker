// C7 — Shareable Bag Report (c7-shareable-report-scope.md). Renders today's bag as a PNG and
// pushes it through the Android share sheet — no accounts, no server, no gallery of past
// exports. Deliberately excludes location/notes/plastic/weight/wear (privacy + "not interesting
// to a viewer" — see the scope doc's Non-goals) — only mfr/mold, flight numbers, and color.
import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { colors } from '../theme';
import { discType, stab, STAB_META, TYPE_META, type Disc } from '../utils/disc';

interface Props {
  visible: boolean;
  discs: Disc[]; // already scoped to today's bag by the caller
  onCancel: () => void;
}

export default function BagReportModal({ visible, discs, onCancel }: Props) {
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<View>(null);

  const handleShare = async () => {
    if (!cardRef.current || discs.length === 0) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      const dir = new Directory(Paths.cache, 'exports');
      if (!dir.exists) dir.create({ intermediates: true });
      const file = new File(dir, 'disc_tracker_bag.png');
      if (file.exists) file.delete();
      new File(uri).copy(file);
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(file.uri, { mimeType: 'image/png', dialogTitle: 'Share your bag' });
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <Text style={styles.title}>Share your bag</Text>
          <Text style={styles.hint}>
            {discs.length === 0
              ? "Nothing checked into today's bag yet — add discs to Today's Bag first."
              : `${discs.length} disc${discs.length === 1 ? '' : 's'} in today's bag.`}
          </Text>

          {discs.length > 0 && (
            <View style={styles.previewWrap}>
              <View ref={cardRef} collapsable={false} style={styles.card}>
                <Text style={styles.cardTitle}>My Bag</Text>
                {discs.map((d, i) => (
                  <ReportRow key={d.id ?? i} disc={d} />
                ))}
                <View style={styles.cardFooter}>
                  <Text style={styles.cardFooterText}>{discs.length} discs · Disc Tracker</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.btnRow}>
            <Pressable style={styles.btnGhost} onPress={onCancel} accessibilityRole="button">
              <Text style={styles.btnGhostText}>Close</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              testID="bag-report-share"
              style={[styles.btn, (sharing || discs.length === 0) && styles.btnDisabled]}
              onPress={handleShare}
              disabled={sharing || discs.length === 0}
              accessibilityRole="button"
            >
              <Text style={styles.btnText}>{sharing ? 'Sharing…' : 'Share'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ReportRow({ disc }: { disc: Disc }) {
  const stability = stab(disc);
  const type = discType(disc);
  return (
    <View style={styles.row}>
      <View style={[styles.swatch, { backgroundColor: disc.color || colors.border }]} />
      <View style={styles.rowMain}>
        <Text style={styles.rowName} numberOfLines={1}>
          {disc.mfr} {disc.mold}
        </Text>
        <Text style={styles.rowMeta}>
          {disc.speed} / {disc.glide} / {disc.turn} / {disc.fade} · {TYPE_META[type].label}
        </Text>
      </View>
      <View style={[styles.stabBadge, { borderColor: STAB_META[stability].color }]}>
        <Text style={[styles.stabBadgeText, { color: STAB_META[stability].color }]}>{STAB_META[stability].short}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '85%' },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 4 },
  hint: { color: colors.muted, fontSize: 12, marginBottom: 12 },
  previewWrap: { borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  card: { backgroundColor: colors.bg, padding: 18 },
  cardTitle: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  swatch: { width: 14, height: 14, borderRadius: 7 },
  rowMain: { flex: 1 },
  rowName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  rowMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  stabBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  stabBadgeText: { fontSize: 11, fontWeight: '700' },
  cardFooter: { marginTop: 14, alignItems: 'center' },
  cardFooterText: { color: colors.muted, fontSize: 11 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  btn: { backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700' },
  btnGhost: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.muted, fontWeight: '600' },
});
