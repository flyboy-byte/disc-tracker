# F-Droid submission (R7 / D3) — plan and draft recipe

Status: **audit done, recipe drafted, nothing submitted** (2026-10-17). Goal per Logan
(2026-10-17): get disc-tracker into an fdroiddata MR and let it sit there through review.

Use with `fdroid-reference.md` (the mechanics learned from drag-tree) and
`fdroid-privacy-audit-2026-08-20.md` (the manifest pass). This doc covers what was checked on
2026-10-17, what got fixed, what's still Logan's call, and the draft YAML.

The source of truth for the process is drag-tree's own docs:
- `~/projects/drag-tree/fdroid/README.md`: the release flow and the hard rules.
- `~/projects/drag-tree/fdroid/MR_ACTIVITY.md`: what reviewer linsui actually asked for.

drag-tree has been live on f-droid.org since its MR (!41671) was merged on 2026-09-28. It
updates automatically from tags.

## Health check (2026-10-17)

The project had sat untouched for six weeks before this check.

| Step | Result |
| --- | --- |
| `npx npm@10.9.2 ci` (clean) | ✓ |
| `npm run typecheck` | ✓ |
| `npx jest --ci` | ✓ 424/424 across 15 suites |
| `./gradlew assembleRelease` (committed `android/`, arm64+armeabi) | see the "Release build" line at the bottom |

**Never run `npm run prebuild` in the working tree.** `expo prebuild --clean` deletes all of
`app/android/`, including the gitignored `local.properties` that holds the signing passwords.
To reproduce F-Droid's prebuild, use a throwaway clone. (This was caught and stopped on
2026-10-17 before it ran. There's a backup at `~/disc-tracker-local.properties.bak`.)

## Privacy positioning: findings and fixes

The app's **behavior** is clean. There are three possible network calls, and all of them are
user-initiated:
- `catalogSync.ts`: the Try Discs download, or a custom URL. It only runs when the user taps
  Download, including on the first-run prompt in `_layout.tsx`.
- `msPic.ts`: Marshall Street images. Opt-in, off by default.

Nothing hits the network on launch.

What had drifted was the **text**. Everything below was fixed on 2026-10-17:

- **`docs/privacy.html`** said "the one optional network feature" and "no servers of its own it
  talks to". Both had been false since `v0.20`: the Try Discs catalog downloads from
  `disc.flyboybyte.com`, which is Logan's own VPS. The page now lists all three network
  features. For the catalog it states exactly what the server keeps: nginx's default access log
  (IP address, time, path, user agent), rotated daily and deleted after 14 days. That was
  verified on the VPS (`/etc/logrotate.d/nginx`) on 2026-10-17.
- **Smaller fixes on the same page:**
  - The Marshall Street link pointed at the shotshaper author's GitHub.
  - It claimed the image lookup sends the manufacturer and mold. `msPic.ts` sends only the mold
    name.
  - The backup wording still described the share-sheet-only flow from before `v0.26`.
- **`README.md`**'s privacy section had the same "only outside service" claim, which
  contradicted its own Try Discs paragraph. Fixed.
- **Settings copy** (`settings.tsx`, the Marshall Street hint) said "the app makes no network
  connections" when images were off. Narrowed to "no image requests are made", since the
  catalog download is separate. This ships with the next release.

### Anti-features to declare

- **`NonFreeNet`: declare it up front.** The two optional features talk to services whose data
  isn't free: Try Discs' catalog (licensed to this app, not openly licensed) and DiscIt/Marshall
  Street. Both are opt-in. Declaring it ourselves beats having the reviewer add it, and it
  matches how the app already describes itself.

## Open decisions (Logan's call)

1. **`discs_master.json` provenance: identified 2026-10-17, attribution still open.**
   - It comes from the Kaggle dataset `joej0e/disc-golf-disc-data`, labelled Apache 2.0. That
     dataset was itself scraped from trydiscs.com. Full detail is in `risks.md`.
   - For F-Droid: an Apache-2.0-labelled source is a defensible answer if a reviewer asks, so
     `NonFreeAssets` isn't planned.
   - The cleaner fix is crediting Try Discs (and the Kaggle dataset) for the bundled library in
     the same places the downloaded catalog is already credited. Logan has a direct
     relationship with Try Discs. That's Logan's call.
2. ~~**The non-redistributable paper PDF in the public repo.**~~ **Done 2026-10-17.** The Kamaruddin
   PDF is untracked, gitignored and kept locally. Its citation stays in
   `app/references/README.md`.
3. **Keep the package ID `com.disctracker.app`?** It's not a domain Logan owns. drag-tree uses
   `com.flyboybyte.dragtree`.
   - Changing it later is a new app, and every sideload/D2 user would have to reinstall. Changing
     it now costs the same thing once.
   - F-Droid doesn't require a domain you own. Recommendation: keep it.

## Version plan

Submit as **`v0.27.0`**. It carries the fixes above plus the new `fastlane/` listing, because
F-Droid reads the listing from the commit it builds, and `v0.26`'s commit doesn't have one.

- Base `versionCode` 27. With per-ABI splits, F-Droid's codes are `10 * 27 + 1..4` = **271–274**
  (armeabi-v7a, arm64-v8a, x86, x86_64). This is drag-tree's `VercodeOperation` scheme.
