// Add/edit form ported from showModal()/saveDisc() in templates/index.html.
// Kept intentionally lean — this screen is for entering a disc's details and picking its color,
// nothing more. Grouped into Details / Flight numbers / Color, with the custom RGB sliders tucked
// behind a toggle (swatches cover the common case; no raw hex field).
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';
import type { Disc } from '../utils/disc';
import { DISC_COLORS } from '../utils/discColors';
import { isCustom, searchLibrary, type CustomMasterDisc, type LibraryDisc } from '../utils/masterLibrary';
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
  // Library autofill (add mode only): as the mold name is typed, matching discs (bundled +
  // the user's own custom_discs) suggest inline — no separate "open the library" step. Picking
  // one fills mfr/flight numbers directly. Typing something that doesn't match lets you save it
  // to the personal library too via the checkbox below, instead of a whole extra screen.
  customDiscs?: CustomMasterDisc[];
  onAddCustom?: (d: { mfr: string; name: string; speed: number; glide: number; turn: number; fade: number }) => Promise<CustomMasterDisc>;
}

// Parent must pass a `key` (e.g. disc?.id ?? 'new') so switching discs remounts this
// component fresh instead of reusing stale form state — the standard React fix for
// "reset state when a prop changes" rather than comparing state to props during render.
export default function DiscFormModal({ visible, isNew, initial, onCancel, onSave, onDelete, customDiscs, onAddCustom }: Props) {
  const [form, setForm] = useState<Disc>(initial);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [moldError, setMoldError] = useState(false);
  // Show the custom RGB sliders only on request — or straight away if the disc already wears a
  // custom color that isn't one of the preset swatches (so it's visible/editable, not hidden).
  const [showCustom, setShowCustom] = useState(
    () => !!initial.color && HEX6.test(initial.color) && !PRESET_HEXES.has(initial.color)
  );
  // Whether the current mold text was just filled in by tapping a library suggestion — hides the
  // dropdown until the user edits the name again, and hides the "save to library" checkbox since
  // a picked disc is (by definition) already in the library.
  const [pickedFromLibrary, setPickedFromLibrary] = useState(false);
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [saving, setSaving] = useState(false);

  const suggestions = useMemo<LibraryDisc[]>(() => {
    if (!isNew || pickedFromLibrary || !customDiscs) return [];
    return searchLibrary(form.mold, customDiscs, 6, form.mfr);
  }, [isNew, pickedFromLibrary, customDiscs, form.mold, form.mfr]);

  const set = <K extends keyof Disc>(key: K, value: Disc[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setNum = (key: 'speed' | 'glide' | 'turn' | 'fade', n: number) => set(key, n as never);
  const pickColor = (hex: string) => set('color', hex);

  const pickSuggestion = (m: LibraryDisc) => {
    setForm((f) => ({ ...f, mfr: m.mfr, mold: m.name, speed: m.speed, glide: m.glide, turn: m.turn, fade: m.fade }));
    setPickedFromLibrary(true);
    setSaveToLibrary(false);
    setMoldError(false);
  };

  const handleSave = async () => {
    if (!form.mold?.trim()) {
      // Inline (not a toast): this fires while the form Modal is open, and a toast rendered in
      // the app root would sit behind the native Modal layer and never be seen.
      setMoldError(true);
      return;
    }
    if (saveToLibrary && onAddCustom && !pickedFromLibrary) {
      setSaving(true);
      try {
        await onAddCustom({ mfr: form.mfr.trim(), name: form.mold.trim(), speed: form.speed, glide: form.glide, turn: form.turn, fade: form.fade });
      } finally {
        setSaving(false);
      }
    }
    onSave(form);
  };

  const setMold = (v: string) => {
    set('mold', v);
    if (v.trim()) setMoldError(false);
    if (pickedFromLibrary) setPickedFromLibrary(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Tap the dimmed area outside the sheet to dismiss (standard mobile affordance). */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{isNew ? 'Add disc' : 'Edit disc'}</Text>

            {/* Details */}
            <Text style={styles.sectionLabel}>DETAILS</Text>
            <Field label="Manufacturer" value={form.mfr} onChangeText={(v) => set('mfr', v)} placeholder="e.g. Innova" />
            <Field
              label="Mold"
              value={form.mold}
              onChangeText={setMold}
              placeholder="e.g. Buzzz — autofills from your library as you type"
              error={moldError ? 'Mold name is required' : undefined}
            />
            {suggestions.length > 0 && (
              <View style={styles.suggestBox}>
                {suggestions.map((s, i) => (
                  <Pressable
                    key={isCustom(s) ? `c${s.id}` : `${s.mfr}-${s.name}-${i}`}
                    style={styles.suggestRow}
                    onPress={() => pickSuggestion(s)}
                    accessibilityRole="button"
                    accessibilityLabel={`Autofill ${s.name} by ${s.mfr}`}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.suggestNameRow}>
                        <Text style={styles.suggestName}>{s.name}</Text>
                        {isCustom(s) && <Text style={styles.suggestBadge}>★ custom</Text>}
                      </View>
                      <Text style={styles.suggestMfr}>{s.mfr || '—'}</Text>
                    </View>
                    <Text style={styles.suggestNums}>
                      {s.speed}/{s.glide}/{s.turn}/{s.fade}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            {isNew && onAddCustom && !pickedFromLibrary && form.mold.trim().length > 0 && (
              <Pressable
                style={styles.saveLibRow}
                onPress={() => setSaveToLibrary((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: saveToLibrary }}
                accessibilityLabel="Also save this disc to my library"
              >
                <View style={[styles.checkbox, saveToLibrary && styles.checkboxOn]}>
                  {saveToLibrary && <Text style={styles.checkboxMark}>✓</Text>}
                </View>
                <Text style={styles.saveLibText}>Also save to my disc library (autofills next time)</Text>
              </Pressable>
            )}
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

            {/* Personal stability adjustment — the user-declared flight layer (optional, never
                touches the canonical mold entry). Only affects THIS owned disc's Disc Suggest
                scoring, e.g. a lightweight/beat/specialty run that flies noticeably different
                from stock. 0 = neutral/no-op. */}
            <Text style={styles.label}>Personal stability adjustment (optional)</Text>
            <Text style={styles.adjHint}>Does this specific disc fly more or less stable than stock? Only affects your Disc Suggest results.</Text>
            <View style={styles.adjRow}>
              <Pressable
                style={styles.adjBtn}
                onPress={() => set('stabilityAdj', Math.max(-2, Math.round(((form.stabilityAdj ?? 0) - 0.5) * 2) / 2))}
                accessibilityRole="button"
                accessibilityLabel="More understable"
              >
                <Text style={styles.adjBtnText}>−</Text>
              </Pressable>
              <View style={styles.adjValueWrap}>
                <Text style={styles.adjValue}>{(form.stabilityAdj ?? 0) > 0 ? `+${form.stabilityAdj}` : form.stabilityAdj ?? 0}</Text>
                <Text style={styles.adjValueLabel}>{adjLabel(form.stabilityAdj ?? 0)}</Text>
              </View>
              <Pressable
                style={styles.adjBtn}
                onPress={() => set('stabilityAdj', Math.min(2, Math.round(((form.stabilityAdj ?? 0) + 0.5) * 2) / 2))}
                accessibilityRole="button"
                accessibilityLabel="More overstable"
              >
                <Text style={styles.adjBtnText}>+</Text>
              </Pressable>
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
            <GradientButton
              style={styles.btn}
              textStyle={styles.btnText}
              onPress={handleSave}
              disabled={saving}
              label={saving ? 'Saving…' : isNew ? 'Add' : 'Save'}
            />
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

function adjLabel(v: number): string {
  if (v === 0) return 'neutral';
  return v > 0 ? 'more overstable' : 'more understable';
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
  suggestBox: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginTop: -4,
    marginBottom: 10,
    overflow: 'hidden',
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  suggestNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  suggestName: { color: colors.text, fontWeight: '600', fontSize: 13 },
  suggestBadge: { color: colors.accent, fontSize: 10, fontWeight: '700' },
  suggestMfr: { color: colors.muted, fontSize: 11 },
  suggestNums: { color: colors.muted, fontSize: 11 },
  saveLibRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  checkboxMark: { color: '#fff', fontSize: 12, fontWeight: '800', lineHeight: 14 },
  saveLibText: { color: colors.muted, fontSize: 12, flex: 1 },
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
  adjHint: { color: colors.muted, fontSize: 11, marginTop: -2, marginBottom: 8 },
  adjRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 4 },
  adjBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  adjBtnText: { color: colors.accent, fontSize: 20, fontWeight: '700' },
  adjValueWrap: { alignItems: 'center', minWidth: 110 },
  adjValue: { color: colors.text, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  adjValueLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
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
