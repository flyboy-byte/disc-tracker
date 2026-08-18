# Catalog-v2 — optional downloaded disc catalog — scope

**Status (2026-08-18): LIVE AND FULLY VERIFIED, END TO END, ON A REAL DEVICE.** `app.py`'s
`/catalog/*` routes deployed via `deploy.sh`; real data published via
`tools/trydiscs-sync.js publish` (`catalogVersion=2`, 1,874 discs, `datasetVersion=2026-08-14`).
Verified from outside (`curl` + SHA-256 match) **and** on a real Pixel 7: Settings → "Check for
updates" downloaded and activated the real catalog (source flipped to "Downloaded — 1874 discs"),
the "Disc data by Try Discs" credit appeared, and it survived a full force-stop + relaunch.
`discs_master.json` (both bundled copies) is still unchanged — that's correct and permanent, it's
the FOSS fallback, not something this replaces. **Nothing left to verify on this workstream.**

One deploy-time fix worth knowing about: `tools/trydiscs-sync.js`'s original `publish` pointed
`scp` at the public HTTPS domain (`disc.flyboybyte.com`) with no SSH user — wrong on both counts
(no separate `known_hosts` trust for that hostname, and no user defaults to `ubuntu`). Fixed to
reuse the same `ubuntu@51.81.80.126` deploy.sh already trusts — the public HTTPS domain is
unrelated to this and still what the app itself talks to.

## Azeem's reply (2026-08-17) — the actual terms, verbatim guardrails

- Key + sync tool stay private. ✅ already true, unchanged.
- Generated catalog never lands in GitHub. ✅ lives in `data/catalog/` on the VPS only —
  gitignored, populated via `scp`, never `git`.
- App-internal use (search/lookup/suggest/import/audit/bag-analysis) is fine — already all it's
  used for, nothing new needed.
- Publicly fetchable by the app is fine; **not** promoted as a standalone dataset, **not** a
  separate public search API. The two Flask routes added (`/catalog/manifest.json`,
  `/catalog/<asset>`) are fixed-name file fetches only — no query params, no search, no listing.
- Linked "Disc data by Try Discs" credit in Android, website, and README. Done in Android
  (Settings → Credits, shown only once a user has actually downloaded the catalog) and README
  (inline, near the library description). **Not done on the website** — it has no
  catalog-download mechanism yet, so crediting a source with zero data flowing through it would
  be false attribution. Revisit once/if the website side is built.
- `provider`/`dataset_version` in the manifest — already there from Phase 2, unchanged.
- Before F-Droid/store submission: send him the final format/attribution/update flow. Store
  submission is separately, deliberately parked project-wide — this is a future checklist item,
  not a current blocker.

## Resume checklist — read this first, don't re-derive

1. **Is there a reply from Azeem yet?** If not, nothing here is actionable beyond more
   client-side polish — don't build real hosting, don't publish a manifest URL, don't commit
   any TryDiscs data. Jump to "How to pivot once Azeem replies" below only once there's an
   actual answer to react to.
2. **The key** (`TRYDISCS_API_KEY`) is a maintainer-only shell env var. It is not, and must
   never be, in any committed file, the app, or the website. It's currently only ever been
   typed into this session's shell (`export TRYDISCS_API_KEY=...`) — grep the repo for
   `td_live` before ever committing anything catalog-related, as a standing habit, not because
   there's reason to suspect a leak.
3. **Everything already built is decision-independent** — it works identically no matter which
   packaging answer comes back (see the pivot table below). Re-read this whole doc before
   touching `app/src/catalog/`; don't re-derive the design from scratch or start a competing
   pattern.
