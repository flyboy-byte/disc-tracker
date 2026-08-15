# Decisions — Disc Tracker Mobile Port

Index of *why*, kept separate from the *what/when* in `FRAMEWORK.md` and `../PORT_PLAN.md`.
This is a pointer file, not a copy — each decision lives in full in the doc it's already
recorded in; read that doc for the reasoning and tradeoffs, not this list.

| # | Decision | Where |
| --- | --- | --- |
| D-1 | VPS sync (R5) deferred, then dropped — kept researched-and-ready, not killed; later superseded outright by B4 backup/restore | `docs/direction-2026-07-29.md` §"Decision 1", confirmed dropped in `PORT_PLAN.md` |
| D-2 | Big-collection support (B2) scoped to ~200 discs; measure-first performance approach | `docs/direction-2026-07-29.md` §"Decision 2" |
| D-3 | Disc-suggestion engine (B1) rewritten for accuracy — one unified scoring model replaces the two-path bagTest/filterLibrary logic | `docs/direction-2026-07-29.md` §"Decision 3" |
| D-4 | Sync protocol design (locked, later superseded by D-1's drop) | `docs/sync-design.md` §"Decisions (locked 2026-07-25)" |
| D-5 | Sequencing: features + future-proofing + audience planning FIRST; Play/F-Droid store track (R6/R7) stays deliberately parked until Logan's ready | `docs/direction-2026-08-08.md` §"Decision 0" |
| D-6 | The 3-layer flight-data rule — factory data, user-declared adjustment, observed/measured data are never conflated into one field | `docs/direction-2026-08-08.md` §"Decision 1" |
| D-7 | The C-series roadmap (loadouts → suggest → fieldwork → Learn My Bag → throw advisor → overlap/compare → shareable report), in dependency order | `docs/direction-2026-08-08.md` §"Decision 2" |
| D-8 | Future-proofing items to bank early/opportunistically, ahead of the heavy C-series features | `docs/direction-2026-08-08.md` §"Decision 3" |
| D-9 | Signing: Play app signing key = the upload key — one keystore signs Play + F-Droid + sideload | `PORT_PLAN.md` §R6 signing note, proven on DragTree 2026-08-01 |
| D-10 | Disc Suggest Phase 1 fills the "user-declared" slot of D-6 with a personal stability adjustment, plus a Throw Style modifier and the Flex Shot scenario | `docs/suggest-engine-plan.md` |

Add new rows here as decisions get made in future planning docs — don't paste the reasoning
back up into this file, just point at it.
