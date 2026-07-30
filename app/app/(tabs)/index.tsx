// Bag screen — PORT_PLAN.md Phase 4. Ported from templates/index.html's render()/
// openAdd()/openEdit()/saveDisc()/deleteDisc()/setFilter()/setSort()/startDrag()+endDrag().
// CSV export/import (Phase 7) is wired in via CsvExportModal/CsvImportModal below.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';
import { FlatList } from 'react-native-gesture-handler';
import { useFocusEffect } from 'expo-router';
import ArcDetailModal from '../../src/components/ArcDetailModal';
import CsvExportModal from '../../src/components/CsvExportModal';
import CsvImportModal from '../../src/components/CsvImportModal';
import DiscCard from '../../src/components/DiscCard';
import DiscFormModal from '../../src/components/DiscFormModal';
import DiscLibraryModal from '../../src/components/DiscLibraryModal';
import FieldView from '../../src/components/FieldView';
import { useToast } from '../../src/components/Toast';
import { colors } from '../../src/theme';
import {
  getDiscs,
  getMeta,
  getOrCreateDefaultUser,
  saveDiscs,
  setMeta,
  setDiscInBag,
  clearTodaysBag,
  deleteDisc,
  insertDisc,
  updateDisc,
  reorderDiscs,
} from '../../src/db/db';
import { discType, stab, STAB_META, type Disc, type DiscType, type Stability } from '../../src/utils/disc';
import type { MasterDisc } from '../../src/utils/masterLibrary';

type StabFilter = 'all' | Stability;
type TypeFilterKey = 'all' | DiscType;
type SortMode = 'speed-desc' | 'speed-asc' | 'name' | 'mfr' | 'custom';
type ArcView = 'RHBH' | 'RHFH' | 'LHBH' | 'LHFH';

const STAB_PILLS: { key: StabFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'overstable', label: 'OS' },
  { key: 'stable', label: 'ST' },
  { key: 'understable', label: 'US' },
];
const TYPE_PILLS: { key: TypeFilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'putter', label: 'Putter' },
  { key: 'mid', label: 'Mid' },
  { key: 'fairway', label: 'Fairway' },
  { key: 'driver', label: 'Driver' },
];
const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'speed-desc', label: 'Speed ↓' },
  { key: 'speed-asc', label: 'Speed ↑' },
  { key: 'name', label: 'Name' },
  { key: 'mfr', label: 'Mfr' },
  { key: 'custom', label: 'Custom' },
];
const ARC_VIEWS: ArcView[] = ['RHBH', 'RHFH', 'LHBH', 'LHFH'];
// Stability legend for the arc/badge color language, mirroring index.html's toolbar legend.
const STAB_LEGEND: { label: string; color: string }[] = [
  { label: 'Overstable', color: STAB_META.overstable.color },
  { label: 'Stable', color: STAB_META.stable.color },
  { label: 'Understable', color: STAB_META.understable.color },
];

function blankDisc(): Disc {
  return { mfr: '', mold: '', plastic: '', weight: '', speed: 7, glide: 4, turn: 0, fade: 2, use: '', thr: 'RHBH', notes: '', color: '' };
}

