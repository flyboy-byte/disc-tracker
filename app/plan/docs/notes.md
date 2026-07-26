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
- ~~Whether the custom `VerticalSlider.tsx` (Reanimated-based) is worth building vs.
  finding an existing library first~~ — **resolved 2026-07-23.** Built and verified
  on-device. A first pass reused the website's own trick (a horizontal native slider
  rotated -90°) and *measurably failed* — nested in a ScrollView, real drags were always
  claimed as page scrolls, because a native Slider's touch-claim doesn't go through
  react-native-gesture-handler's negotiation layer. The Reanimated + `Gesture.Pan()`
  rebuild does, and works. So "just use a library" wouldn't have been safe here anyway —
  the gesture-negotiation requirement is the whole reason a custom component was needed.
- ~~The release-only ABI override (`-PreactNativeArchitectures=arm64-v8a,armeabi-v7a`)
  hasn't been proven with a real build~~ — **resolved 2026-07-23/24.** Real
  `assembleRelease` runs produce an APK containing only `lib/arm64-v8a/` +
  `lib/armeabi-v7a/` (verified by unzipping), and the R8-minified release build was
  smoke-tested on the emulator (via a separate x86_64 release-config build) with no
  minification breakage. Trusted for real releases now.

## Sequencing — a reasonable next stretch of work

1. ~~Boot an AVD, run the deferred Phase 3 SQLite verification~~ — **done 2026-07-23.**
2. ~~Phases 4–7 (Bag, Flight Shape, Disc Suggest, Import/Export)~~ — **all done and
   verified on the emulator, 2026-07-23/24.** Shipped as `mobile-preview-0.4`.
3. ~~`PORT_PLAN.md` Phase 9 (v1 polish & gap-closing)~~ — **done, shipped as `0.5`.**
   Today's-bag finished (toggle/filter/count/clear + export scope), cosmetics fixed, plus
   a new Settings tab and a DB-lock fix.
4. ~~First real-device install~~ — **done 2026-07-24:** `0.5` sideloaded and confirmed on a
   real physical Android phone, drag-reorder and cold-start both verified. Every
   Minimum-Milestone item is met.
5. **Forward work is now the ordered Post-v1 Roadmap (R1–R7) in `../PORT_PLAN.md`** (replan
   2026-07-25): perfect the app (R1 audit → R2 Flight Shaper layout rework → R3 polish) →
   build the two deferred features (R4 Marshall Street images, R5 VPS sync) → then stores
   (R6 Play closed testing incl. production keystore, R7 F-Droid — not dropped, just after
   Play).

## Things to explicitly decide before committing further

- ~~**Today's-bag feature (Phase 9, P1) — decide finish-it vs. hide-it.**~~ **RESOLVED
  (2026-07-24): finished it.** Added the per-card toggle, filter, count, and clear-bag UI
  (matching the website) and wired the CSV "Today's bag" export scope live. Shipped in
  `0.5`. See `../PORT_PLAN.md` Phase 9 P1.
- Whether to build a lightweight sync mechanism for `PORT_PLAN.md`/`RESEARCH.md`
  changes vs. this packet — right now this packet duplicates a *summary* of decisions
  that live in full in those two files; if they diverge, those two remain authoritative
  for build detail and this packet's `FRAMEWORK.md`/`docs/` should be updated to match,
  not the other way around.
- Whether the "personal use first, public release second" framing in `overview.md`
  should shift priorities — e.g. if Play Store review turns out to need more polish
  than expected, is that worth doing before v1 is even solid for personal daily use?
  (The Phase 9 accessibility-labels item is a concrete instance of exactly this tension.)

## Open naming question

App is already named and identified: package id `com.disctracker.app`, matching the
website's branding. No open naming question at this time.
