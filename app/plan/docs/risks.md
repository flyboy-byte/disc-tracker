# Risks

> **Tier:** Mixed — scope/dependency/legal sections are high-level (decision-maker,
> plus a lawyer where relevant); technical/operational sections are low-level
> (implementer) · **Audience:** decision-maker for the whole doc, whoever
> builds/operates for the technical section · **Use when:** before committing to the
> approach (scope/legal section), before scaling or shipping (operational section), and
> as an ongoing check during build (technical section). Legal-research candidates are
> flagged in [`research-handoff.md`](./research-handoff.md).

## Scope / dependency risk

- **Two codebases, one spec.** The website is the canonical source of truth for
  behavior; every time disc logic, scenario rules, or the schema changes on the website
  side, the mobile port needs a matching update or it silently drifts out of parity.
  Nothing currently automates that check beyond the Phase 0 fixture tables, which are a
  point-in-time snapshot, not a live sync.
- **`react-native-reanimated`'s hard dependency on `react-native-worklets`** already bit
  this project once — an `npm install --legacy-peer-deps` silently pruned it and broke
  every JS-pre-bundling path for the entire session without either Jest or the one
  successful Gradle build catching it. Any future dependency-install command that uses
  `--legacy-peer-deps` or `--force` is a candidate to re-break this the same way. *(This
  incident is documented here and in `infrastructure.md` from git history — commit
  `c5899e9` — not from `PORT_PLAN.md`/`RESEARCH.md` themselves, which don't mention it;
  worth adding a line to `PORT_PLAN.md`'s Phase 1 notes at some point so it's not only
  discoverable via git log.)*
- **Physics-sim mode has no mobile equivalent** and isn't explicitly scoped in or out —
  it depends on server-side NumPy/SciPy (`vendor/shotshaper/`), which can't run
  on-device. If this is ever wanted on mobile it would need either a from-scratch port
  of a GPLv3 rigid-body simulator to run natively, or a network call back to the VPS —
  both are real scope additions, not currently planned (see `notes.md`).
- **F-Droid's reproducibility bar for RN apps** is a real unknown (see
  `research-handoff.md`) — if it turns out no realistic amount of effort gets a byte
  match, the fallback (reference-APK workflow, `Binaries:` entry in fdroiddata) is
  already the documented plan, so this risk is bounded, not open-ended.

## Legal / licensing risk

- **`vendor/shotshaper/` is GPLv3**, vendored into the website with documented
  provenance and one tracked local modification. It's not part of the mobile app at
  all currently (physics-sim doesn't run there). Unlike a typical license risk, this
  was already deliberately pre-empted: `RESEARCH.md` §3 records that the mobile app's
  own license was chosen as GPLv3 *specifically* to allow porting/deriving code from
  GPLv3 prior art like shotshaper, not MIT. So if physics-sim ever comes to mobile, the
  licensing question is already answered by that choice — the remaining open question
  (see `notes.md`) is purely whether it's worth building at all, not whether it's legally
  permitted.
- **F-Droid / Play Store distribution policies** both have real, current requirements
  (GMS-free dependency check already built into Phase 8, Play Console's Data Safety
  form, privacy policy URL) — `PORT_PLAN.md` already accounts for the GMS check
  mechanically, but the Data Safety form's actual current requirements for a
  zero-network app are a research-handoff candidate, not something to guess at.
- **Disc master library data** (`discs_master.json`, bundled in both website and app) —
  its original source/licensing isn't addressed anywhere in the docs reviewed for this
  packet. Not necessarily a problem, but worth a deliberate one-time check rather than
  an assumption, since it's redistributed inside a public app.

## Technical risk

- **The SQLite CRUD layer is unverified on real native code** — the single largest
  concrete technical risk right now, called out repeatedly in `PORT_PLAN.md` and this
  packet's `FRAMEWORK.md`. It typechecks and the logic mirrors `app.py`'s schema
  exactly, but "the code looks right" and "the code works under real native SQLite
  concurrency" are different claims, and only the first has been checked so far.
- **The custom vertical-slider component** (Reanimated + `useSharedValue`, no direct
  RN built-in equivalent) is planned but unbuilt (Phase 5) — real on-device performance
  for a 60fps arc-redraw-on-drag interaction is unverified until it exists.
- **Gradle build reliability under this environment's constraints** — background builds
  repeatedly hit a 10-minute hard timeout during Phase 1; the fix (letting Gradle's
  disk-persisted task cache carry work across retries) worked but is a workaround for
  an environment limit, not a guarantee it won't recur on a bigger build (e.g. Phase 8's
  release/bundle builds, which do more work than a debug build).

## Operational risk

- **Solo maintenance across two live apps** (this port + DragTree) plus the website —
  toolchain drift (JDK/SDK/NDK version bumps, Expo SDK major version bumps — note the
  standing instruction in `app/AGENTS.md` to re-check versioned Expo docs before writing
  code, since "Expo HAS CHANGED") is an ongoing cost, not a one-time setup cost.
- **No crash/error visibility in the field** (deliberate, per the no-analytics
  constraint) means any real-world bug post-launch is invisible unless self-noticed or
  reported directly — acceptable for a personal-use-first app, worth remembering before
  wide public distribution.
- **Distribution sequencing risk is already mitigated by policy**: `PORT_PLAN.md`
  explicitly forbids running D1 (Play Console) and D2 (F-Droid) in parallel, based on
  DragTree's experience that debugging both build/signing/metadata systems at once
  makes failures impossible to isolate. Worth keeping that discipline when this phase
  is actually reached.
