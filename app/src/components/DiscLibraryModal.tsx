// Ported from openLibrary()/renderLibrary()/addFromLibrary() in templates/index.html, then
// extended (2026-08) with the user's personal custom library: search returns bundled discs AND
// the user's own custom_discs (badged ★), and a disc the library is missing can be added inline
// once and reused. See masterLibrary.ts (searchLibrary / CustomMasterDisc) and db.ts.
import { useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';
import { isCustom, type CustomMasterDisc, type LibraryDisc } from '../utils/masterLibrary';
import { searchLibraryCatalog } from '../catalog/catalogLoader';

interface Props {
  visible: boolean;
  customDiscs: CustomMasterDisc[];
  onCancel: () => void;
  onPick: (disc: LibraryDisc) => void;
  onAddCustom: (d: { mfr: string; name: string; speed: number; glide: number; turn: number; fade: number }) => Promise<CustomMasterDisc>;
  onDeleteCustom: (id: number) => void;
}

export default function DiscLibraryModal({ visible, customDiscs, onCancel, onPick, onAddCustom, onDeleteCustom }: Props) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const results = useMemo(() => searchLibraryCatalog(query, customDiscs), [query, customDiscs]);

  const close = () => {
    setQuery('');
    setAdding(false);
    onCancel();
  };

  const confirmDeleteCustom = (d: CustomMasterDisc) => {
    Alert.alert(`Remove "${d.name}"?`, 'This deletes it from your custom library. Discs already in your bag are unaffected.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onDeleteCustom(d.id) },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={styles.sheet}>
          {adding ? (
            <AddCustomForm
              initialName={query.trim()}
              onCancel={() => setAdding(false)}
              onSave={async (fields) => {
                const created = await onAddCustom(fields);
                setAdding(false);
                onPick(created); // added → immediately fill the bag form with it
                setQuery('');
              }}
            />
          ) : (
            <>
              <Text style={styles.title}>Disc library</Text>
              <TextInput
                style={styles.input}
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name or manufacturer…"
                placeholderTextColor={colors.muted}
                autoFocus
              />
              <Pressable style={styles.addRow} onPress={() => setAdding(true)} accessibilityRole="button" accessibilityLabel="Add a disc the library is missing">
                <Text style={styles.addRowText}>
                  ＋ Add {query.trim() ? `“${query.trim()}”` : 'a disc the library’s missing'}
                </Text>
              </Pressable>
              {!query.trim() ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.empty}>Start typing to search…</Text>
                  {customDiscs.length > 0 && (
                    <Text style={styles.emptySub}>{customDiscs.length} custom disc{customDiscs.length === 1 ? '' : 's'} in your library</Text>
                  )}
                </View>
              ) : results.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.empty}>No discs found</Text>
                </View>
              ) : (
                <FlatList
                  data={results}
                  keyExtractor={(d, i) => (isCustom(d) ? `c${d.id}` : `${d.mfr}-${d.name}-${i}`)}
                  style={styles.list}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <Pressable
                      style={styles.item}
                      onPress={() => onPick(item)}
                      onLongPress={isCustom(item) ? () => confirmDeleteCustom(item) : undefined}
                      delayLongPress={350}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={styles.itemNameRow}>
                          <Text style={styles.itemName}>{item.name}</Text>
                          {isCustom(item) && <Text style={styles.customBadge}>★ custom</Text>}
                        </View>
                        <Text style={styles.itemMfr}>{item.mfr || '—'}</Text>
                      </View>
                      <Text style={styles.itemNums}>
                        {item.speed} / {item.glide} / {item.turn} / {item.fade}
                      </Text>
                    </Pressable>
                  )}
                />
              )}
              <View style={styles.btnRow}>
                <Text style={styles.hint}>Long-press a ★ custom disc to remove it</Text>
                <Pressable style={styles.btnGhost} onPress={close}>
                  <Text style={styles.btnGhostText}>Cancel</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Inline form for a disc the bundled library is missing. Mfr + name + the four flight numbers;
