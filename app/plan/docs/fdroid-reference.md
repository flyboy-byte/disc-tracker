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
