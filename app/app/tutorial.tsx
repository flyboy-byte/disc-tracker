// In-app "How to use" tutorial — a top-level Stack screen (outside the tab group), reached from
// Settings → About. Not a first-run modal (the app deliberately has no separate welcome modal —
// see index.tsx's empty-bag state and PORT_PLAN.md punch-list P2-4); this is a reference page a
// new *or* returning user can open anytime to see what's here, including features added after
// their first install. Keep this in lockstep with what's actually shipped — update it in the same
// commit as any feature that changes what a new user needs to know.
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../src/theme';

interface Section {
  title: string;
  body: string[];
}

const SECTIONS: Section[] = [
  {
    title: 'Bag',
    body: [
      'Add discs manually or search the 1,660+ disc library (Settings lets you switch to a bigger 1,874-disc Try Discs catalog, or import your own). Assign a color, sort or filter by stability/type, and check discs into "Today\'s Bag" for the set you\'re actually carrying.',
      'Share your bag as one image from the Bag screen\'s share icon — it renders your Today\'s Bag as a clean card and hands it to the Android share sheet. Bags past 12 discs automatically switch to a compact grid layout so a big bag still shares as one reasonably-shaped image.',
    ],
  },
  {
    title: 'Flight Shaper',
    body: [
      'Pick a disc, then adjust hyzer, nose angle, wind, arm power, and spin with the sliders — the arc redraws live, with an estimated distance and a "ghost" arc for comparison.',
      'Toggle "Physics sim" for a real rigid-body flight simulation (driver-class discs only) running entirely on your phone — no server, no signal needed.',
    ],
  },
  {
    title: 'Disc Suggest',
    body: [
      'Pick a shot scenario (Headwind, Max Distance, Roller, and more) and get ranked picks. "Throw" mode ranks your bag and the full library for that scenario; "Buy" mode ranks only discs you don\'t already own, to help find a real gap in your bag.',
      'Swipe a result card sideways to reorder it — that disc drops toward the bottom of that scenario\'s list, and the change is remembered next time you open it. Nothing is ever deleted; a "Reset order" link appears once you\'ve swiped anything.',
      'In Buy mode, an optional Learning engine watches what you swipe away and starts steering the rest of the list off similar flight numbers and brands — aggressively at first, softening over time. Toggle it off anytime in the "Learning: On/Off" pill; discs never get mislabeled by this, only reordered. Use "Brand A–Z" instead of "Best fit" to browse a large result set by manufacturer.',
      'Skill level and throw style (Settings) both tune every scenario\'s targets to match your arm and your backhand/forehand tendencies.',
    ],
  },
  {
    title: 'Score',
    body: [
      'A fully offline scorecard for when the scoring app you normally use won\'t load. Start a round with quick 9 / 18 / Custom hole-count presets — new rounds also prefill the course name and player roster from your most recent round, so a weekly group doesn\'t retype it every time.',
      'Score hole-by-hole with +/- taps, or tap the big stroke number to open a quick-pick strip and set an exact score in one tap. Scores are color-coded (eagle, birdie, par, bogey, double+) on both the live card and the finished scorecard grid.',
      'Everything — rounds, players, holes, pars — stays in the on-device database. No GPS, no course lookup, no account.',
    ],
  },
  {
    title: 'Settings',
    body: [
      'Disc Catalog: switch between the built-in library, the larger Try Discs catalog, or your own imported file/URL — nothing downloads until you ask.',
      'Backup & Restore: one JSON file with every disc, setting, and scorecard (plus your Disc Suggest swipe history and Learning-engine state). Share it, or save straight to a folder on Android — this is the FOSS answer to cloud sync, and it moves your whole app, not just a disc list.',
      'CSV export/import handles just the disc list, for spreadsheets or other apps. Data audit flags discs missing weight, plastic, or a wear estimate.',
      'Reference images (opt-in) and this is worth repeating: it\'s the only feature in the whole app that ever touches the network, and only when you turn it on.',
    ],
  },
];

export default function TutorialScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.headerBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to Settings"
        >
          <Text style={styles.backLink}>‹ Settings</Text>
        </Pressable>
        <Text style={styles.headerTitle}>How to use Disc Tracker</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Everything runs on this device — no account, no signal needed. Here&apos;s what each tab does.
        </Text>
        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.card}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            {s.body.map((p, i) => (
              <Text key={i} style={styles.paragraph}>
                {p}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  headerBtn: { paddingVertical: 8, paddingHorizontal: 6, justifyContent: 'center', minHeight: 40, minWidth: 60 },
  headerTitle: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'center' },
  backLink: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  content: { padding: 14, paddingBottom: 40, gap: 12 },
  intro: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 2 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, gap: 8 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  paragraph: { color: colors.muted, fontSize: 13, lineHeight: 19 },
});
