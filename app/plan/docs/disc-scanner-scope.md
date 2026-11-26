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

- **Don't push any tag from `dev`.** The recipe has `UpdateCheckMode: Tags` with no pattern, and `checkupdates.py`
  takes the latest 5 tags from any branch and picks the highest versionCode (read 2026-11-26). A beta tag could
  become an official release. Betas first need an fdroiddata MR adding a pattern such as `Tags ^v[\d.]+$`
  (drag-tree has `^v[\d+.]+$`). Needs Logan.
- `v0.29.0` (`post-merge-scope.md`) ships from `main`. Merge `main` into `dev` after each release or fix.
- Merge `dev` to `main` only with phase gates passed and Logan's OK.
- CI runs on pushes to `main` and `dev`.
- **Testing `dev` on the phone (proposed):** a debug build with its own application ID suffix, so it installs beside
  the F-Droid app and leaves its data alone. A local build on the real ID can't be followed cleanly by official
  updates.

## Open decisions (default applies unless Logan says otherwise)

| # | Question | Default |
| --- | --- | --- |
| 1 | Model host | The VPS |
| 2 | Size budget | +10 MB arm64 |
| 3 | Separate ID for dev builds | Yes |
| 4 | First release from `dev` | S1 and S2 as `v0.30.0`; font scaling moves to `v0.31.0` |
| 5 | Live camera | Later, asked separately |
