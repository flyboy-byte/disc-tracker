// Settings screen — PORT_PLAN.md Phase 9 addition. Home for app-wide preferences, data
// backup/restore, the Marshall Street reference-image opt-in (R4), and (later) the VPS sync UI —
// hence the disabled placeholder below.
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import CsvExportModal from '../../src/components/CsvExportModal';
import CsvImportModal from '../../src/components/CsvImportModal';
import GradientButton from '../../src/components/GradientButton';
import { useToast } from '../../src/components/Toast';
import { getDiscs, getMeta, getOrCreateDefaultUser, listRounds, replaceRounds, saveDiscs, setMeta, getCustomDiscs, replaceCustomDiscs } from '../../src/db/db';
import { colors } from '../../src/theme';
import type { Disc } from '../../src/utils/disc';
import type { SkillPreset, ThrowStyle } from '../../src/utils/suggestScore';
import { buildBackup, parseBackup, backupSummary } from '../../src/utils/backup';

type ArcView = 'RHBH' | 'RHFH' | 'LHBH' | 'LHFH';
const ARC_VIEWS: ArcView[] = ['RHBH', 'RHFH', 'LHBH', 'LHFH'];
const SKILLS: { id: SkillPreset; label: string }[] = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];
const THROW_STYLES: { id: ThrowStyle; label: string }[] = [
  { id: 'backhand', label: 'Backhand' },
  { id: 'forehand', label: 'Forehand' },
];
const SOURCE_URL = 'https://github.com/flyboy-byte/disc-tracker';
const SHOTSHAPER_URL = 'https://github.com/kegiljarhus/shotshaper';

