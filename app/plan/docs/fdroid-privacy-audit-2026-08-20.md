# F-Droid Readiness Audit — Privacy/Manifest/Dependency Pass (2026-08-20)

> **Tier:** Low-level (build/manifest detail) · **Audience:** whoever runs D2/D3 (F-Droid
> submission), or anyone sanity-checking the app still matches its own privacy claims ·
> **Use when:** periodically, and always before R7 starts for real. Complements
> `fdroid-reference.md` (build reproducibility, signing, the fdroiddata MR mechanics —
> DragTree-derived) rather than duplicating it: this pass covers the *content* side —
> manifest hygiene, declared permissions vs. reality, dependency/license cleanliness,
> and whether `docs/privacy.html` is still telling the truth.

**Status: not blocking, nothing found here should slow D2/D3 down.** Two real fixes
(below); everything else is either already solid or a documented, deliberate judgment
call left for Logan. Re-run this same pass again before R7 actually starts — dependencies
and manifest content drift over 10+ feature releases, this doc is a snapshot, not a gate
that stays true forever.

**Update (same day):** `allowBackup` — originally logged below as a judgment call — was
decided: Logan said remove it. `android:allowBackup` is now `false`. See the entry below
(moved out of "noted, not acted on").

**Update 2 (same day, cross-checked against drag-tree):** both fixes below were originally
made as direct edits to `android/app/src/main/AndroidManifest.xml`. Testing against the
`drag-tree` repo's F-Droid docs revealed that's not durable — F-Droid's build recipe always
runs `npx expo prebuild -p android --clean`, which regenerates `android/` from `app.json`
and confirmed, on a real local test, silently reverts hand-edited manifest changes back to
Expo/RN defaults. Both fixes have been re-implemented at the `app.json`/config-plugin
layer instead (`android.blockedPermissions` for the permission,
`app/plugins/withAllowBackupDisabled.js` for `allowBackup`) and verified to survive a
second `prebuild --clean`. Full writeup in `fdroid-reference.md`'s new "Config-plugin
durability" section — that's also where the broader, still-open finding lives (versionCode/
signing/minify flags have the same durability gap and aren't fixed yet).

## Fixed this pass

**`SYSTEM_ALERT_WINDOW` permission was shipping in every release build, undisclosed.**
`android/app/src/main/AndroidManifest.xml` declared
`<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>` in the *main*
manifest — meaning every release/sideload/Play/F-Droid build requested "draw over other
apps," a permission this app has never used and never disclosed in
`docs/privacy.html`'s permission list (INTERNET / READ·WRITE_EXTERNAL_STORAGE / VIBRATE
only). This is one of the more sensitive permissions on Android — commonly abused by
overlay/clickjacking malware — and exactly the kind of undisclosed grant an F-Droid or
Play reviewer (or a privacy-conscious user reading the manifest themselves) would flag
immediately, directly undercutting the "auditable, no hidden asks" claim this whole app
is built on.

Root cause: React Native's own library requests this permission correctly, but only in
its own `debug`-flavor manifest (confirmed via
`node_modules/react-native/ReactAndroid/src/debug/AndroidManifest.xml` — it's how the
Metro dev-menu/redbox overlay draws over other apps in a debug build). This project's
`app/src/debug/AndroidManifest.xml` and `app/src/debugOptimized/AndroidManifest.xml`
already declare it too, correctly scoped to debug variants only. Somewhere along the way
it was also added to `app/src/main/AndroidManifest.xml` — almost certainly a copy/paste
from one of those debug manifests rather than anything intentional — which put it in
*every* build, not just debug.

**Fix:** removed the line from `main/AndroidManifest.xml`. The debug-variant manifests
are untouched (that's the correct, expected, debug-only use), and no app code anywhere
references `SYSTEM_ALERT_WINDOW` (confirmed via grep), so nothing broke. Release builds
now request exactly the 4 permissions `docs/privacy.html` already promised.

**`allowBackup` disabled — matches the "no cloud, ever" claim literally, not just in
spirit.** It defaulted to Android's standard extraction rules (no `dataExtractionRules`/
`fullBackupContent` override), enabling the OS's own Auto Backup to the user's Google
Account. That's not a third-party server this app talks to — it's Google backing up the
device on the user's behalf, under the user's own account, same as it would for any app —
so it never actually contradicted the privacy claims. Still, this app's whole pitch is
"nothing about your data leaves this device unless you explicitly do it," and Auto Backup
is the one path where that wasn't strictly true (a phone-level cloud sync the user
enabled once, system-wide, could silently carry the SQLite DB to Google Drive without a
separate per-app decision). Logan's call: remove it. `android:allowBackup="false"` in
`main/AndroidManifest.xml` — restoring the app now always means the in-app Backup &
Restore feature (a file the user explicitly creates and moves themselves), nothing
implicit. Trade-off, stated plainly: a phone swap without using in-app backup first now
loses local data, same as before this app existed at all — the explicit backup path
already exists and is the one this app actually wants people using.

