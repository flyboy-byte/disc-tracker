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

In rough priority order:

1. **The SQLite CRUD layer actually works on a real Android device/emulator.** This is
   the one piece of Phase 3 that's written and typechecks but has never run against real
   native SQL — `expo-sqlite` can't be exercised under plain Jest. Everything past this
   (Phase 4's first real screen onward) depends on it.
2. **The custom vertical-slider approach (Reanimated + `useSharedValue`) actually
   performs acceptably on a real device for Flight Shaper**, since this is the one UI
   piece with no direct RN built-in equivalent (web uses a CSS-rotated horizontal
   `<input type=range>`) — planned but not yet built (Phase 5).
3. **F-Droid's reproducible-build bar is achievable enough to get a human reviewer's
   sign-off**, since no Expo/RN app is known to hit a perfect byte-match — this is a
   real open question flagged for research, not yet tested (see `research-handoff.md`).

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