export default function SettingsScreen() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [discs, setDiscs] = useState<Disc[]>([]);
  const [arcView, setArcView] = useState<ArcView>('RHBH');
  const [skill, setSkill] = useState<SkillPreset>('intermediate');
  const [throwStyle, setThrowStyle] = useState<ThrowStyle>('backhand');
  const [msRefEnabled, setMsRefEnabled] = useState(false);
  const [fieldShowAll, setFieldShowAll] = useState(false);
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
        setSkill(meta.skill);
        setThrowStyle(meta.throwStyle);
        setMsRefEnabled(meta.msRefEnabled);
        setFieldShowAll(meta.fieldShowAll);
        setLoading(false);
      })();
    }, [])
  );

  const changeArcView = async (v: ArcView) => {
    setArcView(v);
    if (userIdRef.current != null) await setMeta(userIdRef.current, { arcView: v });
  };

  const changeSkill = async (v: SkillPreset) => {
    setSkill(v);
    if (userIdRef.current != null) await setMeta(userIdRef.current, { skill: v });
  };

  const changeThrowStyle = async (v: ThrowStyle) => {
    setThrowStyle(v);
    if (userIdRef.current != null) await setMeta(userIdRef.current, { throwStyle: v });
  };

  const changeMsRef = async (v: boolean) => {
    setMsRefEnabled(v);
    if (userIdRef.current != null) await setMeta(userIdRef.current, { msRefEnabled: v });
  };

  const changeFieldShowAll = async (v: boolean) => {
    setFieldShowAll(v);
    if (userIdRef.current != null) await setMeta(userIdRef.current, { fieldShowAll: v });
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

  // Full-device backup (B4): one JSON file with discs + settings + rounds → share sheet.
  const [busy, setBusy] = useState(false);
  const handleBackup = async () => {
    const uid = userIdRef.current;
    if (uid == null || busy) return;
    setBusy(true);
    try {
      const [allDiscs, meta, rounds, custom] = await Promise.all([getDiscs(uid), getMeta(uid), listRounds(uid), getCustomDiscs(uid)]);
      const json = buildBackup(allDiscs, { sortMode: meta.sortMode, arcView: meta.arcView, skill: meta.skill, throwStyle: meta.throwStyle, msRefEnabled: meta.msRefEnabled, fieldShowAll: meta.fieldShowAll }, rounds, custom);
      const dir = new Directory(Paths.cache, 'exports');
      if (!dir.exists) dir.create({ intermediates: true });
      const date = new Date().toISOString().slice(0, 10);
      const file = new File(dir, `disc-tracker-backup-${date}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(json);
      const summary = `${allDiscs.length} disc${allDiscs.length === 1 ? '' : 's'}${rounds.length ? ` · ${rounds.length} round${rounds.length === 1 ? '' : 's'}` : ''}`;
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Back up Disc Tracker' });
        toast(`Backup ready — ${summary}`);
      } else {
        Alert.alert('Backup saved', `Saved ${summary} to:\n${file.uri}`);
      }
    } catch (e) {
      Alert.alert('Backup failed', e instanceof Error ? e.message : 'Could not create the backup file.');
    } finally {
      setBusy(false);
    }
  };

  // Restore replaces ALL local data from a backup file (confirmed first). This is the move-to-a-new-
  // device path — it's a full replace, not a merge, so the imported state is exactly the backup.
  const handleRestore = async () => {
    const uid = userIdRef.current;
    if (uid == null || busy) return;
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const text = await new File(res.assets[0].uri).text();
      const backup = parseBackup(text);
      Alert.alert(
        'Restore from backup?',
        `This replaces everything on this device with the backup (${backupSummary(backup)}). Your current data will be overwritten.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              setBusy(true);
              try {
                await saveDiscs(uid, backup.discs.map((d, i) => ({ ...d, id: d.id ?? 100 + i })));
                await setMeta(uid, {
                  sortMode: backup.meta.sortMode,
                  arcView: backup.meta.arcView,
                  skill: backup.meta.skill as SkillPreset,
                  throwStyle: backup.meta.throwStyle as ThrowStyle,
                  msRefEnabled: backup.meta.msRefEnabled,
                  fieldShowAll: backup.meta.fieldShowAll,
                });
                await replaceRounds(uid, backup.rounds);
                await replaceCustomDiscs(uid, backup.customDiscs);
                setDiscs(await getDiscs(uid));
                toast(`Restored ${backupSummary(backup)}`);
              } catch (e) {
                Alert.alert('Restore failed', e instanceof Error ? e.message : 'Could not restore the backup.');
              } finally {
                setBusy(false);
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Restore failed', e instanceof Error ? e.message : 'Could not read that file.');
    }
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

      {/* Skill level — drives Disc Suggest ranking (B1). Caps recommended speed + nudges
          understable/overstable targets. */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>SKILL LEVEL</Text>
        <Text style={styles.sectionHint}>Tunes Disc Suggest — caps recommended speed and shifts stability to match your arm.</Text>
        <View style={styles.pillRow}>
          {SKILLS.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => changeSkill(s.id)}
              style={[styles.pill, skill === s.id && styles.pillActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: skill === s.id }}
              accessibilityLabel={`Skill level ${s.label}`}
            >
              <Text style={[styles.pillText, skill === s.id && styles.pillTextActive]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Throw style — a modifier on top of whichever Disc Suggest scenario is active, not a
          scenario of its own. Forehand nudges targets toward overstable across every scenario
          (turnovers, hyzer flips, flex shots, power hyzers), instead of relying on one generic
          "Forehand" scenario card to stand in for all of them. */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>THROW STYLE</Text>
        <Text style={styles.sectionHint}>Also tunes Disc Suggest — forehand nudges every scenario toward overstable, since forehand power overpowers turn.</Text>
        <View style={styles.pillRow}>
          {THROW_STYLES.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => changeThrowStyle(t.id)}
              style={[styles.pill, throwStyle === t.id && styles.pillActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: throwStyle === t.id }}
              accessibilityLabel={`Throw style ${t.label}`}
            >
              <Text style={[styles.pillText, throwStyle === t.id && styles.pillTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Field view scope — B2. Off by default: Field view plots today's bag (few discs, legible).
          On: it plots the whole filtered set instead, but only while it stays small enough to read. */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.msTextCol}>
            <Text style={styles.sectionLabel}>FIELD VIEW</Text>
            <Text style={styles.sectionHint}>
              Plot all filtered discs, not just today&apos;s bag — kept on only while the set is small enough to stay readable.
            </Text>
          </View>
          <Switch
            value={fieldShowAll}
            onValueChange={changeFieldShowAll}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#fff"
            accessibilityLabel="Show all discs in Field view"
          />
        </View>
        <View style={styles.divider} />
        <Text style={styles.sectionHint}>
          {fieldShowAll
            ? "On — Field view draws your whole filtered set when it's 25 discs or fewer, otherwise today's bag."
            : "Off — Field view draws only the discs in today's bag."}
        </Text>
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

      {/* Backup & restore (B4) — the full-device move path (replaces the old VPS-sync idea).
          The note below is deliberate: this is the FOSS answer to cloud sync / accounts, and the
          card has to say so or it reads like a redundant second CSV export. */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>BACKUP &amp; RESTORE</Text>
        <Text style={styles.sectionHint}>
          A full snapshot of the whole app in one file — every disc (with color, order and
          today&apos;s-bag flags), your settings, and all your scorecards. Restore it on any phone to pick
          up exactly where you left off.
        </Text>
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            This is the free-software alternative to cloud sync — no account, no server, nothing leaves your
            phone until you send the file yourself. Unlike CSV (which only carries the disc list), this
            backup moves your entire app.
          </Text>
        </View>
        <GradientButton
          style={styles.actionBtn}
          onPress={handleBackup}
          disabled={busy}
          accessibilityLabel="Back up everything to a file"
        >
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.actionBtnText}>Back up everything</Text>
          )}
        </GradientButton>
        <Pressable
          style={[styles.actionBtnGhost, busy && styles.actionBtnDisabled]}
          onPress={handleRestore}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Restore from a backup file"
        >
          <Text style={styles.actionBtnGhostText}>Restore from backup</Text>
        </Pressable>
      </View>

      {/* Data — CSV disc-list interop (spreadsheets / other apps) + delete-all. */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>DATA</Text>
        <Text style={styles.sectionHint}>{discs.length} disc{discs.length === 1 ? '' : 's'} stored on this device.</Text>
        <Pressable style={styles.row} onPress={() => setExportOpen(true)} accessibilityRole="button" accessibilityLabel="Export discs to CSV">
          <Text style={styles.rowText}>Export discs (CSV)</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={styles.row} onPress={() => setImportOpen(true)} accessibilityRole="button" accessibilityLabel="Import discs from CSV">
          <Text style={styles.rowText}>Import discs (CSV)</Text>
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
  noteBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(145,94,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(145,94,255,0.25)',
  },
  noteText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  actionBtn: {
    marginTop: 14,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  actionBtnGhost: {
    marginTop: 10,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnGhostText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  actionBtnDisabled: { opacity: 0.5 },
  aboutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  aboutBlurb: { color: colors.muted, fontSize: 13, lineHeight: 19, paddingVertical: 12 },
});
