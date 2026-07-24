# Approach

> **Tier:** High-level (decision input) · **Audience:** decision-maker ·
> **Use when:** deciding go/no-go on the approach, and planning what to validate before
> spending real time. Several open items here are flagged for handoff to external deep
> research — see [`research-handoff.md`](./research-handoff.md).

This is early reasoning — treat every claim as a working hypothesis to test, not a
conclusion, until it's been checked against something real.

## Alternatives considered

- **Do nothing / just use the mobile browser against the website.** Realistic fallback
  — the site is already mobile-responsive. Rejected as the *only* option because it
  requires network connectivity and doesn't give real offline access or a home-screen
  app experience, but this stays the honest zero-cost baseline if the port stalls.
- **Framework: Expo/React Native vs. Flutter vs. native Kotlin.** Expo won on reusing
  the existing JS/TS logic near-verbatim, prior real experience (DragTree), and F-Droid
  viability via local Gradle. Flutter and native Kotlin were rejected mainly because
  they'd mean a full rewrite of already-correct, already-tested logic (physics,
  scenarios, stability math) for no behavioral gain — see `../RESEARCH.md` §1 for the
  full comparison table.
- **Build pipeline: local Gradle vs. EAS.** EAS was considered and explicitly dropped —
  cloud-built binaries don't byte-match F-Droid's own build server output, which blocks
  the official F-Droid index later, and DragTree already proved local `./gradlew`
  stays manageable as long as the codebase stays simple.
- **Data architecture: local-only vs. server-synced vs. server-required.** Considered
  three paths (see `../RESEARCH.md` §2): the Flask server can't serve a phone directly
  without real hardening work; a fully server-required design would make the app
  useless offline and couples it to VPS uptime. Local-first SQLite won, with the schema
  and CRUD shape (bulk delete+reinsert, matching the site's own `/api/data` POST
  contract) deliberately chosen so an opt-in sync layer (v1.1) can be bolted on without
  a rewrite, rather than closing that door for the sake of v1 simplicity.

## What needs to be validated before investing real time

> **All three items below are now resolved** (2026-07-23/24). Kept as a record of what
> the go/no-go actually hinged on, and how each turned out.

1. ~~The SQLite CRUD layer actually works on a real Android device/emulator~~ —
   **confirmed**. Full open → create → save → read → cascade-delete flow verified on an
   emulator; every screen since is built on it. See `FRAMEWORK.md` Phase 2.
2. ~~The custom vertical-slider (Reanimated) performs acceptably on-device~~ —
   **confirmed**, and it turned out to be load-bearing: the cheaper rotated-native-slider
   fallback measurably failed (gesture-negotiation conflict), so the custom component was
   necessary, not optional. See `../PORT_PLAN.md` Phase 5.
3. ~~F-Droid's reproducible-build bar is achievable for this stack~~ — **confirmed
   without needing external research**: the developer's other Expo/RN app (DragTree) got
   a full byte-match merged into F-Droid's index. Concrete playbook in
   `fdroid-reference.md`.

The residual unknowns are no longer about *whether the approach works* — it does — but
about polish and real-hardware confirmation: the Phase 9 gap-closing pass, a physical-
device run, and (later, for D1) the Play Console Data Safety wording still in
`research-handoff.md`.

## Cost side

Mostly developer time, not money — no paid services in the design (no EAS subscription,
no backend hosting beyond the VPS the site already runs on, no push/analytics/ads
vendor). Ongoing cost is keeping two codebases (website + app) logically in sync when
disc data model or scenario logic changes, and normal Android toolchain maintenance
(SDK/NDK version bumps over time). Play Console has a one-time $25 registration fee;
F-Droid self-hosting is free but has real setup-time cost (per `../PORT_PLAN.md`'s own
note that F-Droid took meaningfully longer than Play Console on DragTree).

## Time-to-first-real-signal

The fastest real signal isn't a full v1 — it's finishing the deferred Phase 2/3
validation step: run the existing SQLite code on a real emulator and confirm the basic
open → create user → save discs → read back → cascade-delete flow actually works. That's
a same-session, low-effort test that either confirms the Phase 3 design or surfaces a
real problem before three more screens get built on top of it.

## Bottom line (working hypothesis, not a conclusion)

The architecture and toolchain decisions are well-grounded — they're not first attempts,
they're informed by a second live app (DragTree) that already went through the same
Expo/local-Gradle/F-Droid path successfully. The actual technical risk in this project is
narrow and already identified: whether the SQLite layer behaves correctly under real
native I/O, and whether the custom slider component performs well enough on-device. Both
are cheap to test directly rather than reasoned about further. The biggest *process* risk
isn't technical at all — it's scope creep from working ahead of verification, which
`PORT_PLAN.md`'s explicit "do not work ahead" constraint and this packet's Phase 2 gate
both exist to prevent.
