# Release log — mobile app

Last updated 2026-10-17. Newest first. Moved out of the root `AGENTS.md`/`CLAUDE.md`, where this
narrative had been repeated three or four times over; that file now only carries the current
release. Per-feature detail lives in the scope doc each entry points at.

Release naming moved from `mobile-preview-X` to bare `vX` at `v0.16` (2026-08-15). To cut a
release: build the arm64/armeabi APK (`JAVA_HOME=/usr/lib/jvm/java-21-openjdk`,
`./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a`), then
`gh release create`.

| Release | Date | What shipped | Detail |
| --- | --- | --- | --- |
| `v0.26` | 2026-09-01 | UI/UX audit pass, Tier 1 + Tier 2, all 10 items verified on a physical Pixel 9: shared `SegmentedControl`/`FilterPill`/`Icon` vocabulary replacing five hand-rolled control treatments and most text glyphs; 44dp touch targets; hardware Back mid-round; swipe-to-demote undo; catalog picker as a real radio list; Score tier colour dropped (accessibility + palette); bag actions behind an overflow sheet; Settings flattened from nine cards to a list; one-tap hole strip; Flight Shaper slider labelling. Real bug fix: "Back up everything" was wired to the share sheet, which on Android can't reach Files — now writes straight to a picked folder, sharing demoted to "Send a copy…". | `docs/ui-audit-plan.md` |
| `v0.25` | 2026-08-20 | Disc Suggest swipe hint text + stronger Buy-mode brand-aversion weighting; compact bag-report grid for bags over 12 discs; Score tab 9/18/Custom hole presets, roster prefill, quick-pick score entry, color-coded scores; in-app "How to use Disc Tracker" tutorial linked from Settings; two F-Droid privacy/manifest fixes. Same session stood up D2 (self-hosted F-Droid repo, `~/projects/fdroid-repo`). | `docs/fdroid-privacy-audit-2026-08-20.md` |
| `v0.24` | 2026-08-19 | Same-day follow-up to `v0.23`: full backup was silently dropping `suggest_demotions`/`suggest_learning` — fixed with additive, tolerant `BackupData` fields + `db.ts` bulk export/import, verified on-device with real accumulated data. "Best fit"/"Brand A-Z" sort toggle on Buy mode (hundreds of near-tied "great fit" discs make alphabetical a better browse order). Swipe/learning local-preference data disclosed in `docs/privacy.html` and `README.md`. | `docs/suggest-swipe-scope.md` |
| `v0.23` | 2026-08-19 | Disc Suggest swipe-to-dismiss: Gmail-style side swipe on result cards. Throw mode drops a disc to the bottom of that scenario's list, persisted (`suggest_demotions`). Buy mode adds a learning engine (`suggest_learning`): swipes blend flight numbers into a fast-decaying "avoided" centroid and brand into a slower-decaying aversion map, re-sorting but never re-labeling (band/fit stays true to the real score); on/off toggle degrades Buy to Throw's plain reorder. Verified on a real Pixel 7, including an on-device bug: a vertical scroll starting on a card was captured by the card's swipe — fixed with `activeOffsetX`/`failOffsetY`. | `docs/suggest-swipe-scope.md` |
| `v0.22` | 2026-08-18 | Backup "Save to device" on Android via Storage Access Framework, alongside the share-sheet path. | `docs/catalog-v2-scope.md` |
| `v0.21` | 2026-08-18 | Disc Catalog card reworked into a three-way **Built-in / Try Discs / Custom** source picker (each caches independently, switching between cached sources is instant, nothing deleted) + one-time first-run download prompt; verified end-to-end on a real Pixel 7. Compliance fix: Try Discs credit now keys off the manifest's own `provider` field, not the active UI slot (importing Try Discs' manifest via Custom would otherwise drop the credit) — regression-tested. 2,147-vs-1,874 disclosure copy added to Settings, website, README. | `docs/catalog-v2-scope.md` ("Three-way source picker") |
| `v0.20` | 2026-08-18 | Try Discs catalog-v2 live with real data (`https://disc.flyboybyte.com/catalog/manifest.json`, `catalogVersion=2`, 1,874 of 2,147 discs — the other 273 lack complete flight numbers); C7 Shareable Bag Report; GH Pages fix; nginx rate-limit. | `docs/catalog-v2-scope.md`, `docs/c7-shareable-report-scope.md` |
| `v0.19` | — | Wear estimate (1–5, supersedes the 3-tier New/Seasoned/Beat field, now derived from it); Disc Suggest "buying mode" ranking unowned library discs against the scenario, with bag-gap summary and category/stability/brand filters. | `docs/archive/wear-estimate-scope.md`, `docs/archive/buying-mode-scope.md` |
| `v0.16`–`v0.17` | 2026-08-15/16 | Suggest-engine Phases 1–3, all verified on-device: Flex Shot (13th scenario), Throw Style (backhand/forehand) modifier, per-disc personal stability adjustment (Phase 1, `f9925fb`); data audit (Phase 2, `6bb2651`); personal role tags (Phase 3, `468d79b`). Website-parity track (`91883c3`): CSV "Both" scope, `stability_adj`/`role_tag` on the website, website backup import. | `docs/suggest-engine-plan.md`, `docs/archive/website-parity-scope.md` |
| `0.15` | — | Production signing — upload key = Play app signing key; one keystore signs Play + F-Droid + sideload. | — |
| `0.14` | — | UI "modern feel" polish pass + F-Droid-reproducible dependency tree. | — |
| `0.13` | — | Tap-outside-to-close modals + interactive RGB color picker. | — |
| `0.12` | — | B3 offline scorekeeper (Score tab) + B4 full backup/restore. | `docs/archive/scorekeeper-scope.md` |
| `0.11` | — | B2 big-collection support: Today's Bag / Collection split, 30/page pagination, memoized cards, incremental single-row writes, ⤒/↑/↓ reorder arrows replacing drag-reorder. | — |
| `0.10` | — | B1 Disc Suggest rewrite: bag + full library ranked by one unified scoring model (`src/utils/suggestScore.ts`) against each scenario's ideal profile + skill preset. | `docs/suggest-model.md` |
| `mobile-preview-0.5` | 2026-07-24 | Phase 9 v1 polish; Minimum Credible v1 met, confirmed on a real physical phone. | `../PORT_PLAN.md` Phase 9 |

R4.5 (on-device physics sim, TypeScript port of shotshaper) landed 2026-07-29.
