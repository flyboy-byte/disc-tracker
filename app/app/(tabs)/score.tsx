// Offline scorekeeper (B3) — the "Score" tab. A dead-simple, fully-offline disc-golf scorecard:
// the thing you reach for when UDisc won't load or there's no signal. One component, four internal
// views (list → setup → active → summary) managed by state, same pattern the Bag tab uses for its
// modes. All data is local SQLite (db.ts round CRUD); scoring math is roundMath.ts. See
// app/plan/docs/scorekeeper-scope.md for scope + the hard non-goals (no GPS/maps/course-DB/online).
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  createRound,
  deleteRound,
  getOrCreateDefaultUser,
  getRound,
  listRounds,
  setPar,
  setScore,
  updateRoundMeta,
} from '../../src/db/db';
import { colors } from '../../src/theme';
import GradientButton from '../../src/components/GradientButton';
import EmptyStateIcon from '../../src/components/EmptyStateIcon';
import Icon from '../../src/components/Icon';
import SegmentedControl from '../../src/components/SegmentedControl';
import {
  coursePar,
  formatVsPar,
  parForHole,
  standings,
  strokesAt,
  isRoundComplete,
  type Round,
} from '../../src/utils/roundMath';

type Mode = 'list' | 'setup' | 'active' | 'summary';
// Casual-group cap. Bigger groups than this are rare on one card; the hole-by-hole view scrolls
// fine, and the summary grid scrolls horizontally, so this is a UX guardrail, not a DB limit.
const MAX_PLAYERS = 8;
// Header links are short text ("‹ Rounds", "Finish", "Edit") — pad the touch area so they clear
// the ~44px minimum tap target even though the glyphs are small.
const HEADER_HITSLOP = { top: 12, bottom: 12, left: 12, right: 12 };

