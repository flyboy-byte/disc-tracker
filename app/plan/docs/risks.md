# Risks

> **Tier:** Mixed — scope/dependency/legal sections are high-level (decision-maker,
> plus a lawyer where relevant); technical/operational sections are low-level
> (implementer) · **Audience:** decision-maker for the whole doc, whoever
> builds/operates for the technical section · **Use when:** before committing to the
> approach (scope/legal section), before scaling or shipping (operational section), and
> as an ongoing check during build (technical section). Legal-research candidates are
> tracked in the "External research queue" section at the end of this doc.

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
  both are real scope additions, not currently planned. Genuinely undecided, not just
  deferred — nobody has said yes or no to this one.
- ~~F-Droid's reproducibility bar for RN apps is a real unknown~~ — **resolved
  2026-07-23**: the developer's DragTree app already achieved a full `Binaries:` byte
  match and got merged into F-Droid's index, proving it's achievable for this exact
  stack (Expo/RN, local Gradle, no EAS). The concrete playbook — four root causes and
  their fixes, reviewer's actual requirements, the two-run signing process — is in
  `fdroid-reference.md`. Remaining risk is narrower now: applying that playbook
  correctly to this app's specific dependency set when D2 actually starts, not whether
  it's possible at all.

## Legal / licensing risk

