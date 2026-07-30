// Add/edit form ported from showModal()/saveDisc() in templates/index.html.
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';
import type { Disc } from '../utils/disc';
import { DISC_COLORS } from '../utils/discColors';
import ColorPicker from './ColorPicker';
import NumberInput from './NumberInput';

const THROW_STYLES = ['RHBH', 'RHFH', 'LHBH', 'LHFH'] as const;
const HEX6 = /^#[0-9A-Fa-f]{6}$/;

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
  // Raw text for the custom-hex field (the RN stand-in for the website's <input type="color">).
  const [hexText, setHexText] = useState(initial.color ?? '');

  const set = <K extends keyof Disc>(key: K, value: Disc[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setNum = (key: 'speed' | 'glide' | 'turn' | 'fade', n: number) => set(key, n as never);

  // Preset swatch tap and custom-hex entry both feed the same `color` field; keep the hex
  // text box in sync so it reflects whatever's currently selected either way.
  const pickColor = (hex: string) => {
    set('color', hex);
    setHexText(hex);
  };
  const handleHex = (t: string) => {
    let v = t.trim();
    if (v && !v.startsWith('#')) v = `#${v}`;
    setHexText(v);
    if (HEX6.test(v)) set('color', v);
    else if (v === '' || v === '#') set('color', '');
  };

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
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{isNew ? 'Add disc' : 'Edit disc'}</Text>
            {isNew && onOpenLibrary && (
              <Pressable style={styles.libCta} onPress={onOpenLibrary}>
                <Text style={styles.libCtaText}>Autofill from disc library</Text>
                <Text style={styles.libCtaArrow}>›</Text>
              </Pressable>
            )}
            <Field label="Manufacturer" value={form.mfr} onChangeText={(v) => set('mfr', v)} placeholder="e.g. Innova" />
            <Field
              label="Mold"
              value={form.mold}
              onChangeText={setMold}
              placeholder="e.g. Buzzz"
              error={moldError ? 'Mold name is required' : undefined}
            />
            <Field label="Plastic" value={form.plastic ?? ''} onChangeText={(v) => set('plastic', v)} placeholder="e.g. Star" />
            <Field label="Weight" value={form.weight ?? ''} onChangeText={(v) => set('weight', v)} placeholder="e.g. 173g" />
            <View style={styles.fnGrid}>
              <NumField label="Speed" value={form.speed} onChange={(v) => setNum('speed', v)} />
              <NumField label="Glide" value={form.glide} onChange={(v) => setNum('glide', v)} />
              <NumField label="Turn" value={form.turn} onChange={(v) => setNum('turn', v)} />
              <NumField label="Fade" value={form.fade} onChange={(v) => setNum('fade', v)} />
            </View>
            <Field label="Primary use" value={form.use ?? ''} onChangeText={(v) => set('use', v)} placeholder="e.g. Overstable utility" />
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
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={form.notes ?? ''}
              onChangeText={(v) => set('notes', v)}
              placeholder="Seasoning, condition, where you got it, flight tweaks…"
              placeholderTextColor={colors.muted}
              multiline
            />
            <Text style={styles.label}>Disc color</Text>
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
                  accessibilityLabel={c.hex ? `Color ${c.hex}` : 'No color'}
                />
              ))}
            </View>
            {/* Interactive RGB picker — drag the R/G/B tracks for any custom color. */}
            <ColorPicker value={form.color || ''} onChange={pickColor} />
            <View style={styles.customColorRow}>
              <TextInput
                style={[styles.input, styles.hexInput]}
                value={hexText}
                onChangeText={handleHex}
                placeholder="or type #RRGGBB"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={7}
              />
            </View>
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
            <Pressable style={styles.btn} onPress={handleSave}>
              <Text style={styles.btnText}>{isNew ? 'Add' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function blankDisc(): Disc {
  return { mfr: '', mold: '', plastic: '', weight: '', speed: 7, glide: 4, turn: 0, fade: 2, use: '', thr: 'RHBH', notes: '', color: '' };
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
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 12 },
  libCta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.cardHover,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  libCtaText: { color: colors.accent, fontWeight: '600' },
  libCtaArrow: { color: colors.accent, fontSize: 18 },
  label: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: 12, marginTop: 4 },
  textarea: { minHeight: 70, textAlignVertical: 'top' },
  fnGrid: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  fnField: { flex: 1 },
  thrRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  thrPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  thrPillActive: { borderColor: colors.accent, backgroundColor: 'rgba(145,94,255,0.15)' },
  thrPillText: { color: colors.muted, fontSize: 13 },
  thrPillTextActive: { color: colors.accent, fontWeight: '600' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  swatchNone: { backgroundColor: colors.bg, borderColor: colors.border },
  swatchSelected: { borderColor: colors.accent },
  customColorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  hexInput: { flex: 1 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  btn: { backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '700' },
  btnGhost: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.muted, fontWeight: '600' },
  btnDanger: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: 'rgba(248,113,113,0.1)' },
  btnDangerConfirm: { backgroundColor: 'rgba(248,113,113,0.28)' },
  btnDangerText: { color: colors.danger, fontWeight: '600' },
});
