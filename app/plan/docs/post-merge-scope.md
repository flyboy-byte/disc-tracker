# Post-merge work: scope (2026-11-26)

Status: **scoped, nothing started.** Why each item exists: `post-merge-assessment-2026-11-26.md`.
Line numbers are as of `778b022`; re-check before editing. Baseline: `npx jest` 423/423 in 15 suites (2026-11-26).

| Phase | What | Gate to start | Needs Logan |
| --- | --- | --- | --- |
| 0 | Watch the first official build | none | no |
| 1 | `v0.29.0` "first user" | Logan says go | phone test; OK before the tag |
| 2 | Cleanup (outward or destructive) | each item separately | yes, every item |
| 3 | `v0.30.0` font scaling | Phase 1 shipped | phone |
| 4 | Toolbox `fdroid` skill | build log for 291/292 exists | OK to push (public repo) |

## Phase 0: first official build

- `curl -sL https://monitor.f-droid.org/builds/log/com.disctracker.app/291` (and `292`); HTML, 404 = not built.
- Listing: `https://f-droid.org/api/v1/packages/com.disctracker.app`.
- Success: look for "compared built binary to supplied reference binary successfully".
- Toolchain/foojay failure: new MR from fresh `upstream/master` adding
  `- sed -i -e '/foojay/d' node_modules/@react-native/gradle-plugin/settings.gradle.kts` before `npx expo prebuild`
  in both blocks (precedent `e3d332b139`). Do this before any Phase 1 tag, because the bot copies the latest blocks.
- Any other failure: read the log, change one thing.
- GitLab token returned 401 on 2026-11-26; `glab auth login` (Logan) before any MR work.

## Phase 1: v0.29.0 (versionCodes 301, 302)

No scoring, physics, permission, network or schema changes. No dependency bumps.

### 1.1 First-run prompt (`app/app/_layout.tsx:16-60`)
- Title: `No disc list yet`
- Body: `Disc Tracker doesn't come with a disc list. Download the Try Discs catalog to autofill flight numbers and
  get library suggestions? It's a one-time download. You can change this in Settings → Disc catalog.`
- Keep: buttons, shown once, `getCatalogSource() !== 'bundled'` guard, opt-in only. No disc counts in the text.
- Download failure is silent today (`catch`, line ~45). Add an `Alert`: `Download failed` /
  `You can try again in Settings → Disc catalog.` (`Alert`, not toast: the effect sits outside `ToastProvider`.)
- Fix stale "bundled" comments: `_layout.tsx:16-18,47`, `(tabs)/index.tsx:120`, `catalogLoader.ts:1-9`,
  `disc-suggest.tsx:57`, `DiscLibraryModal.tsx:2,122`. Keep the `'bundled'` identifier (stored in prefs and testIDs).

### 1.2 Empty states (text only)
Shared line: `No catalog loaded. Download one in Settings → Disc catalog.`
- Disc Suggest, Throw: "All options" section in `(tabs)/disc-suggest.tsx` (~line 585) when `libraryDiscs.length === 0`.
- Disc Suggest, Buy: replace "No library discs match these filters…" (~line 511) in that case; hide the gap banner
  and filters if they read as nonsense on a phone.
- `DiscLibraryModal.tsx:77`: when `getCatalog()` is empty and the search has no hit, show the shared line instead of
  "No discs found". Custom discs must still search.
- Add-disc autofill: no change.

### 1.3 F5: Delete all discs
`(tabs)/settings.tsx` ~lines 547-557: move the row out of "Data" into its own last section, after Credits. Same
confirm dialog.

### Not in 1.x unless asked
B4 (Bag multiselect): exits are Cancel and a scope change; no hardware Back handler. Cheapest fix: Android Back
calls `exitDiscSelection` (`(tabs)/index.tsx:396`).

### Release (full runbook: `fdroid-submission.md`, "Releasing after the merge")
1. One commit per item; `npm run typecheck`, `npx jest`, CI green.
2. Version `0.29.0`, `versionCode 30` (`app.json`, `package.json`, `android/app/build.gradle`); changelogs `301.txt`,
   `302.txt`. Push to main. No tag.
3. Fork branch from fresh `upstream/master` in `~/projects/drag-tree/fdroiddata` (shared clone: `git checkout` in the
   same command as any edit). `checkupdates` failing in Run 1 is expected.