- **`vendor/shotshaper/` is GPLv3**, vendored into the website with documented
  provenance and one tracked local modification. It's not part of the mobile app at
  all currently (physics-sim doesn't run there). Unlike a typical license risk, this
  was already deliberately pre-empted: `RESEARCH.md` §3 records that the mobile app's
  own license was chosen as GPLv3 *specifically* to allow porting/deriving code from
  GPLv3 prior art like shotshaper, not MIT. So if physics-sim ever comes to mobile, the
  licensing question is already answered by that choice — the remaining open question is
  purely whether it's worth building at all, not whether it's legally permitted.
- **F-Droid / Play Store distribution policies** both have real, current requirements
  (GMS-free dependency check already built into Phase 8, Play Console's Data Safety
  form, privacy policy URL) — `PORT_PLAN.md` already accounts for the GMS check
  mechanically, but the Data Safety form's actual current requirements for a
  zero-network app are a research-handoff candidate, not something to guess at.
- **Disc master library data** (`discs_master.json`, bundled in both website and app) —
  its original source/licensing isn't addressed anywhere in the docs reviewed for this
  packet. Not necessarily a problem, but worth a deliberate one-time check rather than
  an assumption, since it's redistributed inside a public app. **In progress (2026-08-17):**
  a real, licensed, founder-approved replacement/supplement (TryDiscs) is being evaluated —
  see `catalog-v2-scope.md`. Not resolved yet (blocked on the founder's packaging reply), but
  this is the path that closes this risk out, not a hypothetical.

## Technical risk

- ~~The SQLite CRUD layer is unverified on real native code~~ — **resolved 2026-07-23**.
  Verified end-to-end on a real Android emulator (open → create user → save/read discs
  → meta round-trip → bulk-replace → cascade delete), all passed. See `FRAMEWORK.md`
  Phase 2. No longer a risk; kept here as a historical note until the next edit pass.
- ~~The custom vertical-slider component's on-device performance is unverified~~ —
  **resolved 2026-07-23**. Built on Reanimated + `Gesture.Pan()` and verified with real
  drag gestures on the emulator (60fps arc redraw, no jank). Note the non-obvious finding:
  the cheaper "rotated native slider" approach *failed* on-device (gesture-negotiation
  conflict with the parent ScrollView), so the custom component wasn't gold-plating — it
  was required. See `../PORT_PLAN.md` Phase 5.
- ~~Gradle release/bundle build reliability under this environment's timeouts~~ —
  **largely resolved 2026-07-24**. Real `assembleRelease` runs (with R8 minify + resource
  shrink + the ABI override) completed well within the timeout by reusing Gradle's
  disk-persisted task cache across invocations. `bundleRelease` (AAB for Play Console)
  does slightly more work and hasn't been run yet, but the release APK path — the harder
  part — is proven.
- **New (v1-polish debt, from the 2026-07-24 post-`0.4` audit)** — none of these are
  correctness bugs, but they're the gap between "features work" and "shippable v1,"
  tracked as `../PORT_PLAN.md` Phase 9: (1) the today's-bag feature is half-built — schema,
  CRUD, and the CSV export scope picker all assume an `inBag` flag that no UI can set, so
  the "Today's bag" export is a dead path; (2) the tab title renders twice (native header +
  in-screen heading) and the tab bar shows no icons; (3) no accessibility labels on any
  control — fine for personal use, a real gap before Play Store review. The a11y and
  cosmetics items are exactly the "polish needed for public release vs. good enough for
  personal use" tension that runs through this whole project's store-sequencing decisions.

## Operational risk

- **Solo maintenance across two live apps** (this port + DragTree) plus the website —
  toolchain drift (JDK/SDK/NDK version bumps, Expo SDK major version bumps — note the
  standing instruction in `app/AGENTS.md` to re-check versioned Expo docs before writing
  code, since "Expo HAS CHANGED") is an ongoing cost, not a one-time setup cost.
- **No crash/error visibility in the field** (deliberate, per the no-analytics
  constraint) means any real-world bug post-launch is invisible unless self-noticed or
  reported directly — acceptable for a personal-use-first app, worth remembering before
  wide public distribution.
- **Sync design for v1.1 (R5) — DROPPED, not revisited.** `archive/direction-2026-07-29.md`
  (archived) has the real design thinking (own-VPS sync, opt-in), but B4's full
  backup/restore superseded the need for it — see `PORT_PLAN.md`'s R5 row. Kept here as a
  pointer in case it's ever reconsidered, not as an open risk.
- **Distribution sequencing risk is already mitigated by policy**: `PORT_PLAN.md`
  explicitly forbids running D1 (Play Console) and D2 (F-Droid) in parallel, based on
  DragTree's experience that debugging both build/signing/metadata systems at once
  makes failures impossible to isolate. Worth keeping that discipline when this phase
  is actually reached.

## External research queue

(Folded in from the former `research-handoff.md`, 2026-08-17 — merged here since it's really
just a section of this doc, not a separate file.)

Some risks above are things a coding session shouldn't resolve by guessing — they need a **deep
research engine with live web access** (claude.ai research mode, ChatGPT research mode), run by
Logan in the browser, not fabricated here. Something qualifies if it's **externally verifiable**
(a real answer exists in a license, a platform policy, current docs) and not an internal
judgment call.

Open queue:

| # | Question | Why it needs external research |
| - | -------- | -------------------------------- |
| 1 | What does Play Console's Data Safety form currently require for an app that makes zero network calls and collects zero data (fully local-only, no accounts)? | Policy specifics change over time — needs a live, dated source, not training-data recall. |
| 2 | Is `expo-sqlite`'s current API (SDK 57-era) stable enough across recent Expo SDK versions that this project's `withExclusiveTransactionAsync`-based design won't need rework on the next SDK bump? | Framework/library-specific behavior — favors an engine with strong access to current Expo/RN docs and changelogs. |

Resolved, kept for the record:
- ~~F-Droid reproducible-build acceptance for Expo/RN apps built with local Gradle~~ —
  **resolved 2026-07-23 without external research**: DragTree (this developer's other app)
  already achieved a full `Binaries:` byte match and got merged into F-Droid's official index.
  Real answer lives in `fdroid-reference.md`.
- ~~`discs_master.json`'s origin/license~~ — **superseded 2026-08-17, not resolved-in-place**:
  rather than researching the existing file's murky origin, a real licensed
  replacement/supplement (TryDiscs, founder-approved) is in progress instead — see
  `catalog-v2-scope.md`.

**Procedure when picking up a queue item:** research one question at a time (don't batch —
dilutes sourcing). Ask for citations/dated sources explicitly. Save the raw output to
`research/YYYY-MM-DD-<topic>-<engine>.md` before doing anything else with it. Merge the finding
back into this doc (replace the risk's "unverified" language, keep the fact that it was once
unverified rather than deleting that history) and update this table.
