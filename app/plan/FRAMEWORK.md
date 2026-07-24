# Framework — Disc Tracker Mobile Port

> **Tier:** Meta (self-aware — this doc describes and tracks the project it's part of)
> **Audience:** you · **Use when:** you don't know what to do next, or you're checking
> in on progress after time away.

## What this is

An Expo/React Native port of the live Disc Tracker Flask site, so the bag/Flight Shaper/
Disc Suggest tools work as a local-first Android app (Play Store + eventually F-Droid)
instead of requiring a browser hitting the VPS. The detailed phase-by-phase build plan
already lives in [`../PORT_PLAN.md`](../PORT_PLAN.md) and the architecture/toolchain
research in [`../RESEARCH.md`](../RESEARCH.md) — this packet doesn't replace either; it
sits a level above them as a status tracker and framing layer, since PORT_PLAN.md is
itself already a phase list but doesn't carry the "is this worth doing, what could kill
it" framing this packet adds.

Update the checkboxes below as things actually happen. This file is the honest answer to
"where are we" at any point in the future.

## Phase model

```
Phase 0        Phase 1        Phase 2         Phase 3      Phase 4       Phase 5
Capture   ──►   Scoping  ──►   Validation ──►  Build   ──►  Verify  ──►  Formalize
```

### Phase 0 — Capture

- [x] Source material captured: `PORT_PLAN.md` (618 lines, phases 0–8 + distribution
      track), `RESEARCH.md` (636 lines, framework/toolchain/sync decisions), the live
      `app.py`/templates as the parity spec, `MOBILE_PORT_AUDIT.md`
- [x] Read/understood well enough to extract the real open questions (see
      `docs/notes.md`)

**Gate to Phase 1:** none — automatic once the source material exists. **Done.**

### Phase 1 — Scoping

- [x] `docs/overview.md`
- [x] `docs/approach.md`
- [x] `docs/risks.md`
- [x] `docs/infrastructure.md`
- [x] `docs/notes.md`
- [x] `docs/documentation-guide.md` + `docs/research-handoff.md`

**Gate to Phase 2:** none blocking. **Done** (this session).

### Phase 2 — Validation

- [ ] Run the `docs/research-handoff.md` queue (F-Droid RN reproducible-build reality,
      Play Console Data Safety form for a zero-network app, expo-sqlite API stability)
- [x] **Verify the Phase 3 SQLite layer on a real Android emulator/device** — done
      2026-07-23 on a fresh `verify_test` AVD (API 37, x86_64, 4GB RAM). Built and
      installed a real debug APK, ran `openDatabase` → `getOrCreateDefaultUser` →
      `saveDiscs`(3 discs) → `getDiscs` (order + `in_bag` integrity) → `setMeta`/
      `getMeta` round-trip → `saveDiscs` bulk-replace (delete+reinsert) →
      `deleteUser` cascade (confirms `PRAGMA foreign_keys = ON` actually works) via a
      temporary harness swapped into the Bag tab, screenshotted, then reverted —
      **ALL PASS**, no code changes needed.
- [x] Decide, based on the above, whether the SQLite CRUD design (delete+reinsert
      `saveDiscs()`, exclusive-transaction pattern) holds up under real device I/O —
      **it holds up**, verified end-to-end above.

**Gate to Phase 3:** at least one real signal that the SQLite layer works on-device —
**met** (2026-07-23). The research-handoff queue is still open but isn't build-blocking
(see `docs/research-handoff.md`) — safe to proceed to Phase 4 (Bag screen) in parallel.

### Phase 3 — Build

Maps directly onto `PORT_PLAN.md`'s own phases:

- [x] Phase 0 (parity fixtures) + Phase 1 (Expo scaffold, real signed debug APK, no EAS)
- [x] Phase 2 (pure logic ported to TypeScript — `disc.ts`, `legacyPhysics.ts`,
      `scenarios.ts`, `csv.ts` — 48/48 tests passing)
- [x] Phase 3 (SQLite schema/CRUD written, typechecks clean, on-device CRUD verified
      2026-07-23 — see Phase 2 above)
- [x] Phase 4 (Bag screen — display, add-from-library, edit, delete, sort, search/
      filter, color picker all verified on-device 2026-07-23; drag-reorder built but
      not yet drag-gesture-tested — see `../PORT_PLAN.md` Phase 4 status note)
- [x] Phase 5 (Flight Shape screen — disc picker, 5 sliders, arc + ghost arc, adjusted
      badge/nums, distance bar, arcView selector, angle-ref diagrams, reset, all
      verified on-device 2026-07-23. Physics-sim mode deliberately not ported — server
      dependency, see `../PORT_PLAN.md`)
- [x] Phase 6 (Disc Suggest screen — 12-scenario grid, bag + library matches, verified
      on-device 2026-07-24, see `../PORT_PLAN.md`)
- [x] Phase 7 (Import/Export — CSV share sheet + document picker, verified on-device
      2026-07-24, see `../PORT_PLAN.md`)
- [~] Phase 8 (Android build + smoke test) — build pipeline run for real (4 preview
      APKs, `0.1`–`0.4`); the release APK smoke-tested in its true R8-minified config on
      the emulator; deterministic checklist items all pass (distance fixture, target SDK
      36, GMS-free). **Two items still open, both needing real hardware:** a physical-
      device run, and drag-reorder verified with a real gesture (synthetic adb drag
      wouldn't trigger it).
- [ ] Phase 9 (v1 polish & gap-closing) — surfaced by the 2026-07-24 post-`0.4` audit:
      one feature gap (today's-bag has no UI toggle) + two cosmetics (double title,
      missing tab icons) + minor polish. See `../PORT_PLAN.md` Phase 9. Do before the
      next release.
- [ ] Phase 10 (VPS Sync, v1.1) — explicitly out of scope until v1 APK is proven; fully
      designed in `RESEARCH.md` §2 but deliberately not started (see `docs/notes.md`)

**Gate to Phase 4 (of this framework):** one working version that does the core thing
end-to-end — i.e. `PORT_PLAN.md` Phase 8's smoke-test checklist passing on a real
device. **Nearly met** — all four screens are built and verified on the emulator and the
full v1 feature set shipped as `mobile-preview-0.4`; what's left is a real-device run and
the Phase 9 polish pass, not any missing feature.

### Phase 4 — Verify

- [~] Full `PORT_PLAN.md` §8A smoke-test checklist — all items pass on the emulator
      except the two that require real hardware (physical-device run, drag-reorder
      gesture)
- [x] GMS/proprietary-dependency check (`./gradlew app:dependencies | grep -i 'gms\|firebase\|play-services'` returns nothing) — clean since Phase 1; re-run before D1/D2
- [x] Known gaps documented plainly — the post-`0.4` audit findings are captured as
      `PORT_PLAN.md` Phase 9 (today's-bag UI gap, double title, missing tab icons, minor
      polish), physics-sim deliberately out of scope for mobile v1 (see `docs/risks.md`)

**Gate to Phase 5:** confident enough in the v1 build to start the distribution track —
i.e. Phase 9 polish done + a clean physical-device run.

### Phase 5 — Formalize

- [ ] Distribution Track D1 (Play Console — internal → closed → open) per `PORT_PLAN.md`
- [ ] Distribution Track D2 (F-Droid self-hosted repo), only after D1 is proven — never
      run D1/D2 in parallel
- [ ] Distribution Track D3 (official F-Droid index), only after D2 is proven
- [ ] Decide what changed vs. the original plan once real device/user contact happens

## Current status (update this line as phases advance)

**The Bag screen (Phase 4), Flight Shaper screen (Phase 5), Disc Suggest screen
(Phase 6), and CSV Import/Export (Phase 7) are all built and verified on-device
(2026-07-23/24) — that's the full Minimum Credible v1 Milestone feature set. See
`../PORT_PLAN.md` for the per-feature checklists and real bugs found and fixed along the
way (Bag: a form-remount bug that silently dropped library-prefill; Flight Shaper: a
native-Slider/ScrollView gesture conflict that required rebuilding the vertical slider
on Reanimated + gesture-handler; Flight Shaper again, found by the user in the wild
after `mobile-preview-0.2` shipped: a mount-only `useEffect` meant the bag list never
refreshed after switching tabs — fixed in `mobile-preview-0.3` with `useFocusEffect`;
Disc Suggest applied that lesson from the start with no new bugs; CSV Import: an
unhandled promise rejection when the document picker was invoked while a previous call
hadn't settled — fixed with a re-entry guard and a real `catch`). Phase 8's deterministic
checklist items (Destroyer distance fixture, target SDK check) both passed 2026-07-24.
Drag-reorder is the one item that stayed unverified despite real effort: `adb shell
input swipe` works great for continuous Pan gestures (confirmed on the Flight Shaper
sliders), but two correctly-targeted `adb shell input draganddrop` attempts — the tool
meant for long-press-gated drags — didn't trigger react-native-draggable-flatlist's
reorder at all, no crash, no error. Logged honestly as needing a physical finger rather
than further scripted attempts. Four debug-signed preview APKs
(`mobile-preview-0.1`–`0.4`) are on GitHub Releases for hands-on testing — `0.4` covers
the full v1 feature set (all four screens + CSV) and was smoke-tested in its true
R8-minified release config. No production keystore or Play/F-Droid submission yet. A
post-`0.4` code audit (2026-07-24) then surfaced Phase 9: one real feature gap
(today's-bag has no UI toggle — schema/CRUD/export-scope all assume it, but nothing sets
`inBag`) plus two cosmetics (title renders twice; tab bar has no icons) and minor polish.
Next action: work Phase 9 (`../PORT_PLAN.md`) and cut `mobile-preview-0.5`; drag-reorder
and a physical-device run remain open pending real hardware and are best done at the
first real-device install.**
