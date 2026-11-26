# Disc scanner: scope (2026-11-26)

Status: **scoped, nothing built.** Lives on branch `dev`. Option research and sources:
`../research/scanner-options-2026-11-26.md`. "Proposed" marks a default Logan hasn't confirmed.

## Decided (Logan, 2026-11-26; don't re-ask)

- No LLMs, including vision-language models. OCR and small purpose-built models only.
- **No model ships in the app.** Models download only if the user opts in.
- Work happens on `dev`, as on drag-tree.

## What "download as needed" can and can't cover

Model files can be downloaded. The engine that runs them is native code, and we ship that inside the APK; we don't
download code. So every user carries the engine, opted in or not.

| Engine | Added to every arm64 APK | Opt-in download |
| --- | --- | --- |
| Tesseract | about 7 MB | 4.1 MB (`eng` fast) |
| PP-OCRv5 on ONNX Runtime | about 35 MB | about 12 MB in Paddle format; converted size not measured |

Sizes are estimates from the published libraries and model files. Today's arm64 APK is about 36 MB.

**Size budget (proposed, fixed before testing): the scanner adds at most 10 MB to the arm64 APK.** Tesseract fits.
If only PP-OCR passes the accuracy gate, stop and ask: accept the size, or put the scanner in a companion app.

## Design

```
photo (document picker) -> circle crop -> color
                                      \-> unwrap -> OCR engine + model -> matcher -> top 3 -> quick add
```

- **Interface:** photo in; up to 3 molds, plastic guess and color out. The user always confirms. Nothing is saved
  without a tap.
- **Code:** pure TypeScript (color, matcher, download manager) in `app/src/scanner/`; native OCR in the local Expo
  module `app/modules/disc-scanner/`. Can become its own package later.
- **Without a model:** color fill and quick add still work. Scan explains what the download is and offers it.
- **Matching** needs a downloaded catalog or custom discs; say so when there is neither.

### Model download

- Host: `https://disc.flyboybyte.com/scanner/manifest.json` (**proposed; does not exist yet**). Not GitHub releases
  (each creates a tag, see below) and no third-party host.
- Manifest: model id, version, engine, license, source URL, and per file `url`, `bytes`, `sha256`.
- Same fail-closed pattern as `src/catalog/catalogSync.ts`: temporary file, verify hash, then move into place. That
  code reads text, so binary files need their own download and hash path.
- Nothing is fetched until the user taps. The screen shows size, source and license; declining is as easy as
  accepting. Settings shows the installed model with a delete button. Updates are manual, like the catalog.
- The app accepts only the model versions it was built for.
- Models are left out of backups.
- Photos are processed on the phone, never uploaded, and the app's copy is deleted after the scan.

### F-Droid

- No new permission until the live camera (S7). Update `docs/privacy.html` and `README.md` when the download ships.
- Use freely licensed models and record origin and any conversion script. That should avoid `NonFreeAssets`
  (inferred; a reviewer decides).
- Tesseract4Android comes from JitPack, which the inclusion policy allows. It cancels the parked "remove the jitpack
  repo" cleanup.

## Phases

| # | Work | Gate to pass | Needs Logan |
| --- | --- | --- | --- |
| S0 | Desktop test; matcher written in TypeScript with Jest tests | Right mold in the top 3 for **at least 70%** of photos. Prefer Tesseract unless PP-OCR is 15+ points better | about 30 disc photos |
| S1 | Quick add: one search box, tap to add, stay open | Faster than today's form on a phone | phone |
| S2 | Photo pick, circle crop, color fill (`expo-image-manipulator`, `fast-png`) | Color right on most of the S0 photos | |
| S3 | Download manager and opt-in screen | Bad hash, no network and cancel all leave the app unchanged | VPS hosting |
| S4 | Native OCR module and engine | Fork F-Droid pipeline builds it; rebuild matches; size within budget | OK to push the fdroiddata fork branch |
| S5 | End to end on real discs | S0 gate again, on the phone | phone |
| S6 | Live camera (`CAMERA`) | separate decision | yes |

S1 and S2 don't depend on S0 and ship even if the scanner is dropped. S0 failing drops S3 to S6.

## Branch and release rules

- **No official update is planned yet** (Logan, 2026-11-26). The false first-run prompt (`post-merge-scope.md`, 1.1)
  stays in the published app until one ships; fix it on `dev` too.
- Tags are for betas only until an official release (see "Test builds").
- Merge `main` into `dev` after any fix on `main`. Merge `dev` to `main` only with phase gates passed and Logan's OK.
- CI runs on pushes to `main` and `dev`.

## Test builds (decided 2026-11-26, drag-tree's method; script not written yet)

GitHub **pre-releases in this repo**, tagged on `dev`, installed over the real app.

**The one rule that keeps F-Droid out of it:** the committed version stays at the current official one (`0.28.1`,
`versionCode 29` in `app.json`, `package.json`, `android/app/build.gradle`). The beta version is set **only in the build
clone, never committed.** F-Droid's `checkupdates` then computes 292, equal to the current version, and does nothing
(`checkupdates.py` read 2026-11-26; drag-tree ran five betas and a release candidate this way, per its `PLAN.md` and
tags). Bump the committed version only for a real official release.

| Part | Choice |
| --- | --- |
| Tag and name | `v0.29.0-beta.N`, marked pre-release |
| versionCode | 293 to 300: above the installed 292, below the next official 301. After 300, reuse it |
| App ID and key | Same as official (`com.disctracker.app`, release key, cert `ff739cf5…837a`) |
| Build | Release mode with R8, `arm64-v8a` only |
| Script | `app/scripts/publish-beta.sh`: fresh clone of a pushed `dev` commit, **refuse unless its committed versionCode is the official one**, set the beta version in the clone, `npm ci`, prebuild, build, sign, verify cert, `gh release create --prerelease --target <sha>` |

- Signing values are read by the script and never printed (`~/projects/drag-tree/android/local.properties`).
- **Back up in the app before the first beta.** It runs on your real data, and going back to an older version means
  uninstalling.
- The next official release (301/302) installs over any beta.

## Test photos (S0)

Put them in `scan-photos/` at the repo root. It is gitignored: discs often carry a name and phone number, and photos
can carry location data. About 30 discs, straight on, disc filling the frame, normal light, including worn, foil and
custom stamps. Name each file after the disc, for example `innova-teebird.jpg`.

## Open decisions (default applies unless Logan says otherwise)

| # | Question | Default |
| --- | --- | --- |
| 1 | Model host | The VPS |
| 2 | Size budget | +10 MB arm64 |
| 3 | Live camera | Later, asked separately |
