# F-Droid submission (R7 / D3) — plan and recipe

Status (2026-10-17, end of session): **Run 1 in progress, no MR open, nothing tagged.** Recipe
is on the fork branch `com.disctracker.app` (head `1bb97e0b`); pipeline `2959067157` was running
when this session paused. See "Run 1 attempt log" below for exactly where it stands and what to
do next. Goal per Logan: get disc-tracker into an fdroiddata MR and let it sit through review.

**Rule, from Logan (2026-10-17): "none of ur own judgement, its exactly to fdroid spec or not at
all. from the dragtree experience with the fdroid mantainers."** Every recipe line and every
change below cites its source. Where the sources don't decide something, it's listed as
Logan's decision, not filled in.

## Primary sources (read 2026-10-17)

| Source | Where |
| --- | --- |
| **S1** The drag-tree MR thread, every comment (linsui reviewing, MiggiV2 testing) | `glab api projects/fdroid%2Ffdroiddata/merge_requests/41671/discussions` |
| **S2** drag-tree's merged recipe as it is upstream now | `upstream/master:metadata/com.flyboybyte.dragtree.yml` (fdroiddata fetched 2026-10-17) |
| **S3** F-Droid's React Native template, which linsui required ("Every part.") | `upstream/master:templates/build-react-native.yml` |
| **S4** The App Inclusion MR template | `upstream/master:.gitlab/merge_request_templates/App inclusion.md` |
| **S5** The Quick Start Guide, "Setup ABI split" section | f-droid.org/en/docs/Submitting_to_F-Droid_Quick_Start_Guide/ |
| **S6** Build Metadata Reference | f-droid.org/docs/Build_Metadata_Reference/ |
| **S7** Anti-Features | f-droid.org/en/docs/Anti-Features/ |
| **S8** Valid categories | `upstream/master:config/categories.yml` |
| **S9** drag-tree's release flow and hard rules | `~/projects/drag-tree/fdroid/README.md` |

## Run 1 attempt log (fork branch `com.disctracker.app`, app commit `2ea1fad9…`)

Where: `~/projects/drag-tree/fdroiddata` (Logan's fdroiddata fork clone; branch
`com.disctracker.app` off `upstream/master`, tracks `origin`). Recipe file:
`metadata/com.disctracker.app.yml`, 4 blocks (versionCode 271–274, no `binary:` yet).
`glab` is already logged in as flyboy-byte (`glab api projects/flyboy-byte%2Ffdroiddata/...`).
Format: attempt → what the CI log said → fix → source of the fix.

| # | Pipeline | `fdroid build` result | Fix applied next | Source |
| --- | --- | --- | --- | --- |
| 1 | 2958956800 | scanner: `autolinking_implementation.gradle` non-existent + unused | delete that scanignore line (file gone in Expo 57); rewritemeta wanted extra blank lines removed | CI scanner + rewritemeta diff |
| 2 | 2958961213 | Gradle config: `node` exit 1 inside Expo `ExpoAutolinkingPlugin` | Expo 57's generated `gradle.properties` has no trailing newline, so recipe's `echo 'org.gradle.caching=true' >>` glued onto `expo.inlineModules.watchedDirectories=[]` → JSON.parse fails. Now `echo -e '\norg.gradle.caching=true'` | reproduced in the buildserver container; 223 upstream recipes use the `echo -e "\n…"` form |
| 3 | 2959040513 | deps: `react-native-view-shot` / `masked-view` "No variants exist" | scanner (scandelete) deleted their `build.gradle` (unknown local maven repo). Added `view-shot`, `masked-view`, `react-native-svg` `android/build.gradle` to `scanignore` | RN template comment: "Add other build.gradle files here if local maven repo for react-native is used" |
| 4 | 2959054249 | real compile reached (447 tasks): `:react-native-worklets:compileReleaseKotlin` Java 21 vs Kotlin 17 | added `sed -i -e '/jvmToolchain/s/17/21/' -e 's/fromTarget("17")/fromTarget("21")/' node_modules/react-native-worklets/android/build.gradle.kts node_modules/react-native-reanimated/android/build.gradle.kts` before `npx expo prebuild` | 43 merged upstream recipes, incl. com.scalepractice (2026-10-06), jp.nonbili.nori (2026-10-13) |
| 5 | **2959067157** | **running / unknown at pause** | read its log first | — |

