// Data audit (Phase 2, data-audit-scope.md) — a filtered, directly-editable list of bag discs
// missing weight, plastic, and/or a wear estimate. Deliberately NOT a tap-through to
// DiscFormModal: each row edits inline (weight/plastic text fields, a 1-5 wear-estimate pill
// row — wear-estimate-scope.md) and commits per-field as you go via updateDiscAuditFields() — no
// second screen, no save step, no fields irrelevant to this pass (color, notes, throw style).
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';
import type { Disc } from '../utils/disc';
import { updateDiscAuditFields } from '../db/db';

const WEAR_ESTIMATES = [1, 2, 3, 4, 5] as const;

interface Props {
  visible: boolean;
  discs: Disc[];
  userId: number;
  onClose: () => void;
  onFieldSaved: (discId: number, patch: Partial<Disc>) => void;
}

function isIncomplete(d: Disc): boolean {
  return !d.weight?.trim() || !d.plastic?.trim() || !d.wearEstimate;
}

export default function DataAuditModal({ visible, discs, userId, onClose, onFieldSaved }: Props) {
  const incomplete = useMemo(() => discs.filter(isIncomplete), [discs]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <Text style={styles.title}>Data audit</Text>
          <Text style={styles.hint}>
            Fill in whatever's missing — each field saves as soon as you leave it, no extra step.
          </Text>
          {incomplete.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>All discs are complete.</Text>
            </View>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
              {incomplete.map((d) => (
                <AuditRow key={d.id} disc={d} userId={userId} onFieldSaved={onFieldSaved} />
              ))}
            </ScrollView>
          )}
          <View style={styles.btnRow}>
            <View style={{ flex: 1 }} />
            <Pressable testID="data-audit-done" style={styles.btnGhost} onPress={onClose}>
              <Text style={styles.btnGhostText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AuditRow({
  disc,
  userId,
  onFieldSaved,
}: {
  disc: Disc;
  userId: number;
  onFieldSaved: (discId: number, patch: Partial<Disc>) => void;
}) {
  const [weight, setWeight] = useState(disc.weight ?? '');
  const [plastic, setPlastic] = useState(disc.plastic ?? '');

  const saveWeight = () => {
    if (weight === (disc.weight ?? '') || disc.id == null) return;
    updateDiscAuditFields(userId, disc.id, { weight });
    onFieldSaved(disc.id, { weight });
  };

  const savePlastic = () => {
    if (plastic === (disc.plastic ?? '') || disc.id == null) return;
    updateDiscAuditFields(userId, disc.id, { plastic });
    onFieldSaved(disc.id, { plastic });
  };

  const pickWearEstimate = (n: (typeof WEAR_ESTIMATES)[number]) => {
    if (disc.id == null) return;
    updateDiscAuditFields(userId, disc.id, { wearEstimate: n });
    onFieldSaved(disc.id, { wearEstimate: n });
  };

  const missing: string[] = [];
  if (!disc.weight?.trim()) missing.push('weight');
  if (!disc.plastic?.trim()) missing.push('plastic');
  if (!disc.wearEstimate) missing.push('wear estimate');

  return (
    <View testID={`audit-row-${disc.id}`} style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.rowName}>{disc.mold}</Text>
        <Text style={styles.rowMfr}>{disc.mfr || '—'}</Text>
      </View>
      <Text style={styles.rowMissing}>missing: {missing.join(', ')}</Text>
      <View style={styles.rowFields}>
        {!disc.plastic?.trim() && (
          <TextInput
            testID={`audit-row-${disc.id}-plastic`}
            style={styles.rowInput}
            value={plastic}
            onChangeText={setPlastic}
            onBlur={savePlastic}
            placeholder="Plastic"
            placeholderTextColor={colors.muted}
          />
        )}
        {!disc.weight?.trim() && (
          <TextInput
            testID={`audit-row-${disc.id}-weight`}
            style={styles.rowInput}
            value={weight}
            onChangeText={setWeight}
            onBlur={saveWeight}
            placeholder="Weight"
            placeholderTextColor={colors.muted}
          />
        )}
      </View>
      {!disc.wearEstimate && (
        <View style={styles.pillRow}>
          {WEAR_ESTIMATES.map((n) => (
            <Pressable key={n} testID={`audit-row-${disc.id}-wear-est-${n}`} onPress={() => pickWearEstimate(n)} style={styles.pill} accessibilityRole="button" accessibilityLabel={`Wear estimate ${n} of 5`}>
              <Text style={styles.pillText}>{n}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '85%' },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 4 },
  hint: { color: colors.muted, fontSize: 12, marginBottom: 12 },
  emptyState: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { color: colors.muted, fontSize: 13 },
  list: { flexShrink: 1 },
  listContent: { gap: 10, paddingBottom: 4 },
  row: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
  },
  rowHead: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 2 },
  rowName: { color: colors.text, fontWeight: '600', fontSize: 14 },
  rowMfr: { color: colors.muted, fontSize: 12 },
  rowMissing: { color: colors.us, fontSize: 11, marginBottom: 8 },
  rowFields: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  rowInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: colors.text,
    fontSize: 13,
  },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  pillText: { color: colors.muted, fontSize: 12 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  btnGhost: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.muted, fontWeight: '600' },
});
