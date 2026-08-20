# F-Droid Reference (from DragTree)

> **Tier:** Low-level (build detail) · **Audience:** whoever runs Distribution Track D2
> (F-Droid self-hosted repo) or D3 (official F-Droid index) · **Use when:** actually
> submitting to F-Droid — not needed for D1 (Play Store) or earlier build phases.

This distills the developer's real F-Droid submission for **DragTree** (same
stack: Expo/React Native, local Gradle, no EAS) — full source at
`/home/logan/projects/drag-tree/FDROID_AI_CONTEXT.md`, `FDROID.md`,
`FDROID_MR_ACTIVITY.md`, and `FDROID_REPRO_EXECUTION.md` on this machine.

**Status as of 2026-08-20 (confirmed against the drag-tree repo directly, not memory):**
DragTree is **not yet merged** — MR #41671 has a fully reproducible build (`Binaries:`
byte comparison passing all 4 ABIs, Run 2 pipeline `2728036212`, 2026-08-03), reviewer
(linsui) satisfied, a second community tester (MiggiV2) passed it on real hardware
(functional/policy/language/VirusTotal 0/75), and it's rebased on upstream/master awaiting
a merger's merge. (An earlier version of this doc incorrectly said "got merged" — that was
wrong; corrected here.) That took ~2 weeks of reviewer iteration — this doc exists so this
project's D2/D3 doesn't repeat the same discovery process from zero.

**2026-08-20 refresh — what's new since this doc was last written (2026-08-01):** the
`SYSTEM_ALERT_WINDOW` finding below (config-plugin durability) was cross-confirmed
independently — DragTree's reviewer flagged the exact same permission as a real MR test
finding, and disc-tracker's own 2026-08-20 audit found it independently too, before this
cross-check happened. Also pulled in: the `blockedPermissions`/config-plugin durability
lesson (new, generalized from both apps' experience), `$VERCODE$` templating, YAML
rewritemeta trailing-space gotchas, the `buildFromSource` requirement (previously
missing from this doc entirely), and confirmation that the Play/F-Droid signing-key
alignment required zero F-Droid pipeline changes.

## Dependency reproducibility — done vs. DEFERRED (revisit before D2/D3)

F-Droid builds the app **from source** via `npm ci` + `npx expo prebuild` + local Gradle, so the
committed `package.json` + `package-lock.json` must reproduce `node_modules` deterministically.

**Done (2026-07-31, commit `2601506`) — the minimal reproducibility fix:**
- Declared the direct/required-peer deps the app imports that were previously only present
  transitively: `expo-constants`, `expo-linking`, `react-native-safe-area-context`,
  `react-native-screens`. (Their absence red-screened a clean `npm ci` at runtime.)
- Removed two unused deps (`react-native-draggable-flatlist`, `@react-native-community/slider`).
- Pinned the toolchain: `app/.nvmrc` (Node 20), `packageManager: npm@10.9.2`, `engines`, and
  `app/.npmrc` (`legacy-peer-deps=true`, for expo-router's web-only react-dom peer noise — NOT a
  pnpm hoisted-linker setting).
- Acceptance bar met: `cd app && rm -rf node_modules && npx -y npm@10.9.2 ci` reproduces every
  native module with zero `--no-save` patching; tsc clean, 115/115 jest, all five tabs verified.

> **Toolchain gotcha:** this machine's *global* npm is broken (`npm 12.0.1` on Node 20 — it
> mis-resolves installs). **Always** use `npx -y npm@10.9.2` for install/ci in `app/`, never bare
> `npm`. See memory `reference_mobile-npm-toolchain`.

**DEFERRED — SDK patch-alignment (do NOT skip before an F-Droid reproducible build):**
We deliberately chose the *minimal* fix over a full SDK realignment to save time now, because a
full `expo install --fix` bumps native packages and can only be validated with a fresh prebuild +
APK rebuild (release-track work). As of 2026-07-31 `npx expo install --check` reports this drift
(SDK moved 57.0.7 → 57.0.9 under us):

| package | have | expo-expected |
|---|---|---|
| expo | 57.0.7 | ~57.0.9 |
| expo-constants | 57.0.6 | ~57.0.8 |
| expo-router | 57.0.7 | ~57.0.9 |
| expo-sharing | 57.0.6 | ~57.0.8 |
| expo-system-ui | 57.0.1 | ~57.0.2 |
| react-native | 0.86.0 | 0.86.2 |
| react-native-reanimated | 4.5.0 | 4.5.1 |
| react-native-safe-area-context | 5.8.0 | ~5.7.0 |
| react-native-worklets | 0.10.0 | 0.10.1 |

