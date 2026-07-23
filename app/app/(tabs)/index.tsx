// Bag screen — PORT_PLAN.md Phase 4. Ported from templates/index.html's render()/
// openAdd()/openEdit()/saveDisc()/deleteDisc()/setFilter()/setSort()/startDrag()+endDrag().
// CSV export/import is Phase 7, not here (needs expo-file-system/expo-sharing wiring).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';
import { FlatList } from 'react-native-gesture-handler';
import DiscCard from '../../src/components/DiscCard';
import DiscFormModal from '../../src/components/DiscFormModal';
import DiscLibraryModal from '../../src/components/DiscLibraryModal';
import { colors } from '../../src/theme';
import { getDiscs, getMeta, getOrCreateDefaultUser, saveDiscs, setMeta } from '../../src/db/db';
import { discType, stab, type Disc, type DiscType, type Stability } from '../../src/utils/disc';
import type { MasterDisc } from '../../src/utils/masterLibrary';

type StabFilter = 'all' | Stability;
type TypeFilterKey = 'all' | DiscType;
type SortMode = 'speed-desc' | 'speed-asc' | 'name' | 'mfr' | 'custom';

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

function blankDisc(): Disc {
  return { mfr: '', mold: '', plastic: '', weight: '', speed: 7, glide: 4, turn: 0, fade: 2, use: '', thr: 'RHBH', notes: '', color: '' };
}

export default function BagScreen() {
  const [userId, setUserId] = useState<number | null>(null);
  const [discs, setDiscs] = useState<Disc[]>([]);
  const [loading, setLoading] = useState(true);
  const [stabFilter, setStabFilter] = useState<StabFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilterKey>('all');
  const [sortMode, setSortMode] = useState<SortMode>('speed-desc');
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [formIsNew, setFormIsNew] = useState(true);
  const [formInitial, setFormInitial] = useState<Disc>(blankDisc());
  // Bumped on every openAdd/openEdit/library-pick so DiscFormModal's `key` always
  // changes and remounts with fresh state — formIsNew alone isn't enough to key on,
  // since a blank add and a library-prefilled add are both formIsNew=true.
  const [formSession, setFormSession] = useState(0);
  const [libraryOpen, setLibraryOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const uid = await getOrCreateDefaultUser();
      const [loadedDiscs, meta] = await Promise.all([getDiscs(uid), getMeta(uid)]);
      setUserId(uid);
      setDiscs(loadedDiscs);
      setSortMode((meta.sortMode as SortMode) || 'speed-desc');
      setLoading(false);
    })();
  }, []);

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

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = discs.filter((d) => {
      const matchS = stabFilter === 'all' || stab(d) === stabFilter;
      const matchT = typeFilter === 'all' || discType(d) === typeFilter;
      const matchQ = !q || (d.mfr + d.mold + (d.plastic ?? '') + (d.use ?? '') + (d.notes ?? '')).toLowerCase().includes(q);
      return matchS && matchT && matchQ;
    });
    if (sortMode === 'speed-desc') rows = [...rows].sort((a, b) => b.speed - a.speed);
    else if (sortMode === 'speed-asc') rows = [...rows].sort((a, b) => a.speed - b.speed);
    else if (sortMode === 'name') rows = [...rows].sort((a, b) => a.mold.localeCompare(b.mold));
    else if (sortMode === 'mfr') rows = [...rows].sort((a, b) => (a.mfr + a.mold).localeCompare(b.mfr + b.mold));
    // 'custom' — leave in array order
    return rows;
  }, [discs, stabFilter, typeFilter, search, sortMode]);

  const dragEnabled = sortMode === 'custom' && stabFilter === 'all' && typeFilter === 'all' && !search.trim();

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
    let next: Disc[];
    if (formIsNew) {
      const nextId = (discs.reduce((max, d) => Math.max(max, d.id ?? 0), 0) || 100) + 1;
      next = [...discs, { ...saved, id: saved.id ?? nextId }];
    } else {
      next = discs.map((d) => (d.id === saved.id ? { ...saved, inBag: d.inBag } : d));
    }
    setDiscs(next);
    setFormOpen(false);
    await persist(next);
  };

  const handleDelete = async (id: number) => {
    const next = discs.filter((d) => d.id !== id);
    setDiscs(next);
    setFormOpen(false);
    await persist(next);
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
    setDiscs(data);
    await persist(data);
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bag</Text>
        <Text style={styles.substat}>
          {discs.length} discs · {typeCounts.driver}D · {typeCounts.fairway}FD · {typeCounts.mid}M · {typeCounts.putter}P
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
        <Pressable style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Add disc</Text>
        </Pressable>
        {sortMode === 'custom' && (
          <Text style={styles.dragHint}>{dragEnabled ? 'long-press ⠿ to reorder' : 'clear search/filters to drag-reorder'}</Text>
        )}
      </View>

      {filteredSorted.length === 0 ? (
        <Text style={styles.empty}>No discs match.</Text>
      ) : dragEnabled ? (
        <DraggableFlatList
          data={filteredSorted}
          keyExtractor={(d: Disc) => String(d.id)}
          onDragEnd={handleDragEnd}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, drag, isActive }: RenderItemParams<Disc>) => (
            <DiscCard disc={item} onPress={() => openEdit(item)} onLongPress={drag} dragActive={isActive} />
          )}
        />
      ) : (
        <FlatList
          data={filteredSorted}
          keyExtractor={(d) => String(d.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <DiscCard disc={item} onPress={() => openEdit(item)} />}
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
      <DiscLibraryModal visible={libraryOpen} onCancel={() => setLibraryOpen(false)} onPick={handlePickFromLibrary} />
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
        <Pressable key={it.key} onPress={() => onPress(it.key)} style={[styles.pill, active === it.key && styles.pillActive]}>
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
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 },
  addBtn: { backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: '700' },
  dragHint: { color: colors.muted, fontSize: 12, flexShrink: 1 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40 },
  listContent: { paddingBottom: 24 },
});
