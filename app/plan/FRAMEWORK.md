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
- [ ] **Verify the Phase 3 SQLite layer on a real Android emulator/device** — this is
      the concrete blocker called out in `PORT_PLAN.md` Phase 3: `db.test.ts` had to be
      deleted because `expo-sqlite` has no real SQL behavior under plain Jest, so this
      has never actually been run against real native code
- [ ] Decide, based on the above, whether the SQLite CRUD design (delete+reinsert
      `saveDiscs()`, exclusive-transaction pattern) holds up under real device I/O

**Gate to Phase 3:** at least one real signal that the SQLite layer works on-device —
**not yet met**. Per an earlier explicit instruction, this is intentionally *not* being
chased proactively phase-by-phase — it's the one deferred item, batched for a dedicated
verification pass rather than done ad hoc.

### Phase 3 — Build

Maps directly onto `PORT_PLAN.md`'s own phases:

- [x] Phase 0 (parity fixtures) + Phase 1 (Expo scaffold, real signed debug APK, no EAS)
- [x] Phase 2 (pure logic ported to TypeScript — `disc.ts`, `legacyPhysics.ts`,
      `scenarios.ts`, `csv.ts` — 48/48 tests passing)
- [x] Phase 3 (SQLite schema/CRUD written, typechecks clean) — **code done, on-device
      behavior not verified (see Phase 2 above)**
- [ ] Phase 4 (Bag screen — first real screen with actual content)
- [ ] Phase 5 (Flight Shape screen)
- [ ] Phase 6 (Disc Suggest screen)
- [ ] Phase 7 (Import/Export)
- [ ] Phase 8 (Android build + full smoke test on a physical device)
- [ ] Phase 9 (VPS Sync, v1.1) — explicitly out of scope until v1 APK is proven; fully
      designed in `RESEARCH.md` §2 but deliberately not started (see `docs/notes.md`)

**Gate to Phase 4 (of this framework):** one working version that does the core thing
end-to-end — i.e. `PORT_PLAN.md` Phase 8's smoke-test checklist passing on a real
device. **Not yet met** — no screen has real content yet.

### Phase 4 — Verify

- [ ] Full `PORT_PLAN.md` §8A smoke-test checklist on a physical device
- [ ] GMS/proprietary-dependency check (`./gradlew app:dependencies | grep -i 'gms\|firebase\|play-services'` returns nothing)
- [ ] Known gaps documented plainly (currently: on-device SQLite verification, no
      physics-sim mode planned for mobile v1 — see `docs/risks.md`)

**Gate to Phase 5:** confident enough in the v1 build to start the distribution track.

### Phase 5 — Formalize

- [ ] Distribution Track D1 (Play Console — internal → closed → open) per `PORT_PLAN.md`
- [ ] Distribution Track D2 (F-Droid self-hosted repo), only after D1 is proven — never
      run D1/D2 in parallel
- [ ] Distribution Track D3 (official F-Droid index), only after D2 is proven
- [ ] Decide what changed vs. the original plan once real device/user contact happens

## Current status (update this line as phases advance)

**Phase 1 (Scoping) just completed via this packet. The real blocker is Phase 2
(Validation): verify the Phase 3 SQLite CRUD layer on a real Android emulator or
device — everything in `PORT_PLAN.md` Phase 4 onward (the first real screen) depends on
that layer actually working, not just typechecking. That's the single highest-leverage
next action.**