4. Sign Run 1 APKs with `skills/fdroid/scripts/sign-reference.sh`; cert must be `ff739cf5…837a`.
5. **Phone test on the signed arm64 APK, before the release exists.** (A local Gradle build has versionCode 30,
   below the installed 292, so it can't install over it. Take a backup first.)
   - Update install keeps data. Fresh install (or cleared data, after backup): prompt text, decline, empty states,
     accept, autofill and suggestions work; airplane-mode accept shows the failure alert.
   - Backup, restore, CSV export and import, share bag report, Score round, Flight Shaper sim. This also covers the
     never-tested R8 build.
6. Logan OKs, then `gh release create v0.29.0 --target <sha>` with both APKs. Run 2, then watch the bot commit,
   build log 301/302 and the listing. Done = listed on f-droid.org.

## Phase 2: cleanup

### 2.1 Azeem (Logan sends; owed since the submission)
> Hi Azeem, you asked me to check in before store submission, and I'm late: Disc Tracker was merged into F-Droid on
> 25 November. How it works now: the app ships with no disc data. If a user chooses to, it downloads the catalog once
> from my server (disc.flyboybyte.com) and uses it on-device only. The "Disc data by Try Discs" credit appears in
> Settings and in the README. Updates are manual, from a button in Settings. I also want to tell you that earlier
> versions bundled a public Kaggle dataset whose description says it was scraped from Try Discs; I've removed it
> from the app. Is this all OK with you, and is there anything you want changed?

Check the website credit and the Kaggle description before sending.

### 2.2 Self-hosted F-Droid repo
Index still serves `0.25.0` (code 25). `~/projects/fdroid-repo` no longer exists locally and its GitHub location was
not found: find it first (VPS docs, or ask). Default: remove Disc Tracker there once the official listing is live
(same signing key, higher codes, so users can switch), then update `README.md` and `AGENTS.md`.

### 2.3 Website disc data
`static/discs_master.json` feeds `/api/master` (`app.py:525-540`), `templates/index.html:802` and the fallback in
`templates/discsuggestion.html:443`; `tools/trydiscs-sync.js:59` reads it. `tools/add-master-disc.js` also writes
the deleted app asset. Default: point the website at `/api/catalog` only, delete the file and that tool, update the
sync tool, run Playwright, `./deploy.sh`. Autofill then depends on the published catalog on the VPS. Git history keeps
the file either way. Update Azeem's message if this lands first.

### 2.4 Old release APKs
Releases before `v0.28.0` carry the data. Default: delete their APK assets, keep tags and notes. Nothing in the
recipe points at them. Irreversible, so ask.

## Phase 3: v0.30.0 font scaling (A4)
Notes: `ui-audit-plan.md`, A4. No new setting.
1. Baseline on a phone: `adb shell settings put system font_scale 1.3`, then `2.0`; restore `1.0`. Screenshot every
   tab and modal; list breakages.
2. Hotspots: `(tabs)/score.tsx` hole chips (`HOLE_CHIP_SIZE`, line 40, also used for scroll math ~551) and
   `gridCell`; fixed `height:` in 7 files; pill rows.
3. Remove fixed heights around text, let rows wrap; `maxFontSizeMultiplier` only for chips and the score grid.
Done = no clipped or overlapping text at 130% and 200%. Release as Phase 1.

## Phase 4: toolbox skill
Edit `~/projects/toolbox/skills/fdroid`, sync `~/.claude/skills/fdroid`, keep the casebook anonymous.
Items: assessment section 3. Files: `reference/casebook.md`, `reference/react-native-expo.md` (foojay, Expo 57),
`reference/troubleshooting.md`, `reference/process.md` (log URL), `scripts/check-recipe.py` (foojay severity),
`SKILL.md` (rule 3 wording, fresh-install rule).

## Open decisions (default applies unless Logan says otherwise)
| # | Question | Default |
| --- | --- | --- |
| 1 | Prompt wording | As in 1.1 |
| 2 | Delete-all placement | Last section |
| 3 | B4 in v0.29 | No |
| 4 | Self-hosted repo | Remove the app after listing |
| 5 | Website data | Switch to `/api/catalog`, delete |
| 6 | Old APKs | Delete assets, keep tags |