## Confirmed already solid

- **EAS is fully dropped, not just documented as dropped.** No `eas.json` anywhere in
  the repo, no `eas`/`eas-cli` reference in `package.json` or any config file. The only
  remaining mentions are in `RESEARCH.md`'s own decision record explaining *why* it was
  dropped — which is correct to keep (matches the "explicit do-not-re-ask" / decision-log
  convention this project already follows), not a leftover to clean up.
- **No proprietary/telemetry SDKs.** Full dependency list (`package.json`): all Expo
  core modules, `react-native-gesture-handler`/`reanimated`/`worklets`/`screens`/`svg`
  (Software Mansion, MIT), `react-native-safe-area-context` (MIT), `react-native-view-shot`
  (MIT). No Firebase, no Sentry/Crashlytics, no ads SDK, no analytics package of any
  kind. No `google-services.json` or equivalent anywhere in the tree.
- **No hardcoded secrets.** Grepped for API-key/secret/token patterns across `src/` and
  `app/` — clean. The two external URLs (`TRYDISCS_MANIFEST_URL`, `TRYDISCS_URL` in
  `src/catalog/constants.ts`) are public endpoints, no embedded key — matches
  `project_trydiscs-compliance` memory (Try Discs' own key lives server-side on the VPS
  proxy, never in the app).
- **No signing material committed.** `git ls-files` for `*.keystore`/`*.jks`/
  `local.properties`/`*.pem`/`*.p12`/`*.key` returns nothing — the gitignore rules
  documented in `app/CLAUDE.md`/`.gitignore` are actually holding.
- **No leftover Play-services placeholders.** Checked for the classic Expo-template
  gotcha (`com.google.android.geo.API_KEY` meta-data with a dummy value) — not present.
- **`vendor/shotshaper/`-derived code has proper GPLv3 provenance on both platforms.**
  The website side already had `vendor/shotshaper/NOTICE.md`; the on-device TypeScript
  port (`app/src/physics/sim/`) had inline comments crediting shotshaper but no
  standalone NOTICE — added `app/src/physics/sim/NOTICE.md` this pass, mirroring the
  website's file, so both copies of the ported code carry the same explicit attribution
  a source-auditing reviewer would look for.
- **No build-time non-determinism found** — no embedded timestamps, no
  `System.currentTimeMillis()`/`new Date()` baked into `BuildConfig` fields, no dummy
  Maps/Places API key strings. `REACT_NATIVE_RELEASE_LEVEL` defaults to a static
  `"stable"` string. This doesn't replace the real reproducible-build verification
  `fdroid-reference.md` already scopes for D2/D3 (LAN-IP embedding, `.so` path leakage,
  the apksigner padding mismatch, Glide non-determinism) — those are still open items in
  that doc, this is just one more thing *not* found wrong here.

## Noted, not acted on (Logan's call, not urgent)

- **`maven { url 'https://www.jitpack.io' }` in the root `build.gradle`'s `allprojects`
  repos** is standard React Native/Expo bare-template boilerplate — Gradle only fetches
  from a repo when something actually resolves there, and nothing in the current
  dependency tree appears to need it (not independently proven by removing it and
  rebuilding, since that requires an actual build to verify safely). Not a correctness
  or privacy issue either way; a candidate for a "does removing this still build cleanly"
  check sometime, not urgent.
- **Toolchain pin (SDK 36 / NDK 27.1.12297006) is indirect**, sourced from Expo SDK
  57.0.7's own `expo-root-project` Gradle plugin defaults via `rootProject.ext`, not a
  hardcoded value anywhere in this repo's own `.gradle`/`.properties` files. This matches
  how Expo is supposed to work (the versions documented in `CLAUDE.md`/
  `infrastructure.md` are what SDK 57.0.7 actually resolves to on this machine, confirmed
  present) — noted here only so a future SDK bump is understood to move these values too,
  not just the ones spelled out in `package.json`.
- **Expo CLI's own build-time telemetry** (anonymous usage data sent to Expo when
  running `npx expo ...` commands during development, opt-out via `EXPO_NO_TELEMETRY=1`)
  is a developer-machine concern, not something that ships in the APK or affects any
  user running the app — noted for completeness, not a user-facing privacy issue.

## What this pass did not re-check

This was a manifest/dependency/privacy-claim pass, not a rebuild-and-verify pass — it
did not re-run the reproducible-build workflow, re-verify the ABI-split behavior, or
re-audit `fdroiddata` MR mechanics. Those live in `fdroid-reference.md` and are still
correctly scoped as D2/D3-time work, not something to front-load now.