- Changelogs go in `fastlane/metadata/android/en-US/changelogs/271.txt` through `274.txt`.
- **Decided 2026-10-17 (Logan): use the `10 * c` scheme everywhere.** The sideload/GitHub
  `v0.27.0` APK gets `versionCode 270`. F-Droid's builds get 271–274. Release ordering stays
  consistent across every channel, matching drag-tree's Play build (`10 * c + 0`).
  - `checkupdates` reads `versionCode` from `app/android/app/build.gradle` at the tag. So with
    `VercodeOperation: 10 * %c + n`, F-Droid needs the **base** code there (`27`), not `270`.
  - The sideload `270` has to come from a build-time override instead, e.g. a
    `-PversionCodeOverride` Gradle property. Not built yet.
  - Alternatively, commit `270` to `build.gradle` and change the recipe to `%c + 1..4`. That's
    simpler and keeps one number in the repo. **Preferred:** it needs no new build plumbing,
    only a recipe that differs slightly from drag-tree's.

## Listing (done 2026-10-17)

`fastlane/metadata/android/en-US/` at the repo root:
- `title.txt`
- `short_description.txt` (77 characters; the limit is 80)
- `full_description.txt`, which ends with an explicit "Network use (all optional)" section
- `images/icon.png` (512×512)
- `phoneScreenshots/1–5.png`, the `v0.26` screenshots from `docs/`

Changelogs are pending the version decision.

## Draft recipe — `metadata/com.disctracker.app.yml`

This is drag-tree's merged recipe with three disc-tracker differences:
- The app lives in `app/`, so `subdir` is `app/android/app`.
- `scanignore` and `scandelete` are relative to the repo root, so the paths start `app/`.
- Hermes is the `hermes-compiler` package in RN 0.86, not `react-native/sdks/hermesc`.

One block is shown. The other three are identical apart from `versionCode` and the ABI in the
splits sed (and `binary:`, in Run 2).

```yaml
Categories:
  - Sports & Health
License: GPL-3.0-only
AuthorName: flyboy-byte
WebSite: https://github.com/flyboy-byte/disc-tracker
SourceCode: https://github.com/flyboy-byte/disc-tracker
IssueTracker: https://github.com/flyboy-byte/disc-tracker/issues

AutoName: Disc Tracker

RepoType: git
Repo: https://github.com/flyboy-byte/disc-tracker

AntiFeatures:
  NonFreeNet:
    en-US: Optional, off-by-default downloads from Try Discs' disc catalog and the DiscIt (Marshall Street) image API.

Builds:
  - versionName: 0.27.0
    versionCode: 271
    commit: <full SHA of the v0.27.0 commit>
    subdir: app/android/app
    sudo:
      - apt-get update
      - apt-get install npm
    init:
      - cd ../..
      - npm install --ignore-scripts
    gradle:
      - yes
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
    scandelete:
      - app/node_modules
    ndk: 27.1.12297006

AllowedAPKSigningKeys: ff739cf565d8fe3af4ff97e641f6336fa69ebcf3eec222a7a7c5ab9f8e3d837a

AutoUpdateMode: Version
UpdateCheckMode: Tags
VercodeOperation:   # build.gradle carries 270 (10 × base 27), see Version plan
  - '%c + 1'
  - '%c + 2'
  - '%c + 3'
  - '%c + 4'
CurrentVersion: 0.27.0
CurrentVersionCode: 274
```

These are expected to need adjusting in Run 1:
- **`scanignore`.** Start from drag-tree's list and let the CI scanner say what else it wants.
  disc-tracker has more native deps than drag-tree: gesture-handler, reanimated, worklets, svg,
  view-shot and sqlite.
- **`expo-sqlite`'s prebuilt `libsql/` and `vec/` `.so` files.** They're unused by default (the
  `useLibSQL` and `withSQLiteVecExtension` properties are off), so `scandelete` removing them
  should be harmless.
- **Build time.** drag-tree dropped reanimated, worklets and gesture-handler partly to cut CI
  time per ABI. disc-tracker needs all three (the custom slider, swipe cards and the gesture
  fix). Watch how long Run 1 takes.
- **The signing key: verified 2026-10-17.** `apksigner verify --print-certs` on the published
  `disc-tracker-v0.26.apk` gives `ff739cf565d8…837a`, the same key as drag-tree.

## Sequence

1. Settle the open decisions above and the version-code question.
2. Commit, tag nothing yet, and push `main`.
3. **Run 1:** on a fresh fork branch off `upstream/master` in `flyboy-byte/fdroiddata`, add the
   4 blocks without `binary:`. Push, then fix rewritemeta from the CI diff only. Never run
   rewritemeta locally.
4. Sign F-Droid's four unsigned artifacts with `--v1-signing-enabled false
   --alignment-preserved true`, verify the cert, then
   `gh release create v0.27.0 --target <sha>` with all four attached.
5. **Run 2:** add `binary:` to each block and confirm all four byte comparisons pass.
6. Open the MR using the **App Inclusion** template, with every checkbox addressed. Then leave
   it to review.