export default function BagScreen() {
  const toast = useToast();
  const [userId, setUserId] = useState<number | null>(null);
  const [discs, setDiscs] = useState<Disc[]>([]);
  const [loading, setLoading] = useState(true);
  const [stabFilter, setStabFilter] = useState<StabFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilterKey>('all');
  const [sortMode, setSortMode] = useState<SortMode>('speed-desc');
  // Arc-view for the per-card flight thumbnails, mirroring the persisted default throw view
  // (set on Settings / Flight Shaper). Loaded on mount and re-read on focus since Settings
  // can change it while this screen stays mounted.
  const [arcView, setArcView] = useState<ArcView>('RHBH');
  // Marshall Street reference-image opt-in (Settings). Off by default; re-read on focus like
  // arcView since Settings can toggle it while this screen stays mounted.
  const [msRefEnabled, setMsRefEnabled] = useState(false);
  const [search, setSearch] = useState('');
  // Today's-bag filter — component state (not persisted): mirrors the website's
  // sessionStorage `bagFilter`, which likewise resets when the session ends.
  const [bagFilter, setBagFilter] = useState(false);
  // 'list' = card list; 'field' = all arcs overlaid on one field (website's viewMode).
  const [viewMode, setViewMode] = useState<'list' | 'field'>('list');
  // B2: Field view scopes to today's-bag by default; the Settings toggle lets it draw the whole
  // (filtered) set instead, but only while small enough to stay legible. Persisted in user_meta.
  const [fieldShowAll, setFieldShowAll] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formIsNew, setFormIsNew] = useState(true);
  const [formInitial, setFormInitial] = useState<Disc>(blankDisc());
  // Bumped on every openAdd/openEdit/library-pick so DiscFormModal's `key` always
  // changes and remounts with fresh state — formIsNew alone isn't enough to key on,
  // since a blank add and a library-prefilled add are both formIsNew=true.
  const [formSession, setFormSession] = useState(0);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [detailDisc, setDetailDisc] = useState<Disc | null>(null);
  // Guards the focus refetch so it only runs after the initial mount load below (which the
  // Settings tab's import/reset can invalidate — same useFocusEffect pattern the plan flags).
  const didInitialLoad = useRef(false);

  useEffect(() => {
    (async () => {
      const uid = await getOrCreateDefaultUser();
      const [loadedDiscs, meta] = await Promise.all([getDiscs(uid), getMeta(uid)]);
      setUserId(uid);
      setDiscs(loadedDiscs);
      setSortMode((meta.sortMode as SortMode) || 'speed-desc');
      setArcView((meta.arcView as ArcView) || 'RHBH');
      setMsRefEnabled(meta.msRefEnabled);
      setFieldShowAll(meta.fieldShowAll);
      didInitialLoad.current = true;
      setLoading(false);
    })();
  }, []);

  // Refetch the bag whenever the tab regains focus — the Settings tab can import discs or
  // delete them all, and this screen stays mounted, so a mount-only load would go stale.
  useFocusEffect(
    useCallback(() => {
      if (!didInitialLoad.current || userId == null) return;
      (async () => {
        const [d, meta] = await Promise.all([getDiscs(userId), getMeta(userId)]);
        setDiscs(d);
        setArcView((meta.arcView as ArcView) || 'RHBH');
        setMsRefEnabled(meta.msRefEnabled);
        setFieldShowAll(meta.fieldShowAll);
      })();
    }, [userId])
  );

  const persist = useCallback(
    async (next: Disc[]) => {
      if (userId == null) return;
      await saveDiscs(userId, next);
    },
    [userId]
  );

  const persistSortMode = useCallback(
    async (mode: SortMode) => {
      setSortMode(mode);
      if (userId != null) await setMeta(userId, { sortMode: mode });
    },
    [userId]
  );

  // Arc view is a single shared preference (also set on Settings / Flight Shaper) — persist to
  // meta so the change follows the disc everywhere, matching the website's global arcView.
  const changeArcView = useCallback(
    async (v: ArcView) => {
      setArcView(v);
      if (userId != null) await setMeta(userId, { arcView: v });
    },
    [userId]
  );

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = discs.filter((d) => {
      const matchS = stabFilter === 'all' || stab(d) === stabFilter;
      const matchT = typeFilter === 'all' || discType(d) === typeFilter;
      const matchQ = !q || (d.mfr + d.mold + (d.plastic ?? '') + (d.use ?? '') + (d.notes ?? '')).toLowerCase().includes(q);
      const matchB = !bagFilter || d.inBag;
      return matchS && matchT && matchQ && matchB;
    });
    if (sortMode === 'speed-desc') rows = [...rows].sort((a, b) => b.speed - a.speed);
    else if (sortMode === 'speed-asc') rows = [...rows].sort((a, b) => a.speed - b.speed);
    else if (sortMode === 'name') rows = [...rows].sort((a, b) => a.mold.localeCompare(b.mold));
    else if (sortMode === 'mfr') rows = [...rows].sort((a, b) => (a.mfr + a.mold).localeCompare(b.mfr + b.mold));
    // 'custom' — leave in array order
    return rows;
  }, [discs, stabFilter, typeFilter, search, sortMode, bagFilter]);

  // B2: which discs the field overlay draws. Default = today's-bag only (the full library is
  // ~1200 SVG nodes in one <Svg> and visually unreadable — b2-spike.md). With the Settings opt-in
  // on, draw the whole filtered set, but only while it's small enough to stay legible.
  const FIELD_SMALL_MAX = 25;
  const fieldDiscs = useMemo(() => {
    if (fieldShowAll && filteredSorted.length <= FIELD_SMALL_MAX) return filteredSorted;
    return filteredSorted.filter((d) => d.inBag);
  }, [fieldShowAll, filteredSorted]);

  // Drag-reorder only makes sense on the full, unfiltered custom-sorted list — a filtered
  // view has gaps, so dropping a card at index N wouldn't map to the real array position.
  const dragEnabled =
    viewMode === 'list' && sortMode === 'custom' && stabFilter === 'all' && typeFilter === 'all' && !search.trim() && !bagFilter;

  const filtersActive = stabFilter !== 'all' || typeFilter !== 'all' || !!search.trim() || bagFilter;
  const clearFilters = () => {
    setStabFilter('all');
    setTypeFilter('all');
    setSearch('');
    setBagFilter(false);
  };

  const openAdd = () => {
    setFormIsNew(true);
    setFormInitial(blankDisc());
    setFormSession((n) => n + 1);
    setFormOpen(true);
  };

  const openEdit = (d: Disc) => {
    setFormIsNew(false);
    setFormInitial(d);
    setFormSession((n) => n + 1);
    setFormOpen(true);
  };

  const handleSave = async (saved: Disc) => {
    if (userId == null) return;
    if (formIsNew) {
      const nextId = (discs.reduce((max, d) => Math.max(max, d.id ?? 0), 0) || 100) + 1;
      const added = { ...saved, id: saved.id ?? nextId };
      setDiscs([...discs, added]);
      setFormOpen(false);
      toast(`${saved.mold} added`);
      await insertDisc(userId, added); // single INSERT, not a full-table rewrite
    } else {
      // Preserve inBag — the edit form doesn't own it, and updateDisc leaves the column untouched.
      const updated = { ...saved, inBag: discs.find((d) => d.id === saved.id)?.inBag ?? saved.inBag };
      setDiscs(discs.map((d) => (d.id === saved.id ? updated : d)));
      setFormOpen(false);
      toast(`${saved.mold} updated`);
      await updateDisc(userId, updated); // single UPDATE of editable fields
    }
  };

  const handleDelete = async (id: number) => {
    if (userId == null) return;
    const removed = discs.find((d) => d.id === id);
    setDiscs(discs.filter((d) => d.id !== id));
    setFormOpen(false);
    toast(`${removed?.mold ?? 'Disc'} removed`);
    await deleteDisc(userId, id); // single DELETE
  };

  const handlePickFromLibrary = (m: MasterDisc) => {
    setLibraryOpen(false);
    setFormIsNew(true);
    setFormInitial({
      mfr: m.mfr,
      mold: m.name,
      plastic: '',
      weight: '',
      speed: m.speed,
      glide: m.glide,
      turn: m.turn,
      fade: m.fade,
      use: '',
      thr: 'RHBH',
      notes: '',
      color: '',
    });
    setFormSession((n) => n + 1);
    setFormOpen(true);
  };

  const handleDragEnd = async ({ data }: { data: Disc[] }) => {
    if (userId == null) return;
    setDiscs(data);
    toast('Order saved');
    await reorderDiscs(userId, data.map((d) => d.id ?? 0)); // rewrites sort_order only
  };

  // Today's bag: flip a single disc's inBag flag and persist. Matches the website's
  // toggleBagged() — inBag is per-disc, stored the same way as everything else.
  const toggleBag = async (id: number) => {
    if (userId == null) return;
    const target = discs.find((d) => d.id === id);
    const nextInBag = !target?.inBag;
    setDiscs(discs.map((d) => (d.id === id ? { ...d, inBag: nextInBag } : d)));
    await setDiscInBag(userId, id, nextInBag); // single UPDATE
  };

  const clearBag = () => {
    Alert.alert("Clear today's bag?", 'This unmarks every disc as in-bag. Your discs are not deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear bag',
        style: 'destructive',
        onPress: async () => {
          if (userId == null) return;
          setDiscs(discs.map((d) => (d.inBag ? { ...d, inBag: false } : d)));
          setBagFilter(false);
          toast("Today's bag cleared");
          await clearTodaysBag(userId); // single UPDATE ... WHERE in_bag = 1
        },
      },
    ]);
  };

  // Same id-assignment scheme as handleSave's new-disc path — append-only, matches the
  // website's doImport() (assigns new ids, pushes onto the existing bag, never clears it).
  const handleImportDiscs = async (imported: Disc[]) => {
    let nextId = (discs.reduce((max, d) => Math.max(max, d.id ?? 0), 0) || 100) + 1;
    const withIds = imported.map((d) => ({ ...d, id: nextId++ }));
    const next = [...discs, ...withIds];
    setDiscs(next);
    setImportOpen(false);
    toast(`${withIds.length} disc${withIds.length === 1 ? '' : 's'} imported`);
    await persist(next);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const typeCounts: Record<TypeFilterKey, number> = { all: discs.length, putter: 0, mid: 0, fairway: 0, driver: 0 };
  discs.forEach((d) => typeCounts[discType(d)]++);
  const stabCounts: Record<StabFilter, number> = { all: discs.length, overstable: 0, stable: 0, understable: 0 };
  discs.forEach((d) => stabCounts[stab(d)]++);
  const bagCount = discs.filter((d) => d.inBag).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bag</Text>
        <Text style={styles.substat}>
          {discs.length} discs · {typeCounts.driver}D · {typeCounts.fairway}FD · {typeCounts.mid}M · {typeCounts.putter}P
          {bagCount > 0 ? ` · ${bagCount} in bag` : ''}
        </Text>
      </View>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search…"
        placeholderTextColor={colors.muted}
      />

      <PillRow items={STAB_PILLS} active={stabFilter} counts={stabCounts} onPress={setStabFilter} />
      <PillRow items={TYPE_PILLS} active={typeFilter} counts={typeCounts} onPress={setTypeFilter} />
      <PillRow items={SORT_OPTIONS} active={sortMode} onPress={(m) => persistSortMode(m as SortMode)} />

      <View style={styles.actionsRow}>
        <Pressable style={styles.addBtn} onPress={openAdd} accessibilityRole="button" accessibilityLabel="Add a disc">
          <Text style={styles.addBtnText}>+ Add disc</Text>
        </Pressable>
        <Pressable style={styles.ghostBtn} onPress={() => setImportOpen(true)} accessibilityRole="button" accessibilityLabel="Import discs from CSV">
          <Text style={styles.ghostBtnText}>Import</Text>
        </Pressable>
        <Pressable style={styles.ghostBtn} onPress={() => setExportOpen(true)} accessibilityRole="button" accessibilityLabel="Export discs to CSV">
          <Text style={styles.ghostBtnText}>Export</Text>
        </Pressable>
        <Pressable
          style={[styles.ghostBtn, bagFilter && styles.ghostBtnActive]}
          onPress={() => setBagFilter((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ selected: bagFilter }}
          accessibilityLabel={bagFilter ? 'Show all discs' : "Show only today's bag"}
        >
          <Text style={[styles.ghostBtnText, bagFilter && styles.ghostBtnTextActive]}>
            {bagCount > 0 ? `In bag (${bagCount})` : 'In bag'}
          </Text>
        </Pressable>
        {bagCount > 0 && (
          <Pressable style={styles.ghostBtn} onPress={clearBag} accessibilityRole="button" accessibilityLabel="Clear today's bag">
            <Text style={styles.ghostBtnText}>Clear bag</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.ghostBtn, viewMode === 'field' && styles.ghostBtnActive]}
          onPress={() => setViewMode((m) => (m === 'field' ? 'list' : 'field'))}
          accessibilityRole="button"
          accessibilityState={{ selected: viewMode === 'field' }}
          accessibilityLabel={viewMode === 'field' ? 'Switch to card list' : 'Switch to field view'}
        >
          <Text style={[styles.ghostBtnText, viewMode === 'field' && styles.ghostBtnTextActive]}>
            {viewMode === 'field' ? 'Bag view' : 'Field view'}
          </Text>
        </Pressable>
      </View>
      {sortMode === 'custom' && (
        <Text style={styles.dragHint}>{dragEnabled ? 'long-press a card to reorder' : 'clear search/filters to drag-reorder'}</Text>
      )}

      <View style={styles.arcBar}>
        <View style={styles.legend}>
          {STAB_LEGEND.map((l) => (
            <View key={l.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: l.color }]} />
              <Text style={styles.legendText}>{l.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.arcViewPills}>
          {ARC_VIEWS.map((v) => (
            <Pressable
              key={v}
              onPress={() => changeArcView(v)}
              style={[styles.arcViewPill, arcView === v && styles.arcViewPillActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: arcView === v }}
              accessibilityLabel={`Show arcs as ${v}`}
            >
              <Text style={[styles.arcViewPillText, arcView === v && styles.arcViewPillTextActive]}>{v}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {filteredSorted.length === 0 ? (
        <View style={styles.emptyWrap}>
          {discs.length === 0 ? (
            // Truly empty bag — doubles as a first-run welcome (the app deliberately has no
            // separate welcome modal; see punch-list P2-4).
            <>
              <Text style={styles.emptyTitle}>Your bag is empty</Text>
              <Text style={styles.emptyBody}>
                Add a disc or import a CSV backup to get started. Everything stays on this device — no
                account, no cloud.
              </Text>
              <View style={styles.emptyActions}>
                <Pressable style={styles.addBtn} onPress={openAdd} accessibilityRole="button" accessibilityLabel="Add a disc">
                  <Text style={styles.addBtnText}>+ Add disc</Text>
                </Pressable>
                <Pressable style={styles.ghostBtn} onPress={() => setImportOpen(true)} accessibilityRole="button" accessibilityLabel="Import discs from CSV">
                  <Text style={styles.ghostBtnText}>Import CSV</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.emptyTitle}>No discs match</Text>
              <Text style={styles.emptyBody}>Nothing fits your current filters or search.</Text>
              {filtersActive && (
                <Pressable style={styles.ghostBtn} onPress={clearFilters} accessibilityRole="button" accessibilityLabel="Clear filters and search">
                  <Text style={styles.ghostBtnText}>Clear filters</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      ) : viewMode === 'field' ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          {fieldDiscs.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>Nothing to plot</Text>
              <Text style={styles.emptyBody}>
                {fieldShowAll
                  ? `Field view draws today's bag, or your whole filtered set when it's ${FIELD_SMALL_MAX} discs or fewer. Mark some discs as "in bag", or narrow your filters.`
                  : 'Field view shows the discs in today’s bag. Mark some discs as “in bag” to see them here.'}
              </Text>
            </View>
          ) : (
            <>
              <FieldView discs={fieldDiscs} arcView={arcView} onSelectDisc={setDetailDisc} />
              <Text style={styles.fieldScopeNote}>
                {fieldShowAll && filteredSorted.length <= FIELD_SMALL_MAX
                  ? `Showing all ${fieldDiscs.length} filtered ${fieldDiscs.length === 1 ? 'disc' : 'discs'}`
                  : `Showing today's bag (${fieldDiscs.length})`}
              </Text>
            </>
          )}
        </ScrollView>
      ) : dragEnabled ? (
        <DraggableFlatList
          data={filteredSorted}
          keyExtractor={(d: Disc) => String(d.id)}
          onDragEnd={handleDragEnd}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, drag, isActive }: RenderItemParams<Disc>) => (
            <DiscCard
              disc={item}
              arcView={arcView}
              onPress={() => openEdit(item)}
              onPressArc={() => setDetailDisc(item)}
              onLongPress={drag}
              dragActive={isActive}
              onToggleBag={item.id != null ? () => toggleBag(item.id!) : undefined}
            />
          )}
        />
      ) : (
        <FlatList
          data={filteredSorted}
          keyExtractor={(d) => String(d.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <DiscCard
              disc={item}
              arcView={arcView}
              onPress={() => openEdit(item)}
              onPressArc={() => setDetailDisc(item)}
              onToggleBag={item.id != null ? () => toggleBag(item.id!) : undefined}
            />
          )}
        />
      )}

      <DiscFormModal
        key={formSession}
        visible={formOpen}
        isNew={formIsNew}
        initial={formInitial}
        onCancel={() => setFormOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
        onOpenLibrary={() => {
          setFormOpen(false);
          setLibraryOpen(true);
        }}
      />
      <ArcDetailModal
        disc={detailDisc}
        arcView={arcView}
        msRefEnabled={msRefEnabled}
        onClose={() => setDetailDisc(null)}
        onEdit={() => {
          const d = detailDisc;
          setDetailDisc(null);
          if (d) openEdit(d);
        }}
      />
      <DiscLibraryModal visible={libraryOpen} onCancel={() => setLibraryOpen(false)} onPick={handlePickFromLibrary} />
      <CsvExportModal visible={exportOpen} discs={discs} onCancel={() => setExportOpen(false)} />
      <CsvImportModal visible={importOpen} existingDiscs={discs} onCancel={() => setImportOpen(false)} onImport={handleImportDiscs} />
    </View>
  );
}

function PillRow<T extends string>({
  items,
  active,
  counts,
  onPress,
}: {
  items: { key: T; label: string }[];
  active: T;
  counts?: Record<T, number>;
  onPress: (key: T) => void;
}) {
  return (
    <View style={styles.pillRow}>
      {items.map((it) => (
        <Pressable
          key={it.key}
          onPress={() => onPress(it.key)}
          style={[styles.pill, active === it.key && styles.pillActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: active === it.key }}
          accessibilityLabel={it.label}
        >
          <Text style={[styles.pillText, active === it.key && styles.pillTextActive]}>
            {it.label}
            {counts && it.key !== 'all' ? ` ${counts[it.key]}` : ''}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 56, paddingHorizontal: 14 },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  header: { marginBottom: 10 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  substat: { color: colors.muted, fontSize: 12, marginTop: 2 },
  search: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    marginBottom: 8,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  pillActive: { borderColor: colors.accent, backgroundColor: 'rgba(145,94,255,0.12)' },
  pillText: { color: colors.muted, fontSize: 12 },
  pillTextActive: { color: colors.accent, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  addBtn: { backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: '700' },
  ghostBtn: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  ghostBtnActive: { borderColor: colors.accent, backgroundColor: 'rgba(145,94,255,0.12)' },
  ghostBtnText: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  ghostBtnTextActive: { color: colors.accent },
  dragHint: { color: colors.muted, fontSize: 12, flexShrink: 1, marginBottom: 6 },
  arcBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { color: colors.muted, fontSize: 11 },
  arcViewPills: { flexDirection: 'row', gap: 4 },
  arcViewPill: { borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  arcViewPillActive: { borderColor: colors.accent, backgroundColor: 'rgba(145,94,255,0.12)' },
  arcViewPillText: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  arcViewPillTextActive: { color: colors.accent },
  emptyWrap: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 56, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  emptyBody: { color: colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  fieldScopeNote: { color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 10 },
  listContent: { paddingBottom: 24 },
});