`checkupdates` fails in every run and **should**: no `v0.27.0` tag exists, so it sees `v0.26`
(vercode 264 < 274). It clears after the tag is created in Run 2. All other jobs (lint, schema
validation, rewritemeta, source scan, git redirect, tools check) pass as of attempt 4.

### How to read a failed run (works, fast)

```bash
glab api "projects/flyboy-byte%2Ffdroiddata/pipelines?ref=com.disctracker.app&per_page=1"
glab api "projects/flyboy-byte%2Ffdroiddata/pipelines/<ID>/jobs?per_page=50"      # find `fdroid build`
glab api "projects/flyboy-byte%2Ffdroiddata/jobs/<JOB>/trace" | sed 's/\x1b\[[0-9;]*[mK]//g' > build.log
grep -n "What went wrong" -A12 build.log          # Gradle's real error
```

### Next steps from here

1. Read pipeline 2959067157's `fdroid build` job. If it failed, fix **one** thing from the real
   log, preferring the line other merged recipes use (grep `upstream/master:metadata/`), push,
   repeat. Expect more of the same kind (other libs hard-coding JVM 17, more local-maven
   `build.gradle` files, binary-scan hits). Each CI cycle is ~7–10 min.
2. When `fdroid build` passes for 271: download the unsigned APKs from the job artifacts
   (`unsigned/`), check each contains only its own `lib/<abi>/`. Note the pipeline builds only
   **one** versionCode per job (`com.disctracker.app:271`); the other three come from the
   `find-changed-builds` list, so confirm all four got built.
3. Sign each with `apksigner sign --v1-signing-enabled false --alignment-preserved true`
   using `~/@flyboybyte__drag-tree.jks` (alias in `~/projects/drag-tree/fdroid/README.md`; the
   passwords are NOT in any doc, ask Logan or read `app/android/local.properties`), verify the
   cert is `ff739cf5…837a`, then `gh release create v0.27.0 --target 2ea1fad9fa15c46ddcc9c4a80d15517ca462bee1`
   with `disc-tracker-v0.27.0-<abi>.apk` ×4. This creates the tag.
