// Custom catalog import — the "custom" slot in Settings' Disc Catalog picker (catalog-v2-scope.md
// follow-up). Two independent paths into the same slot: pick a local JSON file matching the
// catalog schema (mfr/name/speed/glide/turn/fade/type per disc), or point at a self-hosted
// manifest URL using the exact same manifest+asset format Try Discs uses. Either way, nothing
// is activated here — a successful import just caches the slot; the caller switches to it.
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { colors } from '../theme';
import { importCustomCatalogFromFile, syncCustomCatalogFromUrl, CatalogSyncError } from '../catalog/catalogSync';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onImported: (recordCount: number) => void;
}

export default function CustomCatalogModal({ visible, onCancel, onImported }: Props) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setUrl('');
    setBusy(false);
    setError(null);
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const pickFile = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) {
        setBusy(false);
        return;
      }
      const { recordCount } = await importCustomCatalogFromFile(result.assets[0].uri, result.assets[0].name ?? 'custom.json');
      reset();
      onImported(recordCount);
    } catch (e) {
      setBusy(false);
      setError(e instanceof CatalogSyncError ? e.message : 'Could not read that file.');
    }
  };

  const importFromUrl = async () => {
    const trimmed = url.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { manifest } = await syncCustomCatalogFromUrl(trimmed);
      reset();
      onImported(manifest.recordCount);
    } catch (e) {
      setBusy(false);
      setError(e instanceof CatalogSyncError ? e.message : 'Could not download from that URL.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleCancel} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <Text style={styles.title}>Custom catalog</Text>
          <Text style={styles.hint}>
            Import your own disc catalog — a JSON file on this device, or a URL to a self-hosted
            manifest in the same format Try Discs uses.
          </Text>

          <Pressable
            testID="custom-catalog-pick-file"
            style={[styles.actionBtn, busy && styles.actionBtnDisabled]}
            onPress={pickFile}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Choose a catalog JSON file"
          >
            <Text style={styles.actionBtnText}>Choose file…</Text>
          </Pressable>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>OR IMPORT FROM URL</Text>
          <TextInput
            testID="custom-catalog-url-input"
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://example.com/catalog/manifest.json"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!busy}
          />
          <Pressable
            testID="custom-catalog-url-go"
            style={[styles.actionBtnGhost, (busy || !url.trim()) && styles.actionBtnDisabled]}
            onPress={importFromUrl}
            disabled={busy || !url.trim()}
            accessibilityRole="button"
            accessibilityLabel="Import catalog from URL"
          >
            {busy ? <ActivityIndicator color={colors.text} size="small" /> : <Text style={styles.actionBtnGhostText}>Import from URL</Text>}
          </Pressable>

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.btnRow}>
            <View style={{ flex: 1 }} />
            <Pressable style={styles.btnGhost} onPress={handleCancel} disabled={busy} accessibilityRole="button" accessibilityLabel="Cancel">
              <Text style={styles.btnGhostText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: 28 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17, marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: colors.muted, textTransform: 'uppercase', marginBottom: 8 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },
  actionBtn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  actionBtnGhost: {
    marginTop: 10,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 46,
  },
  actionBtnGhostText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  actionBtnDisabled: { opacity: 0.5 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: colors.text,
    fontSize: 14,
  },
  error: { color: colors.danger, fontSize: 12, marginTop: 12 },
  btnRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  btnGhost: { paddingHorizontal: 16, paddingVertical: 10 },
  btnGhostText: { color: colors.muted, fontSize: 15, fontWeight: '600' },
});
