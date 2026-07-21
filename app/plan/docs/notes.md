# Notes

> **Tier:** High-level (working scratchpad) · **Audience:** you only — this is a
> living notes file, not a polished deliverable · **Use when:** ongoing, update as
> real answers replace open questions. Several items here are good deep-research
> handoff candidates — see [`research-handoff.md`](./research-handoff.md).

Working scratchpad for decisions and questions that are still open — not conclusions.
Update this file as answers come in from real tests or research.

## Open technical questions

- Does physics-sim mode (Flight Shaper's optional shotshaper-backed rigid-body
  simulation) ever come to mobile? Currently entirely undecided — not scoped in, not
  explicitly scoped out either. If it ever comes up, it needs its own
  `docs/risks.md`-style legal check (GPLv3 vendoring) before any work starts.
- Sync design for v1.1 — `RESEARCH.md` §2 has real design thinking on this (own-VPS
  sync, opt-in), but it's explicitly deferred and the schema is only *shaped* to allow
  it later, not built yet. Revisit once v1 local-only is actually shipped and used for a
  while — building sync before knowing if v1 local-only is even good enough would be
  working ahead.
- Whether the custom `VerticalSlider.tsx` (Reanimated-based) is worth building as
  planned vs. finding/evaluating an existing RN vertical-slider library first — nobody
  has checked whether one already exists that's good enough, this was just assumed to
  need a custom component.
- The release-only ABI override (`-PreactNativeArchitectures=arm64-v8a,armeabi-v7a`,
  added to `../PORT_PLAN.md` Phase 8/D1 this session) hasn't been proven with a real
  build yet — first real `assembleRelease`/`bundleRelease` run should confirm it
  actually produces a working, correctly-sized APK/AAB before it's trusted for a real
  release.

## Sequencing — a reasonable next stretch of work

1. Boot an AVD, run the deferred Phase 3 SQLite verification (open → create user → save
   3 discs → read back → delete-cascade) for real — this is the single blocking item
   before any further build work, per `FRAMEWORK.md`.
2. `PORT_PLAN.md` Phase 4 (Bag screen) — the first real screen with actual content.
3. Phases 5–7 (Flight Shape, Disc Suggest, Import/Export) in the order `PORT_PLAN.md`
   already lays out — each has its own parity check against the live website.
4. Phase 8 full smoke test on a physical device, then the distribution track (D1 before
   D2, never in parallel).

## Things to explicitly decide before committing further

- Whether to build a lightweight sync mechanism for `PORT_PLAN.md`/`RESEARCH.md`
  changes vs. this packet — right now this packet duplicates a *summary* of decisions
  that live in full in those two files; if they diverge, those two remain authoritative
  for build detail and this packet's `FRAMEWORK.md`/`docs/` should be updated to match,
  not the other way around.
- Whether the "personal use first, public release second" framing in `overview.md`
  should shift priorities — e.g. if Play Store review turns out to need more polish
  than expected, is that worth doing before v1 is even solid for personal daily use?

## Open naming question

App is already named and identified: package id `com.disctracker.app`, matching the
website's branding. No open naming question at this time.
