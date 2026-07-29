// Settings screen — PORT_PLAN.md Phase 9 addition. Home for app-wide preferences, data
// backup/restore, the Marshall Street reference-image opt-in (R4), and (later) the VPS sync UI —
// hence the disabled placeholder below.
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import CsvExportModal from '../../src/components/CsvExportModal';
import CsvImportModal from '../../src/components/CsvImportModal';
import { useToast } from '../../src/components/Toast';
import { getDiscs, getMeta, getOrCreateDefaultUser, saveDiscs, setMeta } from '../../src/db/db';
import { colors } from '../../src/theme';
import type { Disc } from '../../src/utils/disc';

type ArcView = 'RHBH' | 'RHFH' | 'LHBH' | 'LHFH';
const ARC_VIEWS: ArcView[] = ['RHBH', 'RHFH', 'LHBH', 'LHFH'];
const SOURCE_URL = 'https://github.com/flyboy-byte/disc-tracker';
const SHOTSHAPER_URL = 'https://github.com/kegiljarhus/shotshaper';

export default function SettingsScreen() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [discs, setDiscs] = useState<Disc[]>([]);
  const [arcView, setArcView] = useState<ArcView>('RHBH');
  const [msRefEnabled, setMsRefEnabled] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const userIdRef = useRef<number | null>(null);

  // Refetch on every focus — the bag/meta can change on other tabs, and this screen both
  // reads them (export/reset counts, default arc view) and writes them.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (userIdRef.current == null) userIdRef.current = await getOrCreateDefaultUser();
        const [d, meta] = await Promise.all([getDiscs(userIdRef.current), getMeta(userIdRef.current)]);
        setDiscs(d);
        setArcView((meta.arcView as ArcView) || 'RHBH');
        setMsRefEnabled(meta.msRefEnabled);
        setLoading(false);
      })();
    }, [])
  );

  const changeArcView = async (v: ArcView) => {
    setArcView(v);
    if (userIdRef.current != null) await setMeta(userIdRef.current, { arcView: v });
  };

  const changeMsRef = async (v: boolean) => {
    setMsRefEnabled(v);
    if (userIdRef.current != null) await setMeta(userIdRef.current, { msRefEnabled: v });
  };

  const handleImport = async (imported: Disc[]) => {
    const uid = userIdRef.current;
    if (uid == null) return;
    let nextId = (discs.reduce((max, d) => Math.max(max, d.id ?? 0), 0) || 100) + 1;
    const next = [...discs, ...imported.map((d) => ({ ...d, id: nextId++ }))];
    setDiscs(next);
    setImportOpen(false);
    toast(`${imported.length} disc${imported.length === 1 ? '' : 's'} imported`);
    await saveDiscs(uid, next);
  };

  const confirmDeleteAll = () => {
    if (!discs.length) return;
    Alert.alert(
      'Delete all discs?',
      `This permanently removes all ${discs.length} disc${discs.length === 1 ? '' : 's'}. Export a backup first if you want to keep them. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: async () => {
            const uid = userIdRef.current;
            if (uid == null) return;
            const n = discs.length;
            setDiscs([]);
            toast(`All ${n} disc${n === 1 ? '' : 's'} deleted`);
            await saveDiscs(uid, []);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const version = Constants.expoConfig?.version ?? '0.1.0';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      {/* Default throw view */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>DEFAULT THROW VIEW</Text>
        <Text style={styles.sectionHint}>The hand/throw the Flight Shaper starts on.</Text>
        <View style={styles.pillRow}>
          {ARC_VIEWS.map((v) => (
            <Pressable
              key={v}
              onPress={() => changeArcView(v)}
              style={[styles.pill, arcView === v && styles.pillActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: arcView === v }}
              accessibilityLabel={`Default throw view ${v}`}
            >
              <Text style={[styles.pillText, arcView === v && styles.pillTextActive]}>{v}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Marshall Street reference images — R4. Opt-in, off by default: the only feature that
          touches the network, and only when this is on and you open a disc in RHBH view. */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.msTextCol}>
            <Text style={styles.sectionLabel}>REFERENCE IMAGES</Text>
            <Text style={styles.sectionHint}>
              Show Marshall Street&apos;s real measured flight-path image on a disc&apos;s detail view (RHBH only).
            </Text>
          </View>
          <Switch
            value={msRefEnabled}
            onValueChange={changeMsRef}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#fff"
            accessibilityLabel="Marshall Street reference images"
          />
        </View>
        <View style={styles.divider} />
        <Text style={styles.sectionHint}>
          {msRefEnabled
            ? 'When you open a disc, the app fetches its image once from discit-api.fly.dev, then caches it. No other network use; turn off to stay fully offline.'
            : 'Off — the app makes no network connections. Turn on to fetch images from discit-api.fly.dev on demand.'}
        </Text>
      </View>

      {/* Data */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>DATA</Text>
        <Text style={styles.sectionHint}>{discs.length} disc{discs.length === 1 ? '' : 's'} stored on this device.</Text>
        <Pressable style={styles.row} onPress={() => setExportOpen(true)} accessibilityRole="button" accessibilityLabel="Back up discs to CSV">
          <Text style={styles.rowText}>Back up (export CSV)</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={styles.row} onPress={() => setImportOpen(true)} accessibilityRole="button" accessibilityLabel="Import discs from CSV">
          <Text style={styles.rowText}>Import CSV</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable
          style={styles.row}
          onPress={confirmDeleteAll}
          disabled={discs.length === 0}
          accessibilityRole="button"
          accessibilityLabel="Delete all discs"
        >
          <Text style={[styles.rowText, styles.danger, discs.length === 0 && styles.rowDisabled]}>Delete all discs</Text>
        </Pressable>
      </View>

      {/* Sync — v1.1 placeholder */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>SYNC</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowText, styles.rowDisabled]}>Sync with your server</Text>
            <Text style={styles.sectionHint}>Coming in a later version — push/pull your bag to your own VPS.</Text>
          </View>
          <Text style={styles.soonBadge}>Soon</Text>
        </View>
      </View>

      {/* About */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.aboutRow}>
          <Text style={styles.rowText}>Version</Text>
          <Text style={styles.rowValue}>{version}</Text>
        </View>
        <View style={styles.divider} />
        <Text style={styles.aboutBlurb}>
          Local-only. Your discs live on this device — no accounts, no cloud, no tracking, no ads.
        </Text>
        <View style={styles.divider} />
        <View style={styles.aboutRow}>
          <Text style={styles.rowText}>License</Text>
          <Text style={styles.rowValue}>GPLv3</Text>
        </View>
        <View style={styles.divider} />
        <Pressable style={styles.row} onPress={() => Linking.openURL(SOURCE_URL)} accessibilityRole="link" accessibilityLabel="Open source code on GitHub">
          <Text style={[styles.rowText, styles.link]}>Source code</Text>
          <Text style={[styles.rowChevron, styles.link]}>↗</Text>
        </Pressable>
      </View>

      {/* Credits */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>CREDITS</Text>
        <Text style={styles.aboutBlurb}>
          The Physics sim in Flight Shaper is a port of shotshaper, a rigid-body disc-flight
          simulator by Knut Erik Teigen Giljarhus, used under the GPLv3.
        </Text>
        <View style={styles.divider} />
        <Pressable style={styles.row} onPress={() => Linking.openURL(SHOTSHAPER_URL)} accessibilityRole="link" accessibilityLabel="Open shotshaper on GitHub">
          <Text style={[styles.rowText, styles.link]}>shotshaper</Text>
          <Text style={[styles.rowChevron, styles.link]}>↗</Text>
        </Pressable>
      </View>

      <CsvExportModal visible={exportOpen} discs={discs} onCancel={() => setExportOpen(false)} />
      <CsvImportModal visible={importOpen} existingDiscs={discs} onCancel={() => setImportOpen(false)} onImport={handleImport} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 14, paddingTop: 56, paddingBottom: 40, gap: 12 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: 2 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: colors.muted, textTransform: 'uppercase' },
  sectionHint: { color: colors.muted, fontSize: 12, marginTop: 4 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  pillActive: { borderColor: colors.accent, backgroundColor: 'rgba(145,94,255,0.12)' },
  pillText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: colors.accent },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  msTextCol: { flex: 1, paddingRight: 12 },
  rowText: { color: colors.text, fontSize: 15 },
  rowValue: { color: colors.muted, fontSize: 15 },
  rowChevron: { color: colors.muted, fontSize: 20 },
  rowDisabled: { color: colors.muted, opacity: 0.6 },
  danger: { color: colors.danger },
  link: { color: colors.accent },
  divider: { height: 1, backgroundColor: colors.border },
  soonBadge: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  aboutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  aboutBlurb: { color: colors.muted, fontSize: 13, lineHeight: 19, paddingVertical: 12 },
});