export default function ScoreScreen() {
  const [loading, setLoading] = useState(true);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [mode, setMode] = useState<Mode>('list');
  const [active, setActive] = useState<Round | null>(null);
  // Multiselect on the rounds list: null = off; an array (possibly empty) = selection mode on.
  // Entered via long-press, used for bulk delete + single rename.
  const [selected, setSelected] = useState<number[] | null>(null);
  const [renaming, setRenaming] = useState<Round | null>(null);
  const userIdRef = useRef<number | null>(null);

  const refetch = useCallback(async () => {
    if (userIdRef.current == null) userIdRef.current = await getOrCreateDefaultUser();
    setRounds(await listRounds(userIdRef.current));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // UX_AUDIT.md E1: setup/active/summary are modes of this one screen, not router destinations
  // — without this, the hardware/gesture Back button doesn't map to '‹ Rounds' and instead falls
  // through to the tab navigator (switches tabs), worst mid-round. One listener at the screen
  // level covers all three non-list modes with the same "go back to the rounds list" action each
  // already exposes via onCancel/onExit/onBack. Added/removed on focus so it never intercepts
  // Back for another tab while this one is just mounted-but-not-visible.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (mode === 'setup') {
          setMode('list');
          return true;
        }
        if (mode === 'active') {
          refetch();
          setMode('list');
          return true;
        }
        if (mode === 'summary') {
          setActive(null);
          setMode('list');
          return true;
        }
        return false; // mode === 'list': let Back behave normally (exit tab/app)
      });
      return () => sub.remove();
    }, [mode, refetch])
  );

  const openRound = async (r: Round) => {
    const full = await getRound(r.id);
    if (!full) return;
    setActive(full);
    setMode(full.finished ? 'summary' : 'active');
  };

  const reloadActive = async () => {
    if (active == null) return;
    const full = await getRound(active.id);
    if (full) setActive(full);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (mode === 'setup') {
    return (
      <SetupView
        lastRound={rounds[0] ?? null}
        onCancel={() => setMode('list')}
        onCreate={async (input) => {
          const uid = userIdRef.current;
          if (uid == null) return;
          const id = await createRound(uid, input);
          const full = await getRound(id);
          await refetch();
          if (full) {
            setActive(full);
            setMode('active');
          }
        }}
      />
    );
  }

  if (mode === 'active' && active) {
    return (
      <ActiveView
        round={active}
        onSetScore={async (playerId, hole, strokes) => {
          await setScore(active.id, playerId, hole, strokes);
          await reloadActive();
        }}
        onSetPar={async (hole, par) => {
          await setPar(active.id, hole, par);
          await reloadActive();
        }}
        onFinish={async () => {
          await updateRoundMeta(active.id, { finished: true });
          await refetch();
          const full = await getRound(active.id);
          setActive(full);
          setMode('summary');
        }}
        onExit={async () => {
          await refetch();
          setMode('list');
        }}
      />
    );
  }

  if (mode === 'summary' && active) {
    return (
      <SummaryView
        round={active}
        onResume={() => setMode('active')}
        onBack={() => {
          setActive(null);
          setMode('list');
        }}
        onDelete={() => {
          Alert.alert('Delete this round?', 'This permanently removes the round and its scores.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                await deleteRound(active.id);
                await refetch();
                setActive(null);
                setMode('list');
              },
            },
          ]);
        }}
      />
    );
  }

  // ── List view ──
  const inProgress = rounds.filter((r) => !r.finished);
  const done = rounds.filter((r) => r.finished);
  const selecting = selected !== null;
  const selCount = selected?.length ?? 0;

  const startSelection = (id: number) => setSelected([id]);
  const exitSelection = () => setSelected(null);
  const toggleSelect = (id: number) =>
    setSelected((cur) => {
      if (cur == null) return [id];
      return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    });

  const onRowPress = (r: Round) => (selecting ? toggleSelect(r.id) : openRound(r));

  const deleteSelected = () => {
    if (selCount === 0) return;
    const ids = selected!;
    Alert.alert(
      `Delete ${ids.length} ${ids.length === 1 ? 'round' : 'rounds'}?`,
      'This permanently removes them and their scores.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            for (const id of ids) await deleteRound(id);
            await refetch();
            exitSelection();
          },
        },
      ]
    );
  };

  const commitRename = async (label: string) => {
    if (renaming == null) return;
    await updateRoundMeta(renaming.id, { label: label.trim() });
    setRenaming(null);
    await refetch();
    exitSelection();
  };

  const renderRow = (r: Round) => (
    <RoundRow
      key={r.id}
      round={r}
      selecting={selecting}
      checked={selected?.includes(r.id) ?? false}
      onPress={() => onRowPress(r)}
      onLongPress={() => startSelection(r.id)}
    />
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {selecting ? (
        <View style={styles.selBar}>
          <Pressable style={styles.headerBtn} hitSlop={HEADER_HITSLOP} onPress={exitSelection} accessibilityRole="button" accessibilityLabel="Cancel selection">
            <Text style={styles.backLink}>Cancel</Text>
          </Pressable>
          <Text style={styles.selCount}>{selCount} selected</Text>
          <View style={styles.selActions}>
            <Pressable
              style={styles.headerBtn}
              hitSlop={HEADER_HITSLOP}
              disabled={selCount !== 1}
              onPress={() => setRenaming(rounds.find((r) => r.id === selected![0]) ?? null)}
              accessibilityRole="button"
              accessibilityLabel="Rename selected round"
            >
              <Text style={[styles.backLink, styles.finishLink, selCount !== 1 && styles.selDisabled]}>Rename</Text>
            </Pressable>
            <Pressable
              style={styles.headerBtn}
              hitSlop={HEADER_HITSLOP}
              disabled={selCount === 0}
              onPress={deleteSelected}
              accessibilityRole="button"
              accessibilityLabel="Delete selected rounds"
            >
              <Text style={[styles.backLink, styles.selDelete, selCount === 0 && styles.selDisabled]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.title}>Score</Text>
          <Text style={styles.substat}>Keep score offline — no signal, account, or course lookup needed</Text>
          <GradientButton style={styles.primaryBtn} textStyle={styles.primaryBtnText} onPress={() => setMode('setup')} label="+ New round" accessibilityLabel="Start a new round" />
        </>
      )}

      {rounds.length === 0 ? (
        <View style={styles.empty}>
          <EmptyStateIcon name="score" />
          <Text style={styles.emptyTitle}>No rounds yet</Text>
          <Text style={styles.emptyBody}>Start a round and keep score hole by hole. Everything stays on this device.</Text>
        </View>
      ) : (
        <>
          {inProgress.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>In progress</Text>
              {inProgress.map(renderRow)}
            </>
          )}
          {done.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Finished</Text>
              {done.map(renderRow)}
            </>
          )}
          {!selecting && <Text style={styles.selHint}>Tip: long-press a round to select, rename, or delete.</Text>}
        </>
      )}

      <RenameRoundModal
        round={renaming}
        onCancel={() => setRenaming(null)}
        onSave={commitRename}
      />
    </ScrollView>
  );
}

