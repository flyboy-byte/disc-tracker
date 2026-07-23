// Ported from openLibrary()/renderLibrary()/addFromLibrary() in templates/index.html.
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';
import { searchMaster, type MasterDisc } from '../utils/masterLibrary';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onPick: (disc: MasterDisc) => void;
}

export default function DiscLibraryModal({ visible, onCancel, onPick }: Props) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchMaster(query), [query]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Disc library</Text>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or manufacturer…"
            placeholderTextColor={colors.muted}
            autoFocus
          />
          {!query.trim() ? (
            <Text style={styles.empty}>Start typing to search…</Text>
          ) : results.length === 0 ? (
            <Text style={styles.empty}>No discs found</Text>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(d, i) => `${d.mfr}-${d.name}-${i}`}
              style={styles.list}
              renderItem={({ item }) => (
                <Pressable style={styles.item} onPress={() => onPick(item)}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMfr}>{item.mfr}</Text>
                  </View>
                  <Text style={styles.itemNums}>
                    {item.speed} / {item.glide} / {item.turn} / {item.fade}
                  </Text>
                </Pressable>
              )}
            />
          )}
          <View style={styles.btnRow}>
            <View style={{ flex: 1 }} />
            <Pressable style={styles.btnGhost} onPress={onCancel}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '80%' },
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
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: 24 },
  list: { maxHeight: 400 },
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
  itemName: { color: colors.text, fontWeight: '600' },
  itemMfr: { color: colors.muted, fontSize: 12 },
  itemNums: { color: colors.muted, fontSize: 12 },
  btnRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  btnGhost: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.muted, fontWeight: '600' },
});
