// Arc-detail sheet — ported from showArcDetail() in templates/index.html. Opens from a bag
// card's arc thumbnail and shows the disc's full computed flight arc (neutral, no modifiers)
// plus its stats, with an Edit button. The Marshall Street reference image the website shows
// here is deferred to R4 (see PORT_PLAN.md) — this renders the computed arc only for now.
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { discType, stab, STAB_META, TYPE_META, type Disc } from '../utils/disc';
import { applyModifiers, type SliderValues } from '../utils/legacyPhysics';
import { fetchMsPicUrl } from '../net/msPic';
import FlightArcSvg from './FlightArcSvg';

type ArcView = 'RHBH' | 'RHFH' | 'LHBH' | 'LHFH';
const NEUTRAL: SliderValues = { hyzer: 0, nose: 0, wind: 0, armSpeed: 100, spin: 100 };

interface Props {
  disc: Disc | null;
  arcView: ArcView;
  msRefEnabled: boolean;
  onClose: () => void;
  onEdit: () => void;
}

export default function ArcDetailModal({ disc, arcView, msRefEnabled, onClose, onEdit }: Props) {
  // Retain the last disc so the slide-out animation still has content to render after `disc`
  // has already gone null (otherwise the sheet vanishes instantly instead of animating out).
  const [shown, setShown] = useState<Disc | null>(disc);
  useEffect(() => {
    if (disc) setShown(disc);
  }, [disc]);
  const d = disc ?? shown;

  return (
    <Modal visible={disc != null} transparent animationType="slide" onRequestClose={onClose}>
      {d && <Content d={d} arcView={arcView} msRefEnabled={msRefEnabled} onClose={onClose} onEdit={onEdit} />}
    </Modal>
  );
}

function Content({ d, arcView, msRefEnabled, onClose, onEdit }: { d: Disc; arcView: ArcView; msRefEnabled: boolean; onClose: () => void; onEdit: () => void }) {
  const s = STAB_META[stab(d)];
  const t = TYPE_META[discType(d)];
  const adjusted = applyModifiers(d, NEUTRAL);
  const metaLine = [d.plastic, d.weight].filter(Boolean).join(' · ');

  // Marshall Street reference image: opt-in, RHBH-only, one network request on open (or a cache
  // hit → no request). undefined = not resolved yet; null = show the computed arc; string = URL.
  // Any failure — offline, no match, broken image — silently falls back to the computed arc.
  const [msUrl, setMsUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    if (msRefEnabled && arcView === 'RHBH') {
      setMsUrl(undefined);
      fetchMsPicUrl(d.mfr, d.mold)
        .then((u) => alive && setMsUrl(u))
        .catch(() => alive && setMsUrl(null));
    } else {
      setMsUrl(null);
    }
    return () => {
      alive = false;
    };
  }, [msRefEnabled, arcView, d.mfr, d.mold]);

  const showMsImage = typeof msUrl === 'string';

  return (
    <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView>
            <View style={styles.head}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.mfr}>{d.mfr}</Text>
                <Text style={styles.mold}>{d.mold}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: s.color }]}>
                <Text style={styles.badgeText}>{s.short}</Text>
              </View>
            </View>

            {showMsImage ? (
              <>
                <View style={styles.msImgBox}>
                  {/* onError → drop back to the computed arc; the image sits on white since the
                      Marshall Street flight-path graphic is drawn for a light background. */}
                  <Image
                    source={{ uri: msUrl as string }}
                    style={styles.msImg}
                    resizeMode="contain"
                    onError={() => setMsUrl(null)}
                    accessibilityLabel={`Marshall Street flight path for ${d.mold}`}
                  />
                </View>
                <Text style={styles.arcViewLabel}>Marshall Street flight path · RHBH</Text>
              </>
            ) : (
              <>
                <View style={styles.arcBox}>
                  <FlightArcSvg adjusted={adjusted} baseDisc={null} sliders={NEUTRAL} arcView={arcView} />
                </View>
                <Text style={styles.arcViewLabel}>{arcView}</Text>
              </>
            )}

            <View style={styles.nums}>
              <NumStat label="SPD" value={d.speed} />
              <NumStat label="GLI" value={d.glide} />
              <NumStat label="TRN" value={d.turn} />
              <NumStat label="FDE" value={d.fade} />
            </View>

            <Text style={styles.typeWord}>{t.word}</Text>
            {!!metaLine && <Text style={styles.meta}>{metaLine}</Text>}
            {!!d.use && <Text style={styles.use}>{d.use}</Text>}
            {!!d.notes && <Text style={styles.note}>📝 {d.notes}</Text>}
          </ScrollView>

          <View style={styles.btnRow}>
            <Pressable style={styles.btnGhost} onPress={onClose}>
              <Text style={styles.btnGhostText}>Close</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Edit ${d.mold}`}>
              <Text style={styles.btnText}>Edit</Text>
            </Pressable>
          </View>
        </View>
      </View>
  );
}

function NumStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.numStat}>
      <Text style={styles.numLbl}>{label}</Text>
      <Text style={styles.numVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '90%' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  mfr: { color: colors.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  mold: { color: colors.text, fontSize: 22, fontWeight: '800' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  badgeText: { color: '#0b0e1a', fontSize: 12, fontWeight: '700' },
  arcBox: { alignSelf: 'center', width: 200, height: 300 },
  // Marshall Street graphics are 400×340 on a white ground — give them a white card so they read
  // against the dark sheet instead of clashing with it.
  msImgBox: { alignSelf: 'center', width: '100%', aspectRatio: 400 / 340, backgroundColor: '#fff', borderRadius: 10, overflow: 'hidden' },
  msImg: { width: '100%', height: '100%' },
  arcViewLabel: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 12, letterSpacing: 1 },
  nums: { flexDirection: 'row', gap: 20, marginBottom: 10 },
  numStat: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  numLbl: { color: colors.muted, fontSize: 12 },
  numVal: { color: colors.text, fontSize: 18, fontWeight: '700' },
  typeWord: { color: colors.muted, fontSize: 13, marginBottom: 4 },
  meta: { color: colors.muted, fontSize: 13, marginBottom: 4 },
  use: { color: colors.text, fontSize: 14, marginBottom: 4 },
  note: { color: colors.muted, fontSize: 13, marginBottom: 4 },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  btn: { backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '700' },
  btnGhost: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.muted, fontWeight: '600' },
});