4. Run 2: add `binary:` blocks (drag-tree's form, trailing space after `binary:`) to all 4
   blocks, push, confirm 4 byte comparisons pass. Then the MR ("New app: Disc Tracker", App
   Inclusion template, explain each scanignore entry), and leave it.
5. If the app commit must change (any new commit to `main` that the build needs), update
   `commit:` in all 4 blocks. Docs-only commits to `main` after `2ea1fad9` are fine.

### Tooling gotchas learned this session

- **Never `npm run prebuild` in `app/`**: it deletes `android/` including gitignored
  `local.properties` (signing passwords). Backup: `~/disc-tracker-local.properties.bak`.
- zsh aborts a `&&` chain on an unmatched glob (`rm -f dir/*` on an empty dir). That silently
  skipped a script edit once and cost a 9-minute container run. Verify an edit landed before
  launching anything slow.
- Container repro (host untouched): `podman run --rm --network host --user root -v build.sh:/build.sh:ro -v out:/out registry.gitlab.com/fdroid/fdroidserver:buildserver-trixie bash /build.sh`.
  The image is already cached locally. Scripts used are in the session scratchpad only (not
  kept); rebuild from the recipe if needed. It does NOT include fdroid's scanner step.
- Debian trixie's node is 20.19.2 (RN 0.86 warns `^20.19.4`; warnings only so far).
- No Android emulator/AVDs exist on this machine anymore (docs that mention
  `verify_test`/`verify_std` are stale).

## What the maintainers actually asked of drag-tree (S1)

Every item below comes from the thread. The right-hand column is where disc-tracker stands.

| # | Requirement (who, when) | disc-tracker |
| --- | --- | --- |
| R1 | "Please follow the template at templates/build-react-native.yml" → "Every part." (linsui, 2026-06-30) | Recipe below = S3 + S2 |
| R2 | Use the App Inclusion MR template and check the boxes (linsui) | Do this at MR time, per S4 |
| R3 | Summary/description go in a fastlane tree in the repo, not the MR (linsui) | ✓ `fastlane/metadata/android/en-US/`. Changelog still to add (S4: "changelog should also be provided") |
| R4 | Patch to JDK 21 as in the template; no package-level `scanignore` (linsui, 2026-07-01) | Recipe uses S3's JDK sed verbatim; `scanignore` is file-level only |
| R5 | Plain `node_modules/...` scanignore paths (linsui, 2026-07-02) | Flat npm, so N/A |
| R6 | Add `Binaries` **and** `AllowedAPKSigningKeys`; the keys alone don't enable reproducible builds (linsui, 2026-07-03/04) | Both in recipe. Key `ff739cf5…837a` verified on `v0.26` APK |
| R7 | "Your apk is built from a different source code. You need to apply the same patch first." (linsui) | Reference APKs come only from F-Droid's own unsigned artifacts (S9) |
| R8 | ABI split per the Quick Start Guide (linsui, 2026-07-19, after seeing 4 × ~24 MB) | 4 blocks, S5's `VercodeOperation` |
| R9 | `sed -i 's/versionCode .*/versionCode $$VERCODE$$/'` in every ABI block (linsui inline suggestion, 2026-07-22/23) | In every block |
| R10 | Tester: unused permissions merged in from Expo/RN must go (`READ/WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`, …) via `blockedPermissions` (MiggiV2, 2026-08-02) | **Open, see below**: storage perms are declared, and no code uses them |
| R11 | Tester: `INTERNET` must actually be used; network connections checked with PCAPdroid; connections must be "described clearly in description"; "connects to web services on start" means NonFreeNet/TetheredNet "may apply" (S1 checklist) | INTERNET is used (opt-in features only); no connection on start (code-verified); described in `full_description.txt` |
| R12 | Tester: the version shown in the app must match the release (MiggiV2 found a hardcoded footer) | ✓ Settings reads `Constants.expoConfig.version` |

## Recipe — `metadata/com.disctracker.app.yml`

This is **S2 line for line**. The only differences are the ones forced by disc-tracker's repo
layout and package names. Each is listed after the YAML.

```yaml
Categories:
  - Sport Game
License: GPL-3.0-only
AuthorName: flyboy-byte
SourceCode: https://github.com/flyboy-byte/disc-tracker
IssueTracker: https://github.com/flyboy-byte/disc-tracker/issues

AutoName: Disc Tracker

RepoType: git
Repo: https://github.com/flyboy-byte/disc-tracker

Builds:
  - versionName: 0.27.0
    versionCode: 271
    commit: <full SHA>
    subdir: app/android/app
    sudo:
      - apt-get update
      - apt-get install npm
    init:
      - cd ../..
      - npm install --ignore-scripts
    gradle:
      - yes
    binary: 
      https://github.com/flyboy-byte/disc-tracker/releases/download/v%v/disc-tracker-v%v-armeabi-v7a.apk
    prebuild:
      - cd ../..
      - sed -i -e '1a "expo":{"autolinking":{"android":{"buildFromSource":[".*"]}}},'
        package.json
      - sed -i '/jvmToolchain\|JavaVersion/s/17/21/' node_modules/@react-native/gradle-plugin/*/build.gradle.kts
        node_modules/@react-native/gradle-plugin/react-native-gradle-plugin/src/main/kotlin/com/facebook/react/utils/JdkConfiguratorUtils.kt
      - sed -i 's/\.filter { it is Inet4Address && !it.isLoopbackAddress }/.filter
        { false }/' 
        node_modules/@react-native/gradle-plugin/react-native-gradle-plugin/src/main/kotlin/com/facebook/react/utils/AgpConfiguratorUtils.kt
      - npx expo prebuild -p android --clean
      - sed -i 
        's/android.enablePngCrunchInReleaseBuilds=true/android.enablePngCrunchInReleaseBuilds=false/'
        android/gradle.properties
      - sed -i 's/org.gradle.jvmargs=.*/org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=512m/'
        android/gradle.properties
      - echo 'org.gradle.caching=true' >> android/gradle.properties
      - sed -i -e '/signingConfig /d' android/app/build.gradle
      - sed -i 's/versionCode .*/versionCode $$VERCODE$$/' android/app/build.gradle
      - sed -i 's/^android {$/android {\n    splits { abi { enable true; reset();
        include "armeabi-v7a"; universalApk false } }/' android/app/build.gradle
    scanignore:
      - app/node_modules/hermes-compiler/hermesc/linux64-bin/hermesc
      - app/node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle
      - app/node_modules/expo-modules-autolinking/scripts/android/autolinking_implementation.gradle
      - app/node_modules/react-native-safe-area-context/android/build.gradle
      - app/node_modules/react-native-screens/android/build.gradle
    scandelete:
      - app/node_modules
    ndk: 27.1.12297006

  # blocks 2–4: identical except versionCode 272/273/274, the ABI in the split sed
  # (arm64-v8a / x86 / x86_64), and the ABI in binary:

AllowedAPKSigningKeys: ff739cf565d8fe3af4ff97e641f6336fa69ebcf3eec222a7a7c5ab9f8e3d837a

AutoUpdateMode: Version
UpdateCheckMode: Tags
VercodeOperation:
  - 10 * %c + 1
  - 10 * %c + 2
  - 10 * %c + 3
  - 10 * %c + 4
CurrentVersion: 0.27.0
CurrentVersionCode: 274
```

Trailing spaces after `binary:`, `sed -i` and `{ false }/'` are deliberate. They're S2's
rewritemeta-canonical form (S9: "copy the exact diff from the CI job log", never run rewritemeta
locally).

### Differences from S2, and why each is forced

| Field | S2 (drag-tree) | Here | Forced by |
| --- | --- | --- | --- |
| `subdir` | `android/app` | `app/android/app` | The app lives in `app/`. S6: "Specifies to build from a subdirectory". `cd ../..` still lands on the folder holding `package.json` |
| `scanignore`/`scandelete` paths | `node_modules/...` | `app/node_modules/...` | They're relative to the repo root. Upstream recipes with the app in a subdirectory use the same pattern (e.g. `mobile/node_modules/hermes-compiler/...`) |
| Hermes path | `react-native/sdks/hermesc/...` | `hermes-compiler/hermesc/linux64-bin/hermesc` | RN 0.86 moved hermesc into the `hermes-compiler` package. 35 upstream recipes use this path; S3's path is out of date |
| `async-storage` scanignore | present | dropped | disc-tracker doesn't depend on it, so the file doesn't exist |
| `WebSite` | GitHub Pages site | omitted | disc-tracker has no homepage. `docs/` has only `privacy.html`, and the Pages root 404s. The field is optional in S6 |
| `License` | `MIT` | `GPL-3.0-only` | S6: "short identifiers of the SPDX license list". GitHub's license API says `GPL-3.0`. SPDX deprecated `GPL-3.0` in favour of `GPL-3.0-only`, its equivalent. The repo has no "or later" notice |
| `AntiFeatures` | none | **none** | My earlier draft pre-declared `NonFreeNet`. **Removed**: that was my judgment. S7 applies it to apps that "promote or depend entirely on" a proprietary service. S1's tester checklist ties it to connections "on start", and disc-tracker makes none. The connections are disclosed in the description (R11), and the decision is left to the reviewer |
| `VercodeOperation` | `10 * %c + n` | `10 * %c + n` | My earlier `%c + n` variant is **removed**: S5 shows exactly `10 * %c + 1..4`. So `build.gradle` keeps base `versionCode 27` |

**Retracted from my earlier draft:** the plan for a separate sideload build with
`versionCode 270`. S9's flow is that the GitHub release *is* the four F-Droid reference APKs
(`drag-tree-v1.7.4-arm64-v8a.apk`, …, codes 171–174). There's no separate sideload build. That
also meets Logan's "10× scheme everywhere" choice (2026-10-17): the GitHub release carries
271–274, the same as F-Droid.

The rest of S2 is copied unchanged: `sudo`, `init`, `gradle`, every `prebuild` line,
`scandelete`, `ndk`, `AllowedAPKSigningKeys`, `AutoUpdateMode`, `UpdateCheckMode`.

`scanignore` is expected to change in Run 1. S3's own comment says "Add other build.gradle
files here [if a] local maven repo for react-native is used", and drag-tree's list came from
its CI scanner output. The final list comes from the Run 1 scanner report, not from
guesswork. Expect extra entries for the native deps drag-tree doesn't have:
- gesture-handler, reanimated, worklets, svg, view-shot, sqlite, crypto, document-picker,
  file-system, sharing.
- `expo-sqlite` also ships prebuilt `libsql/` and `vec/` `.so` files. `scandelete` removes them,
  which is safe because they're used only when `expo.sqlite.useLibSQL` or
  `withSQLiteVecExtension` is on (both off by default).

## Decisions for Logan

- ~~**D1, Categories.**~~ **Decided 2026-10-17 (Logan): `Sport Game`**, matching drag-tree. S8 has both **`Sports & Health`** and **`Sport Game`**. drag-tree went
  from `Sports & Health` to `Sport Game` in its own commit `50751249`. The thread has no
  reviewer comment on it, so it isn't a spec ruling. The only golf app upstream
  (`me.mgerdes.open_golf`) is a game and uses `Sport Game`. There are no disc golf apps in
  fdroiddata to copy.
- **D2, Storage permissions (R10).** `READ_EXTERNAL_STORAGE`/`WRITE_EXTERNAL_STORAGE`
  (maxSdk 32) are declared but unused: no `PermissionsAndroid`, no media library, and
  backup/CSV go through SAF/document picker. drag-tree's precedent is to add them to
  `blockedPermissions`. That's an app change, so it needs:
  - an on-device check of backup save/restore and CSV import/export;
  - edits to `privacy.html`, which wrongly claims they're used;
  - removing them from the allowlist in `check-manifest-permissions.js`.
- **D3, Bundled library credit.** `discs_master.json` is Try Discs-derived via Kaggle (see
  `risks.md`). This isn't an F-Droid requirement, so it's listed for completeness only.

## Release flow (S9, unchanged)

1. Bump `version` in `app.json` and `package.json`, and `versionCode 27`/`versionName "0.27.0"`
   in `app/android/app/build.gradle` (checkupdates reads this file). Add
   `fastlane/metadata/android/en-US/changelogs/271.txt` through `274.txt`.
2. Merge to `main` and push. **Do not tag.**
3. **Run 1:** on a fresh branch of `flyboy-byte/fdroiddata` off `upstream/master`, add the 4
   blocks with the full SHA and **no** `binary:`. Push. Fix rewritemeta from the CI diff only,
   and fix `scanignore` from the scanner report. Download the 4 unsigned APKs, and check that each
   holds only its own `lib/<abi>/`.
   - Expected Run 1 failures: `schema validation` (`binary` required) and `checkupdates` (no
     tag yet).
4. Sign each with `apksigner sign --v1-signing-enabled false --alignment-preserved true`.
   Verify the cert is `ff739cf5…`. Then `gh release create v0.27.0 --target <sha>` with
   `disc-tracker-v0.27.0-<abi>.apk` ×4. This creates the tag.
5. **Run 2:** add `binary:` to the 4 blocks and push. All 4 byte comparisons must pass.
6. Open the MR titled **"New app: Disc Tracker"** using the App Inclusion template (S4).
   - Tick only boxes that are true.
   - Explain each `scanignore` entry (S6: scanignore "probably accompanied by a comment
     explaining why it is necessary in the Merge Request").
   - Then leave it. S1: "lots of MRs waiting for test so it may take a long time".

**S9 hard rules:**
- `expo prebuild --clean` stays.
- No EAS or host-built APKs as `Binaries`.
- Don't run local rewritemeta.
- One variable class per attempt.
- Verify the cert before uploading.

## Health check (2026-10-17)

| Step | Result |
| --- | --- |
| `npx npm@10.9.2 ci` (clean) | ✓ |
| `npm run typecheck` | ✓ |
| `npx jest --ci` | ✓ 424/424 across 15 suites |
| `./gradlew assembleRelease` (committed `android/`) | in progress at time of writing; Reanimated's C++ build alone takes minutes per ABI, which matters for F-Droid's per-ABI CI time |

**Never run `npm run prebuild` in the working tree.** `expo prebuild --clean` deletes all of
`app/android/`, including the gitignored `local.properties` that holds the signing passwords. To
reproduce F-Droid's prebuild, use a throwaway clone. (Caught and stopped on 2026-10-17 before it
ran. There's a backup at `~/disc-tracker-local.properties.bak`.)

## Privacy-text fixes already shipped (`db69a1f`)

- `privacy.html`, `README.md` and the Settings copy no longer claim a single network feature.
  They now cover the Try Discs download (`disc.flyboybyte.com`; nginx default log, 14-day
  rotation, verified on the VPS), custom catalog URLs, and the DiscIt images.
- `discs_master.json` provenance is recorded in `risks.md`.
- The non-redistributable Kamaruddin PDF is untracked.
- The package ID stays `com.disctracker.app`. S6 doesn't require an owned domain, and changing
  it later would orphan existing installs.

### Run 1 attempt 5 — PASSED (2026-10-17)

Pipeline 2959067157 (fork head 1bb97e0b), job 17258653222: all four blocks built from
2ea1fad9 (271 armeabi-v7a, 272 arm64-v8a, 273 x86, 274 x86_64), ~60 min total. Artifact zip
holds `tmp/com.disctracker.app_27{1..4}.apk` (unsigned); each contains only its own ABI's libs
(verified with `unzip -l`). `checkupdates` fails as expected until the tag exists.
**Next: sign the 4 unsigned APKs (needs keystore passwords from Logan), release v0.27.0, Run 2.**

### Run 2 PASSED and MR opened (2026-10-18)

v0.27.0 released (tag on 2ea1fad9, 4 signed APKs, cert ff739cf5…837a). Fork head 9064bbf3 added
`binary:` to all 4 blocks; pipeline 2959263731 fully green (fdroid build 4/4, check apk,
checkupdates). **MR opened: https://gitlab.com/fdroid/fdroiddata/-/merge_requests/52998
("New app: Disc Tracker").** Now it just sits in review. Respond to maintainers only as asked;
any app-commit change means updating `commit:` in all 4 blocks.

### Retarget to v0.28.0 — no bundled disc list (2026-10-18)

Why: the bundled `discs_master.json` was the Kaggle `joej0e/disc-golf-disc-data` set, whose own
description says it was scraped from trydiscs.com. Azeem's permission (RESEARCH.md §11.5,
`catalog-v2-scope.md`) covers his API catalog, not that file, and he has never been told about
it. Logan's call: ship with NO bundled data for now; if a simple, genuinely open default dataset
turns up, load it in `src/utils/masterLibrary.ts`. `INTERNET` stays.

Done: app commit `68ddcd5f` (v0.28.0, versionCode base 28 → 281–284; tests use a synthetic
library; Settings/tutorial/README/store text updated). Fork head `3f649a6d`: 4 blocks re-pinned,
`binary:` REMOVED (Run 1 again). MR !52998 follows the branch.

**Remaining steps (same flow as before):** Run 1 pipeline 2959504253 → download unsigned APKs →
sign (key props in `~/projects/drag-tree/android/local.properties`, Logan OK'd reading them) →
`gh release create v0.28.0 --target 68ddcd5f…` ×4 apks → add `binary:` back (see v0.27 form) →
Run 2 → MR comment noting the version change.

**Known gaps, deliberately deferred (Logan: "document the gaps and we'll address it later"):**
- `v0.27.0` release/tag still exists and its APKs contain the Kaggle data. Not deleted; ask first.
- `static/discs_master.json` (live website) is the same Kaggle data; same provenance question.
- Disc Suggest's library picks need a loaded catalog; with none, only bag-based picks work.
  Needs an empty-state message there (not done).
- Autofill and the Disc library modal are empty until the Try Discs download/import; no first-run
  prompt pointing to Settings (not done).
- Azeem has not been told about the Kaggle lineage; the pre-submission check-in he asked for
  (final format/attribution/update flow) is still due now the MR is open.
- No simple open default dataset chosen yet.
- Backup/restore on Android ≤12 with storage permissions blocked is still untested.
- Mid-session note: the shared fdroiddata clone's branch was switched away from
  `com.disctracker.app` once by something else; always `git checkout` first in the same command.

### v0.28.0 Run 2 PASSED, MR updated (2026-10-18)

Fork head `6b243d9e`, pipeline 2959585910 all green (4/4 `binary:` verified, checkupdates ok).
`v0.28.0` released (public) with 4 signed APKs, cert ff739cf5…837a. Comment left on MR !52998.
Now just waiting on maintainers. Known gaps (see the retarget section above) are unchanged.
