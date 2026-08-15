// CSV export — ported from exportCSV()/updateExportPreview()/downloadCSV() in
// templates/index.html. The website's "Download"/"Copy" pair becomes a single native
// share sheet on mobile (expo-sharing) — the natural mobile equivalent of "hand this file
// to another app", and covers copy-to-clipboard too on platforms whose share sheet
// includes it.
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { colors } from '../theme';
import type { Disc } from '../utils/disc';
import { buildCSV, buildSplitCSV } from '../utils/csv';

interface Props {
  visible: boolean;
  discs: Disc[];
  onCancel: () => void;
}

type Scope = 'all' | 'bag' | 'both';

export default function CsvExportModal({ visible, discs, onCancel }: Props) {
  const [scope, setScope] = useState<Scope>('all');
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const bagCount = useMemo(() => discs.filter((d) => d.inBag).length, [discs]);
  const csvText = useMemo(() => {
    if (scope === 'bag') return buildCSV(discs.filter((d) => d.inBag));
    if (scope === 'both') return buildSplitCSV(discs.filter((d) => d.inBag), discs);
    return buildCSV(discs);
  }, [discs, scope]);

  const handleShare = async () => {
    setSharing(true);
    try {
      const dir = new Directory(Paths.cache, 'exports');
      if (!dir.exists) dir.create({ intermediates: true });
      const file = new File(dir, 'disc_collection.csv');
      if (file.exists) file.delete();
      file.create();
      file.write(csvText);
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export disc collection' });
      }
    } finally {
      setSharing(false);
    }
  };

  // "Save to device" — Android only (SAF picker). Lets the user pick a real folder (e.g.
  // Downloads) and writes the CSV straight there, no share sheet round-trip through another app.
  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(false);
    try {
      const perm = await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!perm.granted) return;
      const filename = `disc_collection_${scope === 'bag' ? 'todays_bag' : scope === 'both' ? 'both' : 'all'}.csv`;
      const fileUri = await StorageAccessFramework.createFileAsync(perm.directoryUri, filename, 'text/csv');
      await StorageAccessFramework.writeAsStringAsync(fileUri, csvText);
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <Text style={styles.title}>Export CSV</Text>

          {bagCount > 0 && (
            <View style={styles.scopeRow}>
              <ScopeOption label={`All discs (${discs.length})`} active={scope === 'all'} onPress={() => setScope('all')} />
              <ScopeOption label={`Today's bag (${bagCount})`} active={scope === 'bag'} onPress={() => setScope('bag')} />
              <ScopeOption label="Both" active={scope === 'both'} onPress={() => setScope('both')} />
            </View>
          )}
          {scope === 'both' && (
            <Text style={styles.hint}>Two tables in one file — Today's Bag first, then the full collection.</Text>
          )}

          <Text style={styles.hint}>
            {Platform.OS === 'android'
              ? 'Save it straight to a folder on your device, or share it to email/another app.'
              : 'Share the CSV to save it, email it, or send it to another app.'}
          </Text>
          {downloadError && <Text style={styles.errorText}>Couldn't save the file — try again.</Text>}
          <TextInput style={styles.preview} value={csvText} editable={false} multiline scrollEnabled />

          <View style={styles.btnRow}>
            <Pressable style={styles.btnGhost} onPress={onCancel}>
              <Text style={styles.btnGhostText}>Close</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            {Platform.OS === 'android' && (
              <Pressable style={styles.btnGhost} onPress={handleDownload} disabled={downloading}>
                <Text style={styles.btnGhostText}>{downloading ? 'Saving…' : 'Save to device'}</Text>
              </Pressable>
            )}
            <Pressable style={styles.btn} onPress={handleShare} disabled={sharing}>
              <Text style={styles.btnText}>{sharing ? 'Sharing…' : 'Share CSV'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ScopeOption({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.scopePill, active && styles.scopePillActive]} onPress={onPress}>
      <Text style={[styles.scopePillText, active && styles.scopePillTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '85%' },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 12 },
  scopeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  scopePill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  scopePillActive: { borderColor: colors.accent, backgroundColor: 'rgba(145,94,255,0.12)' },
  scopePillText: { color: colors.muted, fontSize: 13 },
  scopePillTextActive: { color: colors.accent, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 12, marginBottom: 8 },
  errorText: { color: colors.danger, fontSize: 12, marginBottom: 8 },
  preview: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    color: colors.text,
    fontFamily: 'monospace',
    fontSize: 11,
    height: 200,
    textAlignVertical: 'top',
  },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  btn: { backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '700' },
  btnGhost: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.muted, fontWeight: '600' },
});
