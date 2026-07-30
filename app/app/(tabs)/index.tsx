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
  // B2 Bag/Collection IA split. 'today' = the discs you've marked in-bag (the primary view —
  // small, fast, Field-view-able: "what am I throwing today"); 'collection' = the full archive
  // (all discs, browse/manage/add). Component state, default 'today' each launch — a fresh
  // session should open on today's bag, not wherever you last left the archive.
  const [bagScope, setBagScope] = useState<'today' | 'collection'>('today');
  // B2 pagination: current page index for large collections (see PAGE_SIZE below).
  const [page, setPage] = useState(0);
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
      const matchScope = bagScope === 'collection' || d.inBag;
      return matchS && matchT && matchQ && matchScope;
    });
    if (sortMode === 'speed-desc') rows = [...rows].sort((a, b) => b.speed - a.speed);
    else if (sortMode === 'speed-asc') rows = [...rows].sort((a, b) => a.speed - b.speed);
    else if (sortMode === 'name') rows = [...rows].sort((a, b) => a.mold.localeCompare(b.mold));
    else if (sortMode === 'mfr') rows = [...rows].sort((a, b) => (a.mfr + a.mold).localeCompare(b.mfr + b.mold));
    // 'custom' — leave in array order
    return rows;
  }, [discs, stabFilter, typeFilter, search, sortMode, bagScope]);

  // B2: which discs the field overlay draws. Default = today's-bag only (the full library is
  // ~1200 SVG nodes in one <Svg> and visually unreadable — b2-spike.md). With the Settings opt-in
  // on, draw the whole filtered set, but only while it's small enough to stay legible.
  const FIELD_SMALL_MAX = 25;
  const fieldDiscs = useMemo(() => {
    if (fieldShowAll && filteredSorted.length <= FIELD_SMALL_MAX) return filteredSorted;
    return filteredSorted.filter((d) => d.inBag);
  }, [fieldShowAll, filteredSorted]);

  // B2 pagination: keep the whole-list drag experience for normal-sized collections (a bag fits
  // on one page → drag freely, like the website), but page big collections so only PAGE_SIZE cards
  // ever mount — the size-independent fix for the mount-bound scroll cliff (b2-spike.md). Cross-page
  // reordering is done with the per-card "Move to top" button instead of drag (drag can't cross pages).
  const PAGE_SIZE = 30;
  const paginated = filteredSorted.length > PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageItems = useMemo(
    () => (paginated ? filteredSorted.slice(clampedPage * PAGE_SIZE, (clampedPage + 1) * PAGE_SIZE) : filteredSorted),
    [paginated, filteredSorted, clampedPage]
  );

  // Any change to what's shown resets to the first page (a stale page index would show nothing).
  useEffect(() => {
    setPage(0);
  }, [stabFilter, typeFilter, search, sortMode, bagScope]);

  // Drag-reorder only makes sense on the full, unfiltered, custom-sorted collection shown as ONE
  // page — a filtered/scoped/paged view has gaps, so dropping at index N wouldn't map to the real
  // array position. (Today's bag is itself a subset, so it never drags.)
  const dragEnabled =
    bagScope === 'collection' &&
    !paginated &&
    viewMode === 'list' &&
    sortMode === 'custom' &&
    stabFilter === 'all' &&
    typeFilter === 'all' &&
    !search.trim();

  // Cross-page reordering for big collections: pull a disc to the front of the custom order.
  // Only meaningful in custom sort (any other sort recomputes order and ignores sort_order).
  const showMoveToTop =
    paginated && bagScope === 'collection' && sortMode === 'custom' && stabFilter === 'all' && typeFilter === 'all' && !search.trim();
  const moveToTop = useCallback(
    async (id: number) => {
      if (userId == null) return;
      const target = discs.find((d) => d.id === id);
      if (!target) return;
      const reordered = [target, ...discs.filter((d) => d.id !== id)];
      setDiscs(reordered);
      setPage(0); // jump to the top so the move is visible
      await reorderDiscs(userId, reordered.map((d) => d.id ?? 0));
    },
    // Depends on discs (not "stable"), but move-to-top only shows in a paginated collection and a
    // reorder re-renders the list anyway — scroll (no discs change) still gets stable handlers.
    [userId, discs]
  );

  const filtersActive = stabFilter !== 'all' || typeFilter !== 'all' || !!search.trim();
  const clearFilters = () => {
    setStabFilter('all');
    setTypeFilter('all');
    setSearch('');
  };

  // Switching scope: leaving Collection for Today's Bag drops out of any field/list interplay
  // cleanly; entering Collection exits field view (a 200-arc field is the whole cliff we scoped
  // away). Field view stays a Today's-Bag affordance.
  const changeScope = (scope: 'today' | 'collection') => {
    setBagScope(scope);
    if (scope === 'collection') setViewMode('list');
  };

  const openAdd = () => {
    setFormIsNew(true);
    setFormInitial(blankDisc());
    setFormSession((n) => n + 1);
    setFormOpen(true);
  };

  // Stable (only stable setters inside) so DiscCard's React.memo can skip unchanged cards.
  const openEdit = useCallback((d: Disc) => {
    setFormIsNew(false);
    setFormInitial(d);
    setFormSession((n) => n + 1);
    setFormOpen(true);
  }, []);

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
  // toggleBagged(). The card supplies nextInBag, so this reads no state → stable (useCallback)
  // + stale-safe (functional setDiscs), which lets DiscCard's React.memo hold during scroll.
  const toggleBag = useCallback(
    async (id: number, nextInBag: boolean) => {
      if (userId == null) return;
      setDiscs((prev) => prev.map((d) => (d.id === id ? { ...d, inBag: nextInBag } : d)));
      await setDiscInBag(userId, id, nextInBag); // single UPDATE
    },
    [userId]
  );

  // Stable renderItem for the (non-drag) list — all handlers stable, so memoized DiscCards only
  // re-render when their own disc, the arcView, or a handler identity actually changes.
  const renderCard = useCallback(
    ({ item }: { item: Disc }) => (
      <DiscCard
        disc={item}
        arcView={arcView}
        onPress={openEdit}
        onPressArc={setDetailDisc}
        onToggleBag={toggleBag}
        onMoveToTop={showMoveToTop ? moveToTop : undefined}
      />
    ),
    [arcView, openEdit, toggleBag, showMoveToTop, moveToTop]
  );

  const clearBag = () => {
    Alert.alert("Clear today's bag?", 'This unmarks every disc as in-bag. Your discs are not deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear bag',
        style: 'destructive',
        onPress: async () => {
          if (userId == null) return;
          setDiscs(discs.map((d) => (d.inBag ? { ...d, inBag: false } : d)));
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

      {/* B2 IA split: Today's Bag (in-bag subset — the primary view) vs. Collection (full archive). */}
      <View style={styles.segment}>
        {(['today', 'collection'] as const).map((scope) => (
          <Pressable
            key={scope}
            style={[styles.segmentBtn, bagScope === scope && styles.segmentBtnActive]}
            onPress={() => changeScope(scope)}
            accessibilityRole="button"
            accessibilityState={{ selected: bagScope === scope }}
          >
            <Text style={[styles.segmentText, bagScope === scope && styles.segmentTextActive]}>
              {scope === 'today' ? `Today's Bag${bagCount > 0 ? ` (${bagCount})` : ''}` : `Collection (${discs.length})`}
            </Text>
          </Pressable>
        ))}
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
        {/* Field view + Clear bag are today's-bag affordances (Field view is scoped there; a
            200-arc field is the cliff we deliberately avoid). Collection stays a browse/manage view. */}
        {bagScope === 'today' && bagCount > 0 && (
          <Pressable style={styles.ghostBtn} onPress={clearBag} accessibilityRole="button" accessibilityLabel="Clear today's bag">
            <Text style={styles.ghostBtnText}>Clear bag</Text>
          </Pressable>
        )}
        {bagScope === 'today' && (
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
        )}
      </View>
      {bagScope === 'collection' && sortMode === 'custom' && (
        <Text style={styles.dragHint}>
          {dragEnabled
            ? 'long-press a card to reorder'
            : paginated
              ? 'tap ⤒ Top to move a disc to the front'
              : 'clear search/filters to drag-reorder'}
        </Text>
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
          ) : bagScope === 'today' && !filtersActive ? (
            // Collection has discs but none are marked in-bag yet.
            <>
              <Text style={styles.emptyTitle}>Today&apos;s bag is empty</Text>
              <Text style={styles.emptyBody}>
                Open the Collection and tap the bag icon on a disc to add it to today&apos;s bag.
              </Text>
              <Pressable
                style={styles.addBtn}
                onPress={() => changeScope('collection')}
                accessibilityRole="button"
                accessibilityLabel="Open the collection"
              >
                <Text style={styles.addBtnText}>Open Collection</Text>
              </Pressable>
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
              onPress={openEdit}
              onPressArc={setDetailDisc}
              onLongPress={drag}
              dragActive={isActive}
              onToggleBag={toggleBag}
            />
          )}
        />
      ) : (
        <FlatList
          data={pageItems}
          keyExtractor={(d) => String(d.id)}
          contentContainerStyle={styles.listContent}
          renderItem={renderCard}
          // B2 scroll-perf tuning (b2-spike.md): render fewer cards per batch/window. With
          // pagination on, a page is only PAGE_SIZE cards so this rarely bites, but it keeps a
          // sub-PAGE_SIZE list (e.g. today's bag) smooth too.
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          ListFooterComponent={
            paginated ? (
              <View style={styles.pager}>
                <Pressable
                  style={[styles.pagerBtn, clampedPage === 0 && styles.pagerBtnDisabled]}
                  onPress={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={clampedPage === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Previous page"
                >
                  <Text style={[styles.pagerBtnText, clampedPage === 0 && styles.pagerBtnTextDisabled]}>‹ Prev</Text>
                </Pressable>
                <Text style={styles.pagerLabel}>
                  Page {clampedPage + 1} of {pageCount}
                </Text>
                <Pressable
                  style={[styles.pagerBtn, clampedPage >= pageCount - 1 && styles.pagerBtnDisabled]}
                  onPress={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={clampedPage >= pageCount - 1}
                  accessibilityRole="button"
                  accessibilityLabel="Next page"
                >
                  <Text style={[styles.pagerBtnText, clampedPage >= pageCount - 1 && styles.pagerBtnTextDisabled]}>Next ›</Text>
                </Pressable>
              </View>
            ) : null
          }
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
  // Bag/Collection segmented control (B2)
  segment: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 10, padding: 3, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: 'rgba(145,94,255,0.16)' },
  segmentText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: colors.accent },
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
  // B2 pagination footer
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 4 },
  pagerBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  pagerBtnDisabled: { opacity: 0.4 },
  pagerBtnText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  pagerBtnTextDisabled: { color: colors.muted },
  pagerLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  listContent: { paddingBottom: 24 },
});