(Dev-only `jest`/`@types/jest` drift is expo's web-preference — leave; not shipped, not F-Droid-relevant.)

**How to tell the minimal fix was NOT enough** (i.e. you must do the realignment):
- `fdroid build` / F-Droid CI fails at `npm ci` on a missing or unresolved dep, OR
- `npx expo-doctor` flags version-mismatch / "invalid" native modules, OR
- the release APK red-screens or crashes on a module that Metro (debug) masked, OR
- a reviewer asks for it (Expo/RN version currency is common F-Droid feedback).

**How to revisit (the procedure — run in `app/`, always via `npx npm@10.9.2`):**
1. `npx -y expo install --fix` — aligns every package to the installed SDK's blessed versions
   (or hand-edit `package.json` to the table above if `--fix` misbehaves with the broken npm).
2. `npx -y npm@10.9.2 install` — regenerate the lockfile deterministically. Commit it.
3. Clean-room proof: `rm -rf node_modules && npx -y npm@10.9.2 ci` must resolve
   `expo-constants` / `expo-linking` / `react-native-safe-area-context` / `react-native-screens`
   with zero patching. `@expo/metro-runtime` is a web-only expo-router peer — stays undeclared
   (native app runs without it; re-confirm it's still not required).
4. `npx expo prebuild -p android --clean` — regenerate `android/` (the F-Droid recipe runs this;
   native bumps only take effect here, not over Metro).
5. Rebuild the release APK and **sideload/emulator smoke-test all five tabs** — native version
   bumps (RN 0.86.0→0.86.2 etc.) are invisible to a Metro debug run and only surface on a real
   build.
6. Re-run the GMS/Glide check (step 4 of the section below) in case a bumped dep pulled in a
   proprietary/nondeterministic transitive dep.
7. `tsc --noEmit` clean, `jest` green, then proceed to the two-run reproducible-build workflow.

Keep this section in sync if the SDK drifts further before R7.

## Config-plugin durability — manual `android/` edits do NOT survive F-Droid's build

**Confirmed directly on disc-tracker, 2026-08-20:** ran `npx expo prebuild -p android
--clean` (the exact step the F-Droid recipe always runs, non-negotiable per the reviewer —
see "The reviewer's actual requirements" below) against the committed `android/` tree, and
watched it silently wipe out hand-edited fixes that had only ever been made directly in
`android/app/src/main/AndroidManifest.xml` — a `SYSTEM_ALERT_WINDOW` permission removal and
an `allowBackup="false"` change both reverted straight back to the Expo/RN defaults. Same
regeneration also reset `versionCode` to `1`, dropped the release-signing null-guard block,
the `minifyEnabled`/`shrinkResources` flags, and the tuned JVM args in `gradle.properties`
— none of that is expressed anywhere `expo prebuild` reads from (app.json, config plugins,
root-level gradle files), it only ever existed as hand-maintained edits layered onto a
prior prebuild output.

**The lesson, stated generally:** the committed `android/` folder is real and correct for
*local* Gradle builds (sideload, Play, direct `./gradlew`) — nothing here changes that,
and this project's own convention of committing it and hand-tuning it is fine for that
path. But F-Droid's from-source build starts from `app.json`/`package.json`/config plugins
and regenerates `android/` from scratch every time — so **anything that must survive an
actual F-Droid build has to be expressed at that layer, not as a one-off native-file
edit**, or it silently reverts on F-Droid's server even though it's sitting right there in
the committed tree looking correct.

**The fix pattern (both now applied to disc-tracker, verified to survive a second
`prebuild --clean`):**
- Unwanted merged permission → `android.blockedPermissions` in `app.json` (Expo's
  built-in mechanism — produces a `tools:node="remove"` line in the manifest, which
  actively cancels the permission even if some other merged manifest re-requests it,
  stronger than a plain deletion).
- Any other manifest attribute (e.g. `allowBackup`) → a small local Expo **config
  plugin** using `withAndroidManifest` from `expo/config-plugins`, referenced by relative
  path in `app.json`'s `plugins` array (`app/plugins/withAllowBackupDisabled.js` here).
- **Not yet solved for this project** (out of scope for the 2026-08-20 pass, flagged for
  whoever runs D2/D3): `versionCode`, release-signing config, and the minify/shrink/JVM
  flags will all need an equivalent durable mechanism (or a documented "F-Droid's recipe
  sed-patches this at build time" answer, matching how DragTree's own YAML sets
  `versionCode` via `$VERCODE$` and signing is stripped entirely — see below) before an
  actual F-Droid build of this app would behave correctly. This is genuinely open, not
  hand-waved — don't assume the committed `android/` folder is what F-Droid will build
  until this is checked for real.

**DragTree independently found the identical permission issue** — its reviewer (MiggiV2,
F-Droid MR #41671 test review, 2026-08-02) flagged unused merged permissions including
`SYSTEM_ALERT_WINDOW`, `RECORD_AUDIO`, `INTERNET`, `READ_EXTERNAL_STORAGE`, and
`WRITE_EXTERNAL_STORAGE` (DragTree doesn't use any of those — a reaction-timer app has no
reason to). DragTree's fix (`cc5bafd`, 2026-08-03) used the same `blockedPermissions`
mechanism now applied here. disc-tracker found its own `SYSTEM_ALERT_WINDOW` case
independently (`fdroid-privacy-audit-2026-08-20.md`, same day, before this cross-check) —
worth noting disc-tracker legitimately needs `INTERNET` and the storage permissions
(opt-in Marshall Street images, CSV/backup export), unlike DragTree, so DragTree's
blocklist isn't a template to copy wholesale — only `SYSTEM_ALERT_WINDOW` was actually
unused here.

## What transfers directly to any Expo/RN F-Droid submission

These four are **not DragTree-specific** — they're properties of the Expo/RN + AGP +
F-Droid buildserver combination and apply here too:

1. **LAN IP embedded in `resources.arsc`** — `AgpConfiguratorUtils.kt`'s
   `getHostIpAddress()` embeds the build machine's LAN IP as a string resource. Fix
   (in the F-Droid recipe's `prebuild:`):
   ```bash
   sed -i 's/\.filter { it is Inet4Address && !it.isLoopbackAddress }/.filter { false }/' \
     node_modules/@react-native/gradle-plugin/react-native-gradle-plugin/src/main/kotlin/com/facebook/react/utils/AgpConfiguratorUtils.kt
   ```
2. **`.so` path leakage via `GRADLE_USER_HOME`** — Gradle's transform cache embeds
   `GRADLE_USER_HOME` into `.so` files via `__FILE__` macros. F-Droid's buildserver runs
   as `vagrant` (`/home/vagrant/.gradle`). For the *local reference build* only, export
   `GRADLE_USER_HOME=/home/vagrant/.gradle` before building — this makes local `.so`
   bytes match F-Droid's, it doesn't change F-Droid's own build.
3. **ZIP structure / `apksigner` 0xD935 padding mismatch** — `apksigner` converts
   null-byte ZIP alignment padding to structured 0xD935 extra fields when signing, which
   changes the bytes the v2/v3 signing block's `CHUNKED_SHA256` is computed over. Fix:
   sign **F-Droid's own unsigned APK** (downloaded from CI pipeline artifacts, not a
   locally-built unsigned APK) with `--alignment-preserved true --v1-signing-enabled
   false`. This is the documented F-Droid workflow, not a workaround — see "What 'not
   cheating' means" below.
4. **Glide `classes.dex` non-determinism** — only relevant *if* a dependency pulls in
   Glide (commonly via `expo-image`, `expo-camera`). disc-tracker doesn't currently use
   either, so this doesn't apply — but check again before D2 if dependencies change.
   Glide's `IndexerGenerator` uses JVM-identity hash codes for a generated class name,
   which changes every build. Fix if needed: a Gradle init script hooking
   `kaptReleaseKotlin` to rename the output deterministically (DragTree's
   `scripts/glide-deterministic.init.gradle`, copyable if this ever applies).

## Why we ship only arm64-v8a + armeabi-v7a (the DragTree 100 MB lesson)

RN ships prebuilt native `.so` libs (Hermes, RN core, react-native-svg, …) **once per
ABI**. A universal APK carrying all four (`arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`)
is ~4× the native payload — DragTree's landed at **~100 MB**, and the x86/x86_64 halves
are dead weight (those ABIs are emulators + a near-extinct sliver of Intel Android; no
real phone uses them). That size pushed DragTree into **per-ABI splits** — multiple APKs
per release, each with its own `versionCode` offset, all enumerated in the F-Droid
metadata — i.e. a messier MR.

disc-tracker pre-solves this at the ABI-selection step: **only arm64-v8a + armeabi-v7a**
(every real Android device, ~50 MB), so a single universal APK stays small enough to
likely ship as **one artifact / one `versionCode` / one MR** instead of a split matrix.

**Caveat for F-Droid from-source builds:** locally we restrict ABIs with the
`-PreactNativeArchitectures=arm64-v8a,armeabi-v7a` CLI flag — but **F-Droid won't pass
that flag**; its recipe just runs `expo prebuild` + Gradle. So the ABI restriction must
live in **committed build config** (`android/app/build.gradle`, via `android.splits.abi`
per the section below — *not* only the CLI flag), or F-Droid's build balloons back to all
four ABIs and you're at DragTree's 100 MB. Verify with `unzip -l <fdroid-built.apk> |
grep lib/` before assuming the from-source build stayed at two ABIs. (linsui may request
splits anyway for D3 — see the split-caveat note below.)

## ABI splits: `android.splits.abi`, not `abiFilters` — with a caveat

DragTree found that `ndk { abiFilters }` (and `packagingOptions.exclude`) **appear** to
work — the build succeeds — but silently produce universal APKs on AGP 8.x, because
prebuilt `.so` files from RN npm packages (libhermes, libreactnative, etc.) are bundled
via AAR extraction at APK assembly time, bypassing the packaging pipeline those
mechanisms intercept. The working fix there was `android.splits.abi`, injected via sed
on the `android {` block, which operates at Gradle's variant-assembly level instead and
actually excludes non-matching native libs.

**This project's own toolchain doesn't reproduce that bug** — verified directly
(2026-07-23): a release build with `-PreactNativeArchitectures=arm64-v8a,armeabi-v7a`
(the mechanism documented in `infrastructure.md` and `../../PORT_PLAN.md`, which
resolves to the same underlying `ndk.abiFilters` config DragTree's broken attempt used)
was unzipped and inspected — the resulting APK contained **only** `lib/arm64-v8a/` and
`lib/armeabi-v7a/`, no `x86`/`x86_64`. Likely explanation: a newer Expo SDK 57 / RN 0.86
/ AGP combination than DragTree's (Expo SDK 54 / RN 0.81.5) fixed the AAR-extraction
bypass. Don't assume this stays fixed forever — **if a future dependency bump ever
produces a suspiciously large release APK again, re-run the same `unzip -l ... | grep
lib/` check before assuming it's something else**, and fall back to
`android.splits.abi` (documented above) if the bug ever reappears here. For an F-Droid
*index* submission specifically (D3), splits may be requested anyway regardless of this
— DragTree's reviewer (linsui) called per-ABI splits "highly encouraged" for RN apps
even once the universal build passed, so budget for it as likely reviewer feedback.

**If splits are ever added here, use `$VERCODE$`, not hardcoded versionCodes per block.**
DragTree's YAML originally hardcoded each ABI block's versionCode
(`sed -i 's/versionCode 14$/versionCode 141/' android/app/build.gradle`); linsui's inline
suggestion (2026-07-23) changed every block to
`sed -i 's/versionCode .*/versionCode $VERCODE$/' android/app/build.gradle` — `$VERCODE$`
is an fdroidserver template variable substituted per-block from the YAML's own
`VercodeOperation` (`10 * %c + 1` through `+4` for the 4 ABIs), so the YAML never needs a
manual versionCode edit when the app version bumps. Apply this from the start rather than
hardcoding and fixing it later.

## `buildFromSource` — required, injected by the F-Droid recipe itself (not a repo change)

DragTree's fdroiddata YAML `prebuild:` step includes (`FDROID_MR_ACTIVITY.md` commit
`167ed55c`):
```bash
sed -i -e '1a "expo":{"autolinking":{"android":{"buildFromSource":[".*"]}}},' package.json
```
This forces Expo's autolinking to compile every native module **from source** during the
F-Droid build, rather than pulling any prebuilt AAR — required for F-Droid's own
build-from-source policy, not optional. This is a **recipe-side sed**, not something to
add to disc-tracker's own `package.json` now — it only needs to exist in the fdroiddata
YAML written when D2/D3 actually starts. Noted here so it isn't missed when that YAML gets
written (this doc didn't mention it at all before 2026-08-20).

## YAML formatting gotchas (rewritemeta canonical format)

CI's `rewritemeta` job is strict about trailing whitespace on specific lines — these trip
up every iteration according to DragTree's own experience:
- `binary:` alone on a line needs a trailing space (block scalar indicator): `binary: `
- `sed -i` alone on a continuation line needs a trailing space: `sed -i `
- The IP-address sed's closing needs a trailing space: `{ false }/' `

**Never run `rewritemeta` locally to pre-fix this** — the local version and CI's version
produce different output. Push with the format as-is, let CI's rewritemeta job fail and
output the exact diff it wants, copy that diff in verbatim. One iteration, not several.

## Signing-key strategy — make Play App Signing == the upload key (DragTree, solved 2026-08-01)

The trap: with **Play App Signing** on, Google re-signs every Play release with a key you
never hold — so Play installs are signed by *Google's* key, while a self-built F-Droid /
sideload APK is signed by *your* upload/keystore key. Different signing certs =
**different apps** to Android: a user can't update from one channel to the other without a
full uninstall (losing local data), and F-Droid's `AllowedAPKSigningKeys` can only ever
match one of the two.

**DragTree's fix (done, verified in Play Console 2026-08-01):** use Play Console →
*App integrity → App signing → Change app signing key* to set the **app signing key equal
to the upload key**. After that, the "App signing" cert fingerprints and the "Upload key
certificate" fingerprints are **identical** (DragTree: SHA-256
`FF:73:9C:F5:65:D8:FE:3A:F4:FF:97:E6:41:F6:33:6F:A6:9E:BC:F3:EE:C2:22:A7:A7:C5:AB:9F:8E:3D:83:7A`,
same MD5/SHA-1/SHA-256 in both blocks). Now **one keystore signs everything** — Play,
F-Droid reference APK, and sideload — so `AllowedAPKSigningKeys` matches all channels and
users move between Play and F-Droid installs without a reinstall.

**Confirmed after the fact: this change required zero F-Droid pipeline changes.**
`AllowedAPKSigningKeys` in the fdroiddata YAML was already the developer's own key
fingerprint (`ff739cf5...`), so aligning Play's signing key to match it didn't touch
anything F-Droid-side — the two systems were already pointed at the same cert, Play was
just the one that needed to catch up.

**versionCode scheme, Play vs. F-Droid, so they never collide:** DragTree uses
`10 * versionCode + 0` for Play uploads (e.g. base versionCode 16 → Play versionCode 160)
against F-Droid's per-ABI `10 * %c + 1` through `+4` (161–164) — Play's `+0` always sorts
below every F-Droid ABI variant for the same release, so a device could never see a
same-version Play build "update" over a same-version F-Droid build or vice versa in a way
that looks like a downgrade. Worth adopting the same `+0`/`+1..+4` convention here if/when
disc-tracker ships to both Play (R6) and F-Droid ABI splits (R7).

**For disc-tracker (R6, before D1):**
- The upload keystore lives in `android/local.properties` (null-guard pattern, never
  committed — see `../../CLAUDE.md`). Logan has the DragTree keystore + this strategy
  proven; point to the disc-tracker keystore path/alias when R6 starts.
- Do the "change app signing key to match upload key" step **before** publishing to an
  open track — Play Console only allows the change *before* first open-track publish
  (the "Change your app signing key" link in the screenshot is gated on that).
- Get the fingerprint for `AllowedAPKSigningKeys` via
  `apksigner verify --print-certs <apk>` (or copy the SHA-256 straight from the Play
  Console App-signing block, since they'll be equal).
- Caveat: this is a **one-way, one-time** decision per app — plan it, don't stumble into
  it. It's why R6 (Play signing) must be settled *before* R7 (F-Droid), not in parallel
  (matches the "never run D1/D2/D3 in parallel" rule in `../../CLAUDE.md`).

## The reviewer's actual requirements (linsui, F-Droid)

- **Follow `templates/build-react-native.yml` exactly** — not "inspired by." When asked
  which parts should change, the answer was "every part."
- **`npx expo prebuild -p android --clean` stays in the recipe.** Non-negotiable.
- **Patch Java 17 requests to JDK 21 via sed** in the RN gradle plugin, matching the
  template — don't install Temurin or add a different JDK via `sudo:`.
- **`scandelete: node_modules`** required.
- **`scanignore` must be file-level**, never package-level or a broad glob.
- **Both `Binaries:` and `AllowedAPKSigningKeys:` are required** — `AllowedAPKSigningKeys`
  alone does not enable reproducible-build verification; reviewer will reject it.
- **Never use local `rewritemeta`** to fix YAML formatting — it produces different
  output than the CI version. Push, let CI's rewritemeta job output the exact diff it
  wants, copy that in.

## The two-run process (required for `Binaries:`)

You cannot produce the reference APK before F-Droid has built it once — the reference
must be signed from F-Droid's own unsigned build output, not a local one.

1. **Run 1** — push the YAML with build block(s) but no `Binaries:` entries yet. Wait for
   the pipeline, download the unsigned APK(s) from CI job artifacts.
2. **Sign** each with `apksigner sign --v1-signing-enabled false --alignment-preserved
   true --out ref.apk fdroid_unsigned.apk`.
3. **Verify the cert fingerprint** matches `AllowedAPKSigningKeys` before uploading —
   never upload unverified.
4. **Upload** to a GitHub release (all per-ABI APKs at once if doing splits — don't push
   Run 2 until every ABI's reference is uploaded).
5. **Run 2** — add `binary:` to each build block, push. Byte comparison runs for real.

## Hard stops (apply here too, not just to DragTree)

1. Never remove `npx expo prebuild -p android --clean` from the recipe.
2. Never use an EAS-built APK as a `Binaries:` reference (disc-tracker has no EAS
   anyway, per `../../CLAUDE.md`, so this is moot but worth stating).
3. Never build the reference APK from the host working tree — DWARF paths in `.so`
   files will differ from F-Droid's `/home/vagrant/build/<packageId>` path. Always build
   in a matching container.
4. Change exactly one variable class per debugging attempt (don't combine a `.so` fix
   with a `classes.dex` fix in the same push) — makes failures attributable.
5. Never upload a reference APK before verifying its cert fingerprint.

## What "not cheating" means

Signing F-Droid's own unsigned APK and uploading it as the `Binaries:` reference is the
*documented* F-Droid workflow, not a shortcut — byte comparison passing proves the
recipe is deterministic (F-Droid's own Run 1 and Run 2 independently produce identical
unsigned bytes from the same source commit). The reference APK only supplies which key
signed the result; it isn't standing in for F-Droid's own rebuild.

## Applying this to disc-tracker specifically, when D2/D3 starts

- Swap DragTree's package ID (`com.flyboybyte.dragtree`) for `com.disctracker.app`.
- Swap the GitHub release URL pattern, keystore path/alias, and
  `AllowedAPKSigningKeys` fingerprint (get via `apksigner verify --print-certs`).
- disc-tracker uses flat npm, not pnpm — DragTree's `node-linker=hoisted` /
  `.pnpm`-symlink discussion doesn't apply; plain `node_modules/...` scanignore paths
  should work without that extra step.
- Check `expo-sqlite`, `expo-file-system`, `expo-sharing`, `expo-document-picker` (this
  project's actual native deps, per `infrastructure.md`) for anything pulling in Glide
  transitively before assuming step 4 above doesn't apply — verify, don't assume from
  DragTree's dependency list.

---

## The actual fdroiddata MR checklist (the R7 acceptance rubric)

From the fdroiddata Merge Request template Logan works with as an F-Droid reviewer (screenshot
2026-07-29, MR-format checklist). This is the concrete bar for our own submission, grouped by
weight:

**Required**
- [ ] All related fdroiddata + RFP issues referenced in the MR (we're the author; no prior RFP).
- [ ] Builds with `fdroid build` and all pipelines pass.
- [ ] Issue tracker + author contact info exist so bugs can be reported.

**Strongly Recommended**
- [ ] Upstream repo carries app metadata (summary/description/images/changelog) in a **Fastlane**
      or **Triple-T** folder structure. ← we don't have this yet; add a `fastlane/metadata/android`
      tree before submitting.
- [ ] Releases are **tagged** and **auto-update is enabled** (`UpdateCheckMode: Tags` in metadata).

**Suggested**
- [ ] External repos added as **git submodules** (not the deprecated `srclibs`). **N/A for us:** the
      app vendors no external *source* repo — the physics sim is our own TS reimplementation, and
      npm deps come from the registry (not what this item means). `vendor/shotshaper/` is Python,
      server-/fixtures-only, not in the Android/RN build. So this box is simply out of scope, which
      is the clean outcome.
- [ ] Enable **Reproducible Builds** + add `AllowedAPKSigningKeys` to metadata. ← the one that
      matters for us; see the reproducible-build workflow above.
- [ ] Multiple APKs for native code (only if we ship per-ABI splits; currently one fat arm APK).
