// CSV import — ported from importCSV()/previewImport()/doImport() in templates/index.html.
// Same append-not-replace semantics: imported discs are added to the existing bag, deduped
// against it, capped at MAX_IMPORT. File picking uses expo-document-picker (matches
// PORT_PLAN.md Phase 7's stated implementation); pasting text is kept too since it's a
// zero-dependency fallback that mirrors the website's own textarea path.
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { colors } from '../theme';
import type { Disc } from '../utils/disc';
import { MAX_IMPORT, previewImport } from '../utils/csv';

interface Props {
  visible: boolean;
  existingDiscs: Disc[];
  onCancel: () => void;
  onImport: (discs: Disc[]) => void;
}

export default function CsvImportModal({ visible, existingDiscs, onCancel, onImport }: Props) {
  const [text, setText] = useState('');
  const [picking, setPicking] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  const preview = useMemo(() => previewImport(text, existingDiscs), [text, existingDiscs]);

  const message = useMemo(() => {
    if (!text.trim()) return null;
    if (!preview.discs.length) {
      return preview.duplicatesSkipped > 0
        ? 'All discs in this file are already in your bag.'
        : 'No valid discs found — check column headers.';
    }
    const n = preview.discs.length;
    let msg = `Found ${n} disc${n !== 1 ? 's' : ''} — will append to your bag.`;
    if (preview.duplicatesSkipped) msg += ` (${preview.duplicatesSkipped} duplicate${preview.duplicatesSkipped !== 1 ? 's' : ''} skipped)`;
    if (preview.truncated) msg += ` Capped at ${MAX_IMPORT} per import.`;
    return msg;
  }, [text, preview]);

  const pickFile = async () => {
    // Guards against a real bug hit on-device (2026-07-24): tapping this while a previous
    // picker call hasn't settled yet throws "Different document picking in progress" as an
    // unhandled promise rejection (a red-box crash, not a UI-visible error). The `picking`
    // disabled-state on the button covers the common case; this early return + the catch
    // below cover the race where a second call still slips through.
    if (picking) return;
    setPicking(true);
    setPickError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', '*/*'] });
      if (result.canceled || !result.assets?.[0]) return;
      const content = await new File(result.assets[0].uri).text();
      setText(content);
    } catch {
      setPickError('Could not open file picker — try again, or paste the CSV text instead.');
    } finally {
      setPicking(false);
    }
  };

  const handleImport = () => {
    if (!preview.discs.length) return;
    onImport(preview.discs);
    setText('');
  };

  const handleCancel = () => {
    setText('');
    setPickError(null);
    onCancel();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleCancel} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <Text style={styles.title}>Import CSV</Text>
          <Text style={styles.hint}>
            Pick a .csv file or paste CSV text. Expected columns: Manufacturer, Mold, Plastic, Weight, Speed, Glide, Turn, Fade,
            Primary Use, Notes.
          </Text>

          <Pressable style={styles.pickBtn} onPress={pickFile} disabled={picking}>
            <Text style={styles.pickBtnText}>{picking ? 'Opening picker…' : 'Pick CSV file'}</Text>
          </Pressable>
          {pickError && <Text style={styles.errorText}>{pickError}</Text>}

          <Text style={styles.label}>Or paste CSV</Text>
          <TextInput
            style={styles.textarea}
            value={text}
            onChangeText={(v) => {
              setPickError(null);
              setText(v);
            }}
            placeholder="Paste CSV here…"
            placeholderTextColor={colors.muted}
            multiline
          />

          {message && <Text style={[styles.message, preview.discs.length ? styles.messageOk : styles.messageMuted]}>{message}</Text>}

          <View style={styles.btnRow}>
            <View style={{ flex: 1 }} />
            <Pressable style={styles.btnGhost} onPress={handleCancel}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, !preview.discs.length && styles.btnDisabled]}
              onPress={handleImport}
              disabled={!preview.discs.length}
            >
              <Text style={styles.btnText}>{preview.discs.length ? `Import ${preview.discs.length}` : 'Import'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '85%' },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  hint: { color: colors.muted, fontSize: 12, marginBottom: 12 },
  pickBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  pickBtnText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  errorText: { color: colors.danger, fontSize: 12, marginTop: -8, marginBottom: 10 },
  label: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  textarea: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    color: colors.text,
    fontFamily: 'monospace',
    fontSize: 12,
    height: 130,
    textAlignVertical: 'top',
  },
  message: { fontSize: 12, marginTop: 8, minHeight: 16 },
  messageOk: { color: colors.st },
  messageMuted: { color: colors.muted },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  btn: { backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700' },
  btnGhost: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.muted, fontWeight: '600' },
});
