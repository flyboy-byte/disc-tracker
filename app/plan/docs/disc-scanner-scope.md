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
- **No tags in this repo while testing.** The recipe has `UpdateCheckMode: Tags` with no pattern, and
  `checkupdates.py` takes the latest 5 tags from any branch and picks the highest versionCode (read 2026-11-26).
  GitHub releases create tags, so no releases or pre-releases here either.
- Merge `main` into `dev` after any fix on `main`. Merge `dev` to `main` only with phase gates passed and Logan's OK.
- CI runs on pushes to `main` and `dev`.

## Test builds (decided 2026-11-26; pipeline not built yet)

Test builds are published from a **separate repository**, `flyboy-byte/disc-tracker-dev` (**does not exist yet**).
F-Droid only reads this repository, so nothing there can reach it, and the recipe needs no change.

| Part | Choice |
| --- | --- |
| App ID and name | `com.disctracker.app.dev`, "Disc Tracker Dev"; installs beside the F-Droid app |
| Signing | A new dev-only key outside the repo. The release key is not used |
| Build | Release mode with R8, `arm64-v8a` only |
| Version | `<next>-dev.N`; versionCode counts up from 1 and is unrelated to official codes |
| Script | `app/scripts/publish-dev-build.sh`: fresh clone of a pushed `dev` commit, `npm ci`, prebuild, change ID and name in the generated `android/`, build, sign, release |
| App source | Unchanged. The ID exists only in the throwaway build |
| Install and updates | GitHub release APK; [Obtainium](https://github.com/ImranR98/Obtainium) can watch the repo for updates. Publish as normal releases |
| Source (GPL) | Each release names the `dev` commit it was built from |

- The dev app starts empty. Export a backup from the real app and restore it into the dev app; the real app's data is
  never touched.
- This does not test updating over the official app. The runbook's signed Run 1 phone test still does, before any
  official release.
- Rejected: beta tags here (drag-tree's way) need an fdroiddata MR first, and a test build on the real ID with a
  higher versionCode would block official updates on the phone.

## Test photos (S0)

Put them in `scan-photos/` at the repo root. It is gitignored: discs often carry a name and phone number, and photos
can carry location data. About 30 discs, straight on, disc filling the frame, normal light, including worn, foil and
custom stamps. Name each file after the disc, for example `innova-teebird.jpg`.

## Open decisions (default applies unless Logan says otherwise)

| # | Question | Default |
| --- | --- | --- |
| 1 | Model host | The VPS |
| 2 | Size budget | +10 MB arm64 |
| 3 | Dev repository visibility | Public (Obtainium needs no token) |
| 4 | Live camera | Later, asked separately |
