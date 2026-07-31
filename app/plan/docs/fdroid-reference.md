# F-Droid Reference (from DragTree)

> **Tier:** Low-level (build detail) · **Audience:** whoever runs Distribution Track D2
> (F-Droid self-hosted repo) or D3 (official F-Droid index) · **Use when:** actually
> submitting to F-Droid — not needed for D1 (Play Store) or earlier build phases.

This distills the developer's real, completed F-Droid submission for **DragTree** (same
stack: Expo/React Native, local Gradle, no EAS) — full source at
`/home/logan/projects/drag-tree/FDROID_AI_CONTEXT.md` and `FDROID.md` on this machine.
DragTree got merged into F-Droid's official index (MR #41671) with a fully reproducible
build (`Binaries:` byte comparison passing) and per-ABI splits. That took ~2 weeks of
reviewer iteration — this doc exists so this project's D2/D3 doesn't repeat the same
discovery process from zero.

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