4. **Where things are:** reconciliation tooling + `generate` = `tools/trydiscs-sync.js` (run
   `fetch` → `reconcile` → `generate`, in that order, after `export TRYDISCS_API_KEY=...`).
   Client plumbing = `app/src/catalog/` (`types.ts`, `catalogLoader.ts`, `catalogSync.ts` + two
   `.test.ts` files, 18 tests, all mocking `expo-file-system`/`expo-crypto` via
   `__testutils__/mockFileSystem.ts` — real modules can't load under plain-node Jest). Settings
   UI = the "DISC CATALOG" card in `app/(tabs)/settings.tsx` (`CATALOG_MANIFEST_URL` constant
   near the top of that file — this is the ONE line that flips the feature from inert to live).

## What this is

Azeem, founder of Try Discs, granted Disc Tracker access to his 2,147-disc catalog API
(`api.trydiscs.com`) — see Phase 1 (`tools/trydiscs-sync.js` `fetch`/`reconcile`, already built
and committed): 1,642 exact matches against our existing 1,660-disc library, 503 new molds, only
27 discs with minor flight-number drift. A real, clean upgrade over `discs_master.json`'s
undocumented provenance (`risks.md`).

Azeem asked for two things before any of it ships: don't publish the catalog as a standalone
download, and **coordinate with him on packaging before anything's committed to the (public)
repo**. Logan sent him a specific counter-proposal: keep the current open `discs_master.json`
bundled as a permanent FOSS fallback (so forks/F-Droid stay buildable from public source alone,
and the key never ships), and make a TryDiscs-enhanced catalog an **optional runtime download**
instead of a build-time/repo asset. Waiting on his reply.

This doc covers what got built anyway: the client-side plumbing that behaves identically no
matter which hosting answer comes back — a manifest-check/download/verify/atomic-swap loader is
the same code whether the file eventually comes from a VPS route, object storage, or a GitHub
release asset.

## Non-goals (the guardrails)

- **No real hosting, no real manifest URL, no real TryDiscs data shipped anywhere** — the
  `CATALOG_MANIFEST_URL` in Settings is deliberately `''` (feature inert) until hosting is
  decided with Azeem.
- **No changes to `static/discs_master.json` or `app/assets/discs_master.json`** — the bundled
  fallback stays exactly as-is; it's what every fresh install uses until a user explicitly opts
  into a download.
- **No background/automatic fetching.** Checking for a catalog update is an explicit Settings
  button tap, same posture as the Marshall Street reference-image toggle — matches this
  project's F-Droid privacy bar (opt-in, off by default, no surprise network calls).
- **No SQLite data-pack format.** Evaluated and deferred — no existing multi-database/ATTACH
  precedent in this codebase (single `disc_tracker.db`, `serialize()`-wrapped after a real
  locking bug); a JSON pack keeps the loader swap the only new thing, not a new storage engine
  too. Revisit only if the catalog needs genuine relational structure a flat array can't
  express.
- **No website changes.** `/api/catalog` mirroring `/api/master`'s cache pattern is trivial per
  the audit, but there's no real URL to point it at yet — not built.
- **No attribution UI** ("Disc data by Try Discs") — premature while no real TryDiscs data
  ships.

## Data model

- `app/src/catalog/types.ts` — `CatalogManifest { catalogVersion, provider, datasetVersion,
  schemaVersion, recordCount, size, sha256, asset }` + `isValidManifest()`.
- `user_meta` (`app/src/db/migrations.ts`, `db.ts`): `catalog_version INTEGER DEFAULT NULL`,
  `catalog_dataset_version TEXT DEFAULT NULL`, `catalog_hash TEXT DEFAULT NULL` — all NULL until
  a download activates successfully. Same 4-touch-point pattern as every other `user_meta`
  field (`UserMeta` interface, one `COLUMN_MIGRATIONS` entry, `readMeta`, `setMeta`).
- On-disk: `Paths.document/catalog/active.json` (the currently-active downloaded catalog, if
  any) and `active-previous.json` (rollback point). First use of persistent app-private storage
  in this codebase — every prior `expo-file-system` use was one-shot export/import via
  `Paths.cache`.

## Client architecture (`app/src/catalog/`)

- `catalogLoader.ts` — `getCatalog()` (sync getter, defaults to the bundled `masterDiscs`),
  `initCatalog()` (checks for a valid downloaded catalog at boot, swaps in if valid, **never
  throws** — any problem leaves the bundled fallback active), `searchCatalog()` /
  `searchLibraryCatalog()` (same ranking logic as `masterLibrary.ts`'s `searchMaster`/
  `searchLibrary`, now parameterized over whichever catalog is active via the new
  `searchIn`/`searchLibraryIn` exports on that file).
- `catalogSync.ts` — `checkManifest()`, `downloadAndVerify()` (hash + schema validated before
  anything touches disk as a candidate), `activateCatalog()` (atomic-ish rename, keeps the prior
  active catalog as a rollback point), `rollbackCatalog()`, `syncCatalog()` (the full pipeline).
  Uses `expo-crypto` (new dependency, added via `expo install` the same way `0.14`'s
  F-Droid-reproducible dependency pass added things — deliberately, pinned, not silent) for
  SHA-256 verification.
- Wired in: `app/_layout.tsx` calls `initCatalog()` once at root mount (non-blocking — the
  bundled fallback is already synchronously active). `disc-suggest.tsx`'s library-disc list is
  now recomputed from `getCatalog()` on every screen focus (was a frozen module-level constant)
  so a catalog swap is reflected without an app restart. `DiscLibraryModal.tsx` /
  `DiscFormModal.tsx`'s add-disc search now goes through `searchLibraryCatalog()`.

## Screens

Settings → new "DISC CATALOG" card (between Data and About): shows current source ("Bundled" vs
"Downloaded" + disc count) and a "Check for updates" button. With `CATALOG_MANIFEST_URL` unset,
the button is visibly inert ("Not available yet") rather than hidden — the feature exists in the
UI so it's easy to wire up later, without pretending it does anything yet.

## Maintainer-side tooling

`tools/trydiscs-sync.js` gained a third subcommand, `generate` — takes the already-fetched,
already-reconciled TryDiscs pull (`fetch`/`reconcile`, Phase 1) and produces a normalized
`catalog-vN.json` + `manifest.json` (real `sha256`/`recordCount`/`datasetVersion`) in the same
gitignored `tools/.trydiscs-cache/` directory. Run 2026-08-17: **1,874 discs** (2,147 minus 273
with no published flight numbers), `catalogVersion=1`. This lets the entire pipeline be dry-run
locally end to end without deciding hosting or touching the repo — generate, serve the cache
directory locally, point Settings' manual check at that local URL, confirm activation.

**`check` subcommand (added 2026-08-17)** — a cheap, single-page API call that just compares the
live `dataset_version` against what's cached locally and prints a verdict. No cache writes, no
full fetch. This is the thing to actually run periodically, since there's deliberately no
automation here (no cron, no CI — matches this project's no-unattended-jobs posture; keeping the
catalog fresh is a manual, maintainer-run habit, not a background job).

**The runbook, when `check` finds something new:**
1. `check` — confirms there's actually a new `dataset_version` before doing anything heavier.
2. `fetch` — pulls the full new catalog into the local cache.
3. `reconcile` — **read the report before going further.** Sanity-check the new-disc count looks
   reasonable and there's no mass flight-number drift versus last time. This step exists
   specifically to catch a bad pull before it goes live to real users — never skip straight from
   `fetch`/`check` to `publish`.
4. `generate` — builds the new `catalog-vN.json` + `manifest.json` (version auto-increments off
   the last locally-generated manifest — the local cache, not the VPS, is the source of truth for
   what's already been generated).
5. `publish` — ships it to the VPS for real.

## Verification done this session

- `tsc --noEmit` clean, full Jest suite green: **141/141** (was 115 baseline + Phase 1/2/3 tests
  + 18 new `catalogLoader.test.ts`/`catalogSync.test.ts` cases).
- `catalogLoader.test.ts`: bundled fallback is the default and is byte-identical to today's
  `masterDiscs` with no downloaded file present (critical no-regression check); a valid
  downloaded catalog swaps in; malformed JSON and schema-invalid arrays are both rejected,
  leaving the bundled fallback active.
- `catalogSync.test.ts`: happy-path manifest check → download → hash+schema verify → activate;
  hash mismatch and malformed/schema-invalid downloads are rejected and leave the existing
  active catalog completely untouched; activation keeps a rollback copy and `rollbackCatalog()`
  correctly restores it; a full-pipeline hash-mismatch test confirms nothing gets corrupted
  end to end.
- `node tools/trydiscs-sync.js generate` run against the real (locally-cached) TryDiscs pull —
  produced a valid 1,874-disc pack + manifest, output confirmed still gitignored (`git status`
  clean of anything under `tools/.trydiscs-cache/`).

## How to pivot once Azeem replies — RESOLVED 2026-08-17, kept for the record

**He picked Option C.** The section below is kept as-written (historical record of the decision
space) rather than deleted — A/B/D are moot now, C is what got built (see "Azeem's reply" above
and the "Real hosting" section below for what that actually became).

The proposal Logan sent him laid out four shapes (A/B/C/D, mirroring the ChatGPT handoff's own
framing). None of them require re-architecting anything already built — they only change what
gets hosted where, and what `CATALOG_MANIFEST_URL` points at. Work through whichever answer
comes back like this:

**A — Commit a generated snapshot to the repo as a versioned app asset** (same pattern as
today's `discs_master.json`, refreshed periodically). *If he picks this:* the runtime-download
machinery in `app/src/catalog/` becomes unnecessary for the *default* experience — instead,
`tools/trydiscs-sync.js generate`'s output gets copied into `app/assets/` (a new bundled file,
or replacing `discs_master.json` directly) and `masterLibrary.ts`'s `require()` points at it.
The `catalogSync.ts`/manifest/download-and-verify code doesn't have to be thrown away — it's
still useful as the *update* mechanism between app releases if he's fine with periodic snapshot
commits — but the bundled-fallback-is-always-safe default no longer needs it to get real data
day one. Update this doc's status, `discs_master.json`'s provenance gap in `risks.md`, and
`RESEARCH.md` §11.5 to close the loop.

**B — Generate only at release-prep time** (not a standing file in the source tree between
releases). *If he picks this:* same as A for the *shipped* result (a bundled asset in that
release's build), but `tools/trydiscs-sync.js generate`'s output gets pulled into the Android
build step (`android/app/build.gradle` or a pre-build script) rather than living in git at all
day-to-day — the release-cutting instructions in root `CLAUDE.md` (`gh release create` section)
would need a new step. `app/src/catalog/` again becomes optional/update-mechanism-only, not the
critical path for a fresh install.

**C — Keep it out of the public repo entirely** (runtime-downloaded, private hosting). *This is
what all the built scaffolding is actually FOR.* Concretely: stand up hosting (simplest per the
audit — a Flask route in `app.py` mirroring `_master_cache`'s pattern, since there's no nginx in
this repo to extend, OR object storage/R2 if Logan wants to go straight there), publish a real
`manifest.json` + `catalog-vN.json` there (generated the same way, via `tools/trydiscs-sync.js
generate`, just uploaded instead of left in the gitignored cache), and change exactly one line:
`CATALOG_MANIFEST_URL` in `app/(tabs)/settings.tsx`. Everything else — loader, sync, atomic
swap, tests, Settings UI — is already correct and already tested. This is the fastest path from
"answer received" to "shipped" of the four options.

**D — Something else Azeem proposes.** Re-read his actual wording against the pivot options
above before assuming it's a variant of one of them — his own coordination ask was specifically
so he could raise a structure Logan/this doc hasn't considered. Don't force-fit it.

Whichever answer lands, the same follow-up housekeeping applies: update this doc's Status line,
add the "Disc data by Try Discs" attribution (Settings About + `README.md`), and — only once
real data is actually flowing — build the website's `/api/catalog` mirror of `/api/master` (see
"What the audit found," point 4 above — it's a small, well-scoped addition, deliberately not
built ahead of having something real to point it at).

## Real hosting (Phase 3, built 2026-08-17, DEPLOYED 2026-08-18)

- `app.py` gained `/catalog/manifest.json` + `/catalog/<asset>` — public, unauthenticated,
  `send_from_directory`-served from a new gitignored `data/catalog/` directory (sibling of the
  existing SQLite DB / secret-key dir). Verified locally, then verified live: correct serving,
  clean 404 on missing files/before publish, path traversal blocked. **Deployed to the VPS via
  `deploy.sh` 2026-08-18.**
- `tools/trydiscs-sync.js publish` — new subcommand, `scp`s the `generate`d manifest + data pack
  to the VPS. Deliberately separate from `deploy.sh` (code goes through git; this is private data
  that must never touch git). **Run for real 2026-08-18** — `catalogVersion=2`, 1,874 discs. One
  bug found running it for real: `PUBLISH_HOST` was the public HTTPS domain with no SSH user
  (wrong `known_hosts` entry, no default user) — fixed to reuse `ubuntu@51.81.80.126`, the same
  host `deploy.sh` already trusts.
- `CATALOG_MANIFEST_URL` in `app/(tabs)/settings.tsx` points at
  `https://disc.flyboybyte.com/catalog/manifest.json` — **confirmed live and correct**,
  `curl`-verified to return real JSON with a SHA-256 matching the served asset byte-for-byte.
- Attribution: Android Settings → Credits shows a linked "Disc data by Try Discs" row, gated on
  `getCatalogSource() === 'downloaded'`. README has an inline linked mention. **Website: confirmed
  deferred (Logan, 2026-08-18)** — no data flows through the website yet, and it currently has
  *no* credits/attribution UI at all (checked: not even for shotshaper, which it does use live).
  Add a website credit once/if the website actually integrates the catalog, not before —
  literal compliance with Azeem's "Android app, web app, and README" wording is a known,
  deliberate gap until then, not an oversight.
- **Security review complete, 2026-08-17 — clear to deploy.** A separate Claude session with
  direct VPS access reviewed `docs/vps-catalog-hosting-proposal.md` against the box's real
  config. Findings:
  - **Routes as written are correct, no changes needed.** `send_from_directory` was confirmed the
    right call over nginx-static (nginx runs as `www-data`, `/home/ubuntu/` is mode 750
    `ubuntu:ubuntu` — `www-data` can't traverse in without a permissions change not worth making
    for one occasionally-fetched file). Traversal confirmed blocked, `data/disc_tracker.db` and
    `.secret_key` confirmed unreachable through the new routes. No nginx config changes required
    for the Flask side to work as written.
  - **One real, non-blocking finding:** `disc.flyboybyte.com`'s nginx vhost has **no
    `limit_req` zone at all** — a pre-existing gap, not introduced by this change, but the new
    `/catalog/` routes are the *first* unauthenticated surface on this app (every other route
    requires a login), making it the most exposed thing on the vhost. Recommended addition
    (VPS-side nginx config, not this repo):
    ```nginx
    limit_req_zone $binary_remote_addr zone=disc_catalog:10m rate=10r/s;
    # in the disc.flyboybyte.com server{} block:
    location /catalog/ {
        limit_req zone=disc_catalog burst=20 nodelay;
        proxy_pass http://127.0.0.1:5757;
    }
    ```
  - Reviewer's call: "add it, but not blocking." Deploy can proceed either way; adding it
    alongside is the recommended order, not a hard prerequisite.
  - **Not this repo's job to apply** — it's a VPS/nginx change, done directly on the box (by
    Logan or a VPS-side session), not through `deploy.sh`.

## Catalog-data cleanup audit (2026-08-17, before committing)

A deliberate check, before anything from this workstream got committed, that no Try Discs data
or the API key ever ended up somewhere it shouldn't — Azeem's "never in GitHub" term, verified,
not assumed:

- **`tools/.trydiscs-cache/`** exists on disk (real fetched/generated data — `catalog.json`
  ~997KB/2,147 real records, `catalog-v1.json`, `manifest.json`, the reconciliation reports) but
  is confirmed **not tracked** by git (`git ls-files tools/.trydiscs-cache/` → empty) and
  confirmed covered by `.gitignore` (`git check-ignore -v` confirms the match). This is real Try
  Discs data sitting on Logan's local machine, outside git, by design — that's expected and fine,
  not a leak.
- **`data/catalog/`** — the directory used for local Flask-route testing earlier this session —
  was deleted after that test (`rm -rf data/catalog`) and confirmed gone; `data/` now contains
  only the pre-existing `disc_tracker.db` and `.secret_key`, both expected, both already
  gitignored.
- **Full-repo grep for the API key pattern** (`td_live`) — the only hit is
  `catalog-v2-scope.md`'s own mention of the *prefix string* as a "grep for this before
  committing" instruction, not the key itself. No file anywhere contains the real key.
- **Full-repo grep for raw Try Discs record shape** (`discontinued`, `bead`, `dataset_version` as
  literal JSON keys — fields unique to their API response, not our normalized schema) — zero
  hits outside the gitignored cache directory. No example/test data anywhere accidentally used
  real-shaped Try Discs content; the test fixtures in `catalogSync.test.ts`/`catalogLoader.test.ts`
  use obviously-fake discs (`"Test Mold"`/`"Test Mfr"`).

**Conclusion: clean.** Nothing from Try Discs' catalog, and no credential, is anywhere in a
tracked file or about to be committed.

## RESOLVED — GitHub Pages privacy policy link

Was stuck (diagnosed 2026-08-17: `gh api repos/flyboy-byte/disc-tracker/pages` showed
`status: "building"` for hours, latest build's `created_at`/`updated_at` identical with
`duration: 0` — never actually started). **Fixed itself** when `d633fc2` (the catalog-v2 commit)
pushed a new file under `docs/` (`docs/vps-catalog-hosting-proposal.md`), which re-triggered a
fresh Pages build — exactly the "cheapest fix, try first" predicted here. Confirmed:
`gh api repos/flyboy-byte/disc-tracker/pages` now shows `status: "built"`, and
`curl -I https://flyboy-byte.github.io/disc-tracker/privacy.html` returns `200`. No further
action needed.

## Not yet done

- ~~Deploying to the live VPS, running `publish` for real~~ — **DONE 2026-08-18.** Server side
  fully verified from outside (`curl`, SHA-256 match).
- The optional nginx `limit_req_zone` addition (see "Real hosting" review write-up above) — still
  not applied. Non-blocking, was never required.
- ~~On-device "Check for updates" pass~~ — **DONE 2026-08-18, verified on a real Pixel 7.**
  Downloaded, activated (source flipped to "Downloaded — 1874 discs"), the "Disc data by Try
  Discs" credit appeared in Settings → Credits, and it persisted correctly across a full
  force-stop + relaunch. **The entire catalog-v2 pipeline is now confirmed working end to end,
  on a real device, with real data.**
- Website `/catalog` consumer + website credit — noted, not built.
- The pre-store-submission check-in with Azeem — gated on R6/R7 actually starting.
