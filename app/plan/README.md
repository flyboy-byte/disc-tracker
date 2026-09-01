# Disc Tracker Mobile Port — Plan Packet

**Start at [`FRAMEWORK.md`](./FRAMEWORK.md)** — it tracks what phase this project is
actually in and what has to happen next. This README is the doc index.

## About this project

A local-first Android app (Expo/React Native) that ports the Disc Tracker website's bag
tracker, Flight Shaper, and Disc Suggest tools so they work fully offline on a phone, backed by
on-device SQLite instead of the Flask VPS. Primarily the developer's own daily use, with a
secondary goal of shipping clean enough to publish (Play Store, then F-Droid — the codebase is
FOSS, GPLv3). Single-user per device, no accounts, no cloud, no ads, no analytics.

Explicitly **not**: a cloud-synced multi-device app in v1 (local-only by design — the schema is
shaped to allow an opt-in sync layer later without a rewrite, but nothing forces that path), an
iOS app yet (Android-first; iOS stays possible on the same codebase, deferred behind Android +
F-Droid), or a monetized product.

Why this architecture, briefly: **port, don't redesign, at first** (byte-for-byte parity fixtures
against the live website drove v1, so the physics/scenario math started as a faithful reuse
rather than a rewrite); **local SQLite, not calling the Flask server from a
phone** (the VPS isn't hardened as a multi-client backend); **Expo + local Gradle, not EAS or a
native rewrite** (reuses the developer's other live Expo/F-Droid app, DragTree, and keeps the
JS/TS logic near-verbatim instead of rewriting physics/scenario math in another language).

**As of 2026-08-31, the app is the canonical build** — it has grown past the website (Score tab,
Disc Suggest's learning engine, full backup/restore, the larger Try Discs catalog) and is where
new behavior gets designed first; the website is a secondary surface, no longer required to
mirror it feature-for-feature. See `CLAUDE.md`'s "What this project is" for the current framing;
this section is kept as the port's origin story, not a live rule.

v1 shipped and is confirmed working on a real physical device (2026-07-24, `mobile-preview-0.5`)
— the concrete bar was the "Minimum Credible v1 Milestone" in `../PORT_PLAN.md`, now long since
cleared. All forward work is tracked in `../PORT_PLAN.md`'s Post-v1 Roadmap and
`FRAMEWORK.md`'s status block, not in this section — this is background, not current status.

## Contents

Live docs — read these:

| Doc | Purpose |
| --- | --- |
| [`FRAMEWORK.md`](./FRAMEWORK.md) | Phase-gated status tracker — where this project actually is and what's next |
| [`DECISIONS.md`](./DECISIONS.md) | Numbered index of *why*, pointing into the docs where each decision was actually made |
| [`GRAVEYARD.md`](./GRAVEYARD.md) | Ideas floated, scoped a little, then parked or killed — with the reasoning, so they don't get re-litigated |
| [`docs/direction-2026-08-08.md`](./docs/direction-2026-08-08.md) | Current strategic direction — the C-series "personal disc intelligence" roadmap, the 3-layer flight-data rule |
| [`docs/catalog-v2-scope.md`](./docs/catalog-v2-scope.md) | TryDiscs catalog integration — code-complete, security-reviewed, deploy pending |
| [`docs/c7-shareable-report-scope.md`](./docs/c7-shareable-report-scope.md) | Shareable Bag Report (C7) — scoped, not yet built |
| [`docs/suggest-engine-plan.md`](./docs/suggest-engine-plan.md) | Live umbrella status doc for the Disc Suggest scoring engine's phased work |
| [`docs/suggest-model.md`](./docs/suggest-model.md) | Source-of-truth scoring numbers/tolerances — keep in lockstep with `suggestScore.ts` |
| [`docs/risks.md`](./docs/risks.md) | Scope, dependency, legal, technical, and operational risks — includes the external-research queue |
| [`docs/infrastructure.md`](./docs/infrastructure.md) | Tools, stack, constraints, known gotchas |
| [`docs/fdroid-reference.md`](./docs/fdroid-reference.md) | F-Droid submission playbook, distilled from the DragTree app's real submission — reference for D2/D3 |
| [`../PORT_PLAN.md`](../PORT_PLAN.md) | The actual phased build plan, parity fixtures, release history |
| [`../RESEARCH.md`](../RESEARCH.md) | Framework/toolchain decisions, sync design history, F-Droid notes |

[`docs/archive/`](./docs/archive/) — done/historical scope docs, kept for the record (each
still linked from `DECISIONS.md`, `GRAVEYARD.md`, or `suggest-engine-plan.md` wherever its
reasoning is still load-bearing). Their outcomes are already recorded in the live docs above;
open one only if you need the original design detail behind a shipped feature.

[`research/`](./research/) — intake folder for raw output from external deep-research sessions
(see `risks.md`'s "External research queue").

## Consolidation note (2026-08-17)

This packet used to be 23 files; several were fully-resolved v1-era snapshots
(`overview.md`, `approach.md`) whose durable content is now the "About this project" section
above, and a stale doc-tiering scheme (`documentation-guide.md`) and dead scratchpad
(`notes.md`) that had been fully superseded by `direction-*.md`/`GRAVEYARD.md` were removed
outright — nothing in them was still true and un-said elsewhere. `research-handoff.md` was
folded into `risks.md` as a section, since it was really just a queue table, not a standalone
doc. Ten fully-shipped/superseded feature-scope docs moved to `docs/archive/`. See git history
on this file for the reasoning if any of that needs revisiting.