// Rename dialog — Android's Alert has no text-input variant, so this is a small controlled modal.
function RenameRoundModal({ round, onCancel, onSave }: { round: Round | null; onCancel: () => void; onSave: (label: string) => void }) {
  const [text, setText] = useState('');
  return (
    <Modal visible={round !== null} transparent animationType="fade" onRequestClose={onCancel} onShow={() => setText(round?.label?.trim() || '')}>
      <Pressable style={styles.renameBackdrop} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel">
        <Pressable style={styles.renameCard} onPress={() => {}}>
          <Text style={styles.renameTitle}>Rename round</Text>
          <TextInput
            style={styles.renameInput}
            value={text}
            onChangeText={setText}
            placeholder="Round name"
            placeholderTextColor={colors.muted}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => onSave(text)}
          />
          <View style={styles.renameBtnRow}>
            <Pressable style={styles.ghostBtn} hitSlop={4} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel">
              <Text style={styles.ghostBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={() => onSave(text)} accessibilityRole="button" accessibilityLabel="Save name">
              <Text style={styles.saveBtnText}>Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// A summary row in the rounds list.
function RoundRow({
  round,
  onPress,
  onLongPress,
  selecting,
  checked,
}: {
  round: Round;
  onPress: () => void;
  onLongPress: () => void;
  selecting: boolean;
  checked: boolean;
}) {
  const title = round.label?.trim() || round.course?.trim() || 'Round';
  const board = standings(round);
  const leader = board[0];
  const par = coursePar(round.holes, round.holeCount);
  const sub = [round.course?.trim() || null, `${round.holeCount} holes`, `par ${par}`, `${round.players.length}p`]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      style={[styles.row, checked && styles.rowChecked]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      accessibilityRole="button"
      accessibilityLabel={selecting ? `${checked ? 'Deselect' : 'Select'} ${title}` : `Open ${title}`}
    >
      {selecting && (
        <View style={[styles.checkbox, checked && styles.checkboxOn]}>
          {checked && <Icon name="check" color="#fff" size={14} strokeWidth={2.6} />}
        </View>
      )}
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      {leader && leader.holesPlayed > 0 && (
        <View style={styles.rowScore}>
          <Text style={styles.rowScoreName}>{leader.player.name}</Text>
          <Text style={styles.rowScoreVal}>
            {leader.total} <Text style={styles.rowScorePar}>({formatVsPar(leader.vsPar)})</Text>
          </Text>
        </View>
      )}
      {!selecting && <Icon name="chevron-right" color={colors.muted} size={18} />}
    </Pressable>
  );
}

// ── Setup ──
// lastRound: the most recently created round (any status), used only to prefill course/players
// for a repeat group at the same course — a real friction-reducer for casual leagues that play
// the same layout weekly. Hole count is never carried over silently; it's always an explicit tap.
function SetupView({
  onCancel,
  onCreate,
  lastRound,
}: {
  onCancel: () => void;
  onCreate: (input: import('../../src/db/db').NewRoundInput) => void;
  lastRound: Round | null;
}) {
  const [label, setLabel] = useState('');
  const [course, setCourse] = useState(lastRound?.course?.trim() ?? '');
  const [holeCount, setHoleCount] = useState(18);
  // Whether the hole count matches a quick-pick preset, or was hand-adjusted via the stepper.
  const [customHoles, setCustomHoles] = useState(false);
  const [players, setPlayers] = useState<string[]>(
    lastRound?.players.length ? lastRound.players.map((p) => p.name) : ['Me']
  );

  const pickPreset = (n: number) => {
    setHoleCount(n);
    setCustomHoles(false);
  };

  const start = () => {
    const names = players.map((p) => p.trim()).filter(Boolean);
    onCreate({
      label: label.trim(),
      course: course.trim(),
      playedOn: new Date().toISOString().slice(0, 10),
      holeCount,
      pars: Array(holeCount).fill(3), // default all par 3; editable per-hole on the scorecard
      playerNames: names.length ? names : ['Me'],
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>New round</Text>

      <Text style={styles.fieldLabel}>Label (optional)</Text>
      <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="Sunday singles" placeholderTextColor={colors.muted} />

      <Text style={styles.fieldLabel}>Course (optional)</Text>
      <TextInput style={styles.input} value={course} onChangeText={setCourse} placeholder="Maple Hill" placeholderTextColor={colors.muted} />

      <Text style={styles.fieldLabel}>Holes</Text>
      {/* When neither preset matches and customHoles is false (only reachable from a restored
          round with an odd hole count), no segment reads as selected — same as the pills did. */}
      <SegmentedControl
        testIDPrefix="holes-preset"
        accessibilityLabel="Hole count"
        value={customHoles ? 'custom' : String(holeCount)}
        onChange={(key) => (key === 'custom' ? setCustomHoles(true) : pickPreset(Number(key)))}
        options={[
          { key: '9', label: '9' },
          { key: '18', label: '18' },
          { key: 'custom', label: 'Custom' },
        ]}
      />
      {customHoles && (
        <View style={styles.stepperRow}>
          <Stepper value={holeCount} min={1} max={36} onChange={setHoleCount} />
        </View>
      )}

      <Text style={styles.fieldLabel}>Players</Text>
      {players.map((name, i) => (
        <View key={i} style={styles.playerRow}>
          <TextInput
            style={[styles.input, styles.playerInput]}
            value={name}
            onChangeText={(t) => setPlayers((prev) => prev.map((p, j) => (j === i ? t : p)))}
            placeholder={`Player ${i + 1}`}
            placeholderTextColor={colors.muted}
          />
          {players.length > 1 && (
            <Pressable
              style={styles.removePlayer}
              onPress={() => setPlayers((prev) => prev.filter((_, j) => j !== i))}
              accessibilityRole="button"
              accessibilityLabel={`Remove player ${i + 1}`}
            >
              <Icon name="close" color={colors.danger} size={15} strokeWidth={2.2} />
            </Pressable>
          )}
        </View>
      ))}
      {players.length < MAX_PLAYERS && (
        <Pressable
          style={styles.ghostBtn}
          hitSlop={4}
          onPress={() => setPlayers((prev) => [...prev, `Player ${prev.length + 1}`])}
          accessibilityRole="button"
          accessibilityLabel="Add a player"
        >
          <Text style={styles.ghostBtnText}>+ Add player</Text>
        </Pressable>
      )}

      <View style={styles.setupActions}>
        <Pressable style={styles.ghostBtn} hitSlop={4} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel">
          <Text style={styles.ghostBtnText}>Cancel</Text>
        </Pressable>
        <GradientButton style={styles.primaryBtn} textStyle={styles.primaryBtnText} onPress={start} label="Start round" accessibilityLabel="Start round" />
      </View>
    </ScrollView>
  );
}

// ── Active scorecard (hole by hole) ──
function ActiveView({
  round,
  onSetScore,
  onSetPar,
  onFinish,
  onExit,
}: {
  round: Round;
  onSetScore: (playerId: number, hole: number, strokes: number) => void;
  onSetPar: (hole: number, par: number) => void;
  onFinish: () => void;
  onExit: () => void;
}) {
  const [hole, setHole] = useState(() => firstUnfinishedHole(round));
  const par = parForHole(round.holes, hole);
  const board = standings(round);
  // Quick-pick strip: tapping the big stroke number opens a row of exact-score chips for that
  // player, so a common score is one tap instead of several +/- taps. Only one open at a time;
  // switching holes closes it (a stale open picker pointed at the wrong hole would be a real
  // mis-tap risk).
  const [quickPickPlayer, setQuickPickPlayer] = useState<number | null>(null);
  const goHole = (h: number) => {
    setQuickPickPlayer(null);
    setHole(h);
  };

  return (
    <View style={styles.container}>
      <View style={styles.activeHeader}>
        <Pressable style={styles.headerBtn} hitSlop={HEADER_HITSLOP} onPress={onExit} accessibilityRole="button" accessibilityLabel="Back to rounds">
          <Text style={styles.backLink}>‹ Rounds</Text>
        </Pressable>
        <Text style={styles.activeTitle}>{round.label?.trim() || round.course?.trim() || 'Round'}</Text>
        <Pressable style={styles.headerBtn} hitSlop={HEADER_HITSLOP} onPress={onFinish} accessibilityRole="button" accessibilityLabel="Finish round">
          <Text style={[styles.backLink, styles.finishLink]}>Finish</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.holeNav}>
          <Pressable
            style={[styles.holeNavBtn, hole <= 1 && styles.holeNavBtnDisabled]}
            disabled={hole <= 1}
            onPress={() => goHole(Math.max(1, hole - 1))}
            accessibilityRole="button"
            accessibilityLabel="Previous hole"
          >
            <Icon name="chevron-left" color={colors.accent} size={26} strokeWidth={2.2} />
          </Pressable>
          <View style={styles.holeCenter}>
            <Text style={styles.holeLabel}>Hole {hole} of {round.holeCount}</Text>
            <View style={styles.parRow}>
              <Text style={styles.parLabel}>Par</Text>
              <Stepper value={par} min={2} max={6} small onChange={(v) => onSetPar(hole, v)} />
            </View>
          </View>
          <Pressable
            style={[styles.holeNavBtn, hole >= round.holeCount && styles.holeNavBtnDisabled]}
            disabled={hole >= round.holeCount}
            onPress={() => goHole(Math.min(round.holeCount, hole + 1))}
            accessibilityRole="button"
            accessibilityLabel="Next hole"
          >
            <Icon name="chevron-right" color={colors.accent} size={26} strokeWidth={2.2} />
          </Pressable>
        </View>

        {round.players.map((p) => {
          const stored = strokesAt(round.scores, p.id, hole);
          const shown = stored ?? par; // unscored holes preview par (dimmed) until you commit one
          const st = board.find((s) => s.player.id === p.id);
          const tierColor = stored != null ? colors.text : colors.muted;
          const pickerOpen = quickPickPlayer === p.id;
          // 1..(par+4), floor 6, cap 12 — covers everything from an ace to a real blowup hole
          // without the chip row scrolling on a normal phone width.
          const chips = Array.from({ length: Math.min(12, Math.max(6, par + 4)) }, (_, i) => i + 1);
          return (
            <View key={p.id} style={styles.scoreCard}>
              <View style={styles.scoreCardHead}>
                <Text style={styles.scorePlayer}>{p.name}</Text>
                {st && st.holesPlayed > 0 && (
                  <Text style={styles.scoreTotal}>
                    {st.total} <Text style={styles.scoreTotalPar}>({formatVsPar(st.vsPar)})</Text>
                  </Text>
                )}
              </View>
              <View style={styles.strokeRow}>
                <Pressable
                  style={styles.strokeBtn}
                  // First tap on an unscored hole just commits the previewed par (matches the
                  // dimmed default shown below) instead of jumping straight to par-1 — the ghost
                  // number IS the starting point, tapping +/- moves away from it, not past it.
                  onPress={() => onSetScore(p.id, hole, stored == null ? par : Math.max(1, shown - 1))}
                  accessibilityRole="button"
                  accessibilityLabel={`Decrease ${p.name}'s strokes`}
                >
                  <Text style={styles.strokeBtnText}>−</Text>
                </Pressable>
                <Pressable
                  onPress={() => setQuickPickPlayer(pickerOpen ? null : p.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Pick ${p.name}'s exact score`}
                >
                  <Text style={[styles.strokeValue, { color: tierColor }, stored == null && styles.strokeValueGhost]}>{shown}</Text>
                </Pressable>
                <Pressable
                  style={styles.strokeBtn}
                  onPress={() => onSetScore(p.id, hole, stored == null ? par : shown + 1)}
                  accessibilityRole="button"
                  accessibilityLabel={`Increase ${p.name}'s strokes`}
                >
                  <Text style={styles.strokeBtnText}>+</Text>
                </Pressable>
              </View>
              {pickerOpen && (
                <View style={styles.quickPickRow}>
                  {chips.map((n) => (
                    <Pressable
                      key={n}
                      testID={`quickpick-${p.id}-${n}`}
                      style={[styles.quickPickChip, n === stored && styles.quickPickChipActive]}
                      onPress={() => {
                        onSetScore(p.id, hole, n);
                        setQuickPickPlayer(null);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Set ${p.name}'s score to ${n}`}
                    >
                      <Text style={[styles.quickPickChipText, n === stored && styles.quickPickChipTextActive]}>{n}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {isRoundComplete(round) && (
          <GradientButton style={styles.primaryBtn} textStyle={styles.primaryBtnText} onPress={onFinish} label="Finish round" accessibilityLabel="Finish round" />
        )}
      </ScrollView>
    </View>
  );
}

// ── Summary ──
function SummaryView({ round, onResume, onBack, onDelete }: { round: Round; onResume: () => void; onBack: () => void; onDelete: () => void }) {
  const board = standings(round);
  const par = coursePar(round.holes, round.holeCount);
  const holes = Array.from({ length: round.holeCount }, (_, i) => i + 1);

  return (
    <View style={styles.container}>
      <View style={styles.activeHeader}>
        <Pressable style={styles.headerBtn} hitSlop={HEADER_HITSLOP} onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to rounds">
          <Text style={styles.backLink}>‹ Rounds</Text>
        </Pressable>
        <Text style={styles.activeTitle}>{round.label?.trim() || round.course?.trim() || 'Round'}</Text>
        <Pressable style={styles.headerBtn} hitSlop={HEADER_HITSLOP} onPress={onResume} accessibilityRole="button" accessibilityLabel="Keep scoring">
          <Text style={styles.backLink}>Edit</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.substat}>
          {round.holeCount} holes · par {par}
          {round.course?.trim() ? ` · ${round.course.trim()}` : ''}
        </Text>

        {board.map((s, i) => (
          <View key={s.player.id} style={styles.standingRow}>
            <Text style={styles.standingRank}>{s.holesPlayed > 0 ? i + 1 : '–'}</Text>
            <Text style={styles.standingName}>{s.player.name}</Text>
            <Text style={styles.standingTotal}>
              {s.total} <Text style={styles.standingPar}>({formatVsPar(s.vsPar)})</Text>
            </Text>
          </View>
        ))}

        {/* Per-hole grid (players × holes) */}
        <Text style={styles.sectionLabel}>Scorecard</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.gridWrap}>
          <View>
            <View style={styles.gridRow}>
              <Text style={[styles.gridCell, styles.gridHeadCell, styles.gridNameCell]}>Hole</Text>
              {holes.map((h) => (
                <Text key={h} style={[styles.gridCell, styles.gridHeadCell]}>{h}</Text>
              ))}
              <Text style={[styles.gridCell, styles.gridHeadCell]}>Tot</Text>
            </View>
            <View style={styles.gridRow}>
              <Text style={[styles.gridCell, styles.gridParCell, styles.gridNameCell]}>Par</Text>
              {holes.map((h) => (
                <Text key={h} style={[styles.gridCell, styles.gridParCell]}>{parForHole(round.holes, h)}</Text>
              ))}
              <Text style={[styles.gridCell, styles.gridParCell]}>{par}</Text>
            </View>
            {round.players.map((p) => {
              const st = board.find((s) => s.player.id === p.id);
              return (
                <View key={p.id} style={styles.gridRow}>
                  <Text style={[styles.gridCell, styles.gridNameCell]} numberOfLines={1}>{p.name}</Text>
                  {holes.map((h) => {
                    const v = strokesAt(round.scores, p.id, h);
                    const color = v != null ? colors.text : colors.muted;
                    return (
                      <Text key={h} style={[styles.gridCell, { color }]}>{v ?? '–'}</Text>
                    );
                  })}
                  <Text style={[styles.gridCell, styles.gridTotalCell]}>{st?.total ?? 0}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>

        <Pressable style={styles.dangerBtn} onPress={onDelete} accessibilityRole="button" accessibilityLabel="Delete round">
          <Text style={styles.dangerBtnText}>Delete round</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// First hole with any player unscored (where you'd resume); falls back to hole 1.
function firstUnfinishedHole(round: Round): number {
  for (let h = 1; h <= round.holeCount; h++) {
    if (round.players.some((p) => strokesAt(round.scores, p.id, h) === undefined)) return h;
  }
  return 1;
}

function Stepper({ value, min, max, small, onChange }: { value: number; min: number; max: number; small?: boolean; onChange: (v: number) => void }) {
  return (
    <View style={styles.stepper}>
      <Pressable
        style={[styles.stepBtn, small && styles.stepBtnSmall, value <= min && styles.stepBtnDisabled]}
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, value - 1))}
        accessibilityRole="button"
        accessibilityLabel="Decrease"
      >
        <Text style={styles.stepBtnText}>−</Text>
      </Pressable>
      <Text style={[styles.stepValue, small && styles.stepValueSmall]}>{value}</Text>
      <Pressable
        style={[styles.stepBtn, small && styles.stepBtnSmall, value >= max && styles.stepBtnDisabled]}
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, value + 1))}
        accessibilityRole="button"
        accessibilityLabel="Increase"
      >
        <Text style={styles.stepBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 14, paddingTop: 56, paddingBottom: 40, gap: 10 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  substat: { color: colors.muted, fontSize: 12, marginBottom: 4 },

  primaryBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  ghostBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center' },
  ghostBtnText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  dangerBtn: { borderWidth: 1, borderColor: 'rgba(248,113,113,0.4)', borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 20 },
  dangerBtnText: { color: colors.danger, fontSize: 14, fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  emptyBody: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 20 },

  sectionLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 14, marginBottom: 2 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14 },
  rowChecked: { borderColor: colors.accent, backgroundColor: colors.cardHover },
  rowMain: { flex: 1, minWidth: 0 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  // Selection toolbar (replaces the title row while multiselect is active)
  selBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 },
  selCount: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'center' },
  selActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selDelete: { color: colors.danger },
  selDisabled: { opacity: 0.35 },
  selHint: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 16 },
  // Rename modal
  renameBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  renameCard: { width: '100%', maxWidth: 400, backgroundColor: colors.card, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: colors.border },
  renameTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  renameInput: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontSize: 15, marginBottom: 14 },
  renameBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  saveBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 20, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  rowScore: { alignItems: 'flex-end' },
  rowScoreName: { color: colors.muted, fontSize: 10 },
  rowScoreVal: { color: colors.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rowScorePar: { color: colors.accent, fontSize: 12, fontWeight: '600' },

  fieldLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 12, marginBottom: 2 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.text, fontSize: 15, paddingHorizontal: 12, paddingVertical: 10 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperHint: { color: colors.muted, fontSize: 12 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  playerInput: { flex: 1 },
  removePlayer: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  setupActions: { flexDirection: 'row', gap: 10, marginTop: 20 },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  stepBtnSmall: { width: 30, height: 30, borderRadius: 8 },
  stepBtnDisabled: { opacity: 0.35 },
  stepBtnText: { color: colors.accent, fontSize: 20, fontWeight: '700' },
  stepValue: { color: colors.text, fontSize: 20, fontWeight: '700', minWidth: 32, textAlign: 'center', fontVariant: ['tabular-nums'] },
  stepValueSmall: { fontSize: 16, minWidth: 22 },

  activeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 },
  activeTitle: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'center' },
  headerBtn: { paddingVertical: 8, paddingHorizontal: 6, justifyContent: 'center', minHeight: 40 },
  backLink: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  finishLink: { color: colors.accent },

  holeNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  holeNavBtn: { width: 52, height: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  holeNavBtnDisabled: { opacity: 0.3 },
  holeCenter: { alignItems: 'center', gap: 6 },
  holeLabel: { color: colors.text, fontSize: 18, fontWeight: '800' },
  parRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  parLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },

  scoreCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, gap: 10 },
  scoreCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scorePlayer: { color: colors.text, fontSize: 16, fontWeight: '700' },
  scoreTotal: { color: colors.muted, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  scoreTotalPar: { color: colors.accent },
  strokeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  strokeBtn: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  strokeBtnText: { color: colors.accent, fontSize: 28, fontWeight: '700' },
  strokeValue: { color: colors.text, fontSize: 34, fontWeight: '800', minWidth: 48, textAlign: 'center', fontVariant: ['tabular-nums'] },
  strokeValueGhost: { color: colors.muted, opacity: 0.55 },
  quickPickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  quickPickChip: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  quickPickChipActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  quickPickChipText: { color: colors.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  quickPickChipTextActive: { color: '#fff' },

  standingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14 },
  standingRank: { color: colors.accent, fontSize: 15, fontWeight: '800', width: 18 },
  standingName: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  standingTotal: { color: colors.text, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  standingPar: { color: colors.accent, fontSize: 13, fontWeight: '600' },

  gridWrap: { paddingVertical: 6 },
  gridRow: { flexDirection: 'row' },
  gridCell: { width: 34, textAlign: 'center', color: colors.text, fontSize: 12, paddingVertical: 6, fontVariant: ['tabular-nums'] },
  gridHeadCell: { color: colors.muted, fontWeight: '700' },
  gridParCell: { color: colors.muted },
  gridNameCell: { width: 70, textAlign: 'left', fontWeight: '600' },
  gridTotalCell: { fontWeight: '800' },
});