// stability/type are derived (db.ts). Kept minimal — plastic/weight/notes belong on the bag entry,
// not the reusable library template.
function AddCustomForm({
  initialName,
  onCancel,
  onSave,
}: {
  initialName: string;
  onCancel: () => void;
  onSave: (d: { mfr: string; name: string; speed: number; glide: number; turn: number; fade: number }) => void;
}) {
  const [mfr, setMfr] = useState('');
  const [name, setName] = useState(initialName);
  const [speed, setSpeed] = useState('');
  const [glide, setGlide] = useState('');
  const [turn, setTurn] = useState('');
  const [fade, setFade] = useState('');

  const num = (s: string) => {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  };
  const canSave = name.trim().length > 0;

  return (
    <View>
      <Text style={styles.title}>Add to your library</Text>
      <Text style={styles.formLabel}>Manufacturer</Text>
      <TextInput style={styles.input} value={mfr} onChangeText={setMfr} placeholder="e.g. Innova" placeholderTextColor={colors.muted} />
      <Text style={styles.formLabel}>Disc name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Firebird" placeholderTextColor={colors.muted} autoFocus={!initialName} />
      <Text style={styles.formLabel}>Flight numbers</Text>
      <View style={styles.numRow}>
        <NumField label="Speed" value={speed} onChange={setSpeed} />
        <NumField label="Glide" value={glide} onChange={setGlide} />
        <NumField label="Turn" value={turn} onChange={setTurn} />
        <NumField label="Fade" value={fade} onChange={setFade} />
      </View>
      <View style={styles.formBtnRow}>
        <Pressable style={styles.btnGhost} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Back to search">
          <Text style={styles.btnGhostText}>Back</Text>
        </Pressable>
        <Pressable
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          disabled={!canSave}
          onPress={() => onSave({ mfr: mfr.trim(), name: name.trim(), speed: num(speed), glide: num(glide), turn: num(turn), fade: num(fade) })}
          accessibilityRole="button"
          accessibilityLabel="Save custom disc"
        >
          <Text style={styles.saveBtnText}>Save &amp; use</Text>
        </Pressable>
      </View>
    </View>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (s: string) => void }) {
  return (
    <View style={styles.numField}>
      <Text style={styles.numFieldLabel}>{label}</Text>
      <TextInput
        style={styles.numInput}
        value={value}
        onChangeText={onChange}
        placeholder="0"
        placeholderTextColor={colors.muted}
        keyboardType="numbers-and-punctuation"
        maxLength={4}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '85%' },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 12 },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    marginBottom: 10,
  },
  emptyWrap: { paddingVertical: 20, alignItems: 'center' },
  empty: { color: colors.muted, textAlign: 'center' },
  emptySub: { color: colors.muted, fontSize: 12, marginTop: 6, opacity: 0.8 },
  list: { maxHeight: 380 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemName: { color: colors.text, fontWeight: '600' },
  customBadge: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  itemMfr: { color: colors.muted, fontSize: 12 },
  itemNums: { color: colors.muted, fontSize: 12 },
  addRow: { paddingVertical: 11, marginBottom: 10, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: colors.accent, borderStyle: 'dashed' },
  addRowText: { color: colors.accent, fontWeight: '700' },
  btnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8 },
  hint: { color: colors.muted, fontSize: 11, flex: 1 },
  btnGhost: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.muted, fontWeight: '600' },
  // Add-custom form
  formLabel: { color: colors.muted, fontSize: 13, marginBottom: 4, marginTop: 2 },
  numRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  numField: { flex: 1 },
  numFieldLabel: { color: colors.muted, fontSize: 11, marginBottom: 4, textAlign: 'center' },
  numInput: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 8, color: colors.text, textAlign: 'center' },
  formBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  saveBtn: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontWeight: '700' },
});
