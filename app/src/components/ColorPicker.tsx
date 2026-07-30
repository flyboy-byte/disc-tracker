// Interactive RGB color picker (three touch-draggable R/G/B tracks + live preview). Built on RN's
// gesture responder system — no new dependency (keeps the F-Droid dep set minimal). Controlled:
// `value` is a #RRGGBB hex (or '' for none), `onChange` emits a #RRGGBB hex as you drag.
import { useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { colors } from '../theme';

const HEX6 = /^#[0-9A-Fa-f]{6}$/;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
function toHex(n: number): string {
  return clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
}
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  if (!HEX6.test(hex)) return { r: 128, g: 128, b: 128 }; // sensible default when none/invalid
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

interface ChannelProps {
  label: string;
  value: number; // 0..255
  trackColorFor: (t: number) => string; // gradient endpoints faked via a solid fill tint
  onChange: (v: number) => void;
}

function Channel({ label, value, trackColorFor, onChange }: ChannelProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const handle = (e: GestureResponderEvent) => {
    if (width <= 0) return;
    onChange(clamp(Math.round((e.nativeEvent.locationX / width) * 255), 0, 255));
  };
  const pct = (value / 255) * 100;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={styles.track}
        onLayout={onLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handle}
        onResponderMove={handle}
        accessibilityRole="adjustable"
        accessibilityLabel={`${label} ${value}`}
      >
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: trackColorFor(value) }]} />
        <View style={[styles.thumb, { left: `${pct}%` }]} />
      </View>
      <Text style={styles.val}>{value}</Text>
    </View>
  );
}

export default function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const { r, g, b } = hexToRgb(value);
  const emit = (nr: number, ng: number, nb: number) => onChange(rgbToHex(nr, ng, nb));
  return (
    <View style={styles.wrap}>
      <View style={styles.previewRow}>
        <View style={[styles.preview, HEX6.test(value) ? { backgroundColor: value } : styles.previewNone]} />
        <Text style={styles.previewHex}>{HEX6.test(value) ? value.toUpperCase() : 'no color'}</Text>
      </View>
      <Channel label="R" value={r} trackColorFor={(t) => rgbToHex(t, g, b)} onChange={(v) => emit(v, g, b)} />
      <Channel label="G" value={g} trackColorFor={(t) => rgbToHex(r, t, b)} onChange={(v) => emit(r, v, b)} />
      <Channel label="B" value={b} trackColorFor={(t) => rgbToHex(r, g, t)} onChange={(v) => emit(r, g, v)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 4 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  preview: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  previewNone: { backgroundColor: colors.bg },
  previewHex: { color: colors.muted, fontSize: 13, fontVariant: ['tabular-nums'], letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', width: 14 },
  track: { flex: 1, height: 26, borderRadius: 13, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 13 },
  thumb: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', borderWidth: 2, borderColor: 'rgba(0,0,0,0.35)', marginLeft: -9 },
  val: { color: colors.text, fontSize: 12, width: 30, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
