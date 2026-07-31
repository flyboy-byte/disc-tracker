// Add/edit form ported from showModal()/saveDisc() in templates/index.html.
// Kept intentionally lean — this screen is for entering a disc's details and picking its color,
// nothing more. Grouped into Details / Flight numbers / Color, with the custom RGB sliders tucked
// behind a toggle (swatches cover the common case; no raw hex field).
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';
import type { Disc } from '../utils/disc';
import { DISC_COLORS } from '../utils/discColors';
import ColorPicker from './ColorPicker';
import GradientButton from './GradientButton';
import NumberInput from './NumberInput';

const THROW_STYLES = ['RHBH', 'RHFH', 'LHBH', 'LHFH'] as const;
const HEX6 = /^#[0-9A-Fa-f]{6}$/;
const PRESET_HEXES = new Set(DISC_COLORS.map((c) => c.hex));

interface Props {
  visible: boolean;
  isNew: boolean;
  initial: Disc; // blank template for add mode, or the existing disc for edit mode
  onCancel: () => void;
  onSave: (disc: Disc) => void;
  onDelete?: (id: number) => void;
  onOpenLibrary?: () => void;
}

// Parent must pass a `key` (e.g. disc?.id ?? 'new') so switching discs remounts this
// component fresh instead of reusing stale form state — the standard React fix for
// "reset state when a prop changes" rather than comparing state to props during render.
export default function DiscFormModal({ visible, isNew, initial, onCancel, onSave, onDelete, onOpenLibrary }: Props) {
  const [form, setForm] = useState<Disc>(initial);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [moldError, setMoldError] = useState(false);
  // Show the custom RGB sliders only on request — or straight away if the disc already wears a
  // custom color that isn't one of the preset swatches (so it's visible/editable, not hidden).
  const [showCustom, setShowCustom] = useState(
    () => !!initial.color && HEX6.test(initial.color) && !PRESET_HEXES.has(initial.color)
  );

  const set = <K extends keyof Disc>(key: K, value: Disc[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setNum = (key: 'speed' | 'glide' | 'turn' | 'fade', n: number) => set(key, n as never);
  const pickColor = (hex: string) => set('color', hex);

  const handleSave = () => {
    if (!form.mold?.trim()) {
      // Inline (not a toast): this fires while the form Modal is open, and a toast rendered in
      // the app root would sit behind the native Modal layer and never be seen.
      setMoldError(true);
      return;
    }
    onSave(form);
  };

  const setMold = (v: string) => {
    set('mold', v);
    if (v.trim()) setMoldError(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Tap the dimmed area outside the sheet to dismiss (standard mobile affordance). */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{isNew ? 'Add disc' : 'Edit disc'}</Text>
            {isNew && onOpenLibrary && (
              <Pressable style={styles.libCta} onPress={onOpenLibrary}>
                <Text style={styles.libCtaText}>Autofill from disc library</Text>
                <Text style={styles.libCtaArrow}>›</Text>
              </Pressable>
            )}

            {/* Details */}
            <Text style={styles.sectionLabel}>DETAILS</Text>
            <Field label="Manufacturer" value={form.mfr} onChangeText={(v) => set('mfr', v)} placeholder="e.g. Innova" />
            <Field
              label="Mold"
              value={form.mold}
              onChangeText={setMold}
              placeholder="e.g. Buzzz"
              error={moldError ? 'Mold name is required' : undefined}
            />
            <View style={styles.pairRow}>
              <View style={styles.pairCol}>
                <Field label="Plastic" value={form.plastic ?? ''} onChangeText={(v) => set('plastic', v)} placeholder="e.g. Star" />
              </View>
              <View style={styles.pairCol}>
                <Field label="Weight" value={form.weight ?? ''} onChangeText={(v) => set('weight', v)} placeholder="e.g. 173g" />
              </View>
            </View>
            <Field label="Primary use" value={form.use ?? ''} onChangeText={(v) => set('use', v)} placeholder="e.g. Overstable utility" />

            {/* Flight numbers */}
            <Text style={styles.sectionLabel}>FLIGHT NUMBERS</Text>
            <View style={styles.fnGrid}>
              <NumField label="Speed" value={form.speed} onChange={(v) => setNum('speed', v)} />
              <NumField label="Glide" value={form.glide} onChange={(v) => setNum('glide', v)} />
              <NumField label="Turn" value={form.turn} onChange={(v) => setNum('turn', v)} />
              <NumField label="Fade" value={form.fade} onChange={(v) => setNum('fade', v)} />
            </View>
            <Text style={styles.label}>Throw style</Text>
            <View style={styles.thrRow}>
              {THROW_STYLES.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => set('thr', t)}
                  style={[styles.thrPill, (form.thr || 'RHBH') === t && styles.thrPillActive]}
                >
                  <Text style={[styles.thrPillText, (form.thr || 'RHBH') === t && styles.thrPillTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </View>

            {/* Notes */}
            <Text style={styles.sectionLabel}>NOTES</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={form.notes ?? ''}
              onChangeText={(v) => set('notes', v)}
              placeholder="Seasoning, condition, where you got it, flight tweaks…"
              placeholderTextColor={colors.muted}
              multiline
            />

            {/* Color — swatches for the common case, RGB sliders behind a toggle. No hex field. */}
            <Text style={styles.sectionLabel}>COLOR</Text>
            <View style={styles.colorRow}>
              {DISC_COLORS.map((c) => (
                <Pressable
                  key={c.hex || 'none'}
                  onPress={() => pickColor(c.hex)}
                  style={[
                    styles.swatch,
                    c.hex ? { backgroundColor: c.hex } : styles.swatchNone,
                    (form.color || '') === c.hex && styles.swatchSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={c.hex ? c.label ?? `Color ${c.hex}` : 'No color'}
                />
              ))}
            </View>
            <Pressable
              style={styles.customToggle}
              onPress={() => setShowCustom((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showCustom }}
              accessibilityLabel="Custom color"
            >
              <Text style={styles.customToggleText}>{showCustom ? '− Custom color' : '+ Custom color'}</Text>
            </Pressable>
            {showCustom && (
              <View style={styles.customPicker}>
                <ColorPicker value={form.color || ''} onChange={pickColor} />
              </View>
            )}
          </ScrollView>
          <View style={styles.btnRow}>
            {!isNew && onDelete && initial.id != null && (
              <Pressable
                style={[styles.btnDanger, confirmingDelete && styles.btnDangerConfirm]}
                onPress={() => (confirmingDelete ? onDelete(initial.id!) : setConfirmingDelete(true))}
              >
                <Text style={styles.btnDangerText}>{confirmingDelete ? 'Confirm remove?' : 'Remove'}</Text>
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            <Pressable style={styles.btnGhost} onPress={onCancel}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </Pressable>
            <GradientButton style={styles.btn} textStyle={styles.btnText} onPress={handleSave} label={isNew ? 'Add' : 'Save'} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  error?: string;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
      />
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.fnField}>
      <Text style={styles.label}>{label}</Text>
      <NumberInput style={styles.input} value={value} onChangeValue={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '88%' },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 14 },
  libCta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.cardHover,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  libCtaText: { color: colors.accent, fontWeight: '600' },
  libCtaArrow: { color: colors.accent, fontSize: 18 },
  // Section headers group the form so it reads as three short sections, not one long list.
  sectionLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 18,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: 12, marginTop: 4 },
  textarea: { minHeight: 70, textAlignVertical: 'top' },
  pairRow: { flexDirection: 'row', gap: 10 },
  pairCol: { flex: 1 },
  fnGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  fnField: { flex: 1 },
  thrRow: { flexDirection: 'row', gap: 8 },
  thrPill: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  thrPillActive: { borderColor: colors.accent, backgroundColor: 'rgba(145,94,255,0.15)' },
  thrPillText: { color: colors.muted, fontSize: 13 },
  thrPillTextActive: { color: colors.accent, fontWeight: '600' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  swatchNone: { backgroundColor: colors.bg, borderColor: colors.border },
  swatchSelected: { borderColor: colors.accent, borderWidth: 3 },
  customToggle: { alignSelf: 'flex-start', marginTop: 14, paddingVertical: 6, paddingHorizontal: 2 },
  customToggleText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  customPicker: { marginTop: 6 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  btn: { backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '700' },
  btnGhost: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.muted, fontWeight: '600' },
  btnDanger: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: 'rgba(248,113,113,0.1)' },
  btnDangerConfirm: { backgroundColor: 'rgba(248,113,113,0.28)' },
  btnDangerText: { color: colors.danger, fontWeight: '600' },
});
