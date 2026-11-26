# Disc scanner: OCR, color and small purpose-built models (2026-11-26)

Status: **research only. Nothing built, installed or run.** Verdicts are recommendations.
**Decided 2026-11-26 (Logan): no LLMs, including vision-language models. OCR and small purpose-built models only.
No model ships in the app; download on opt-in. The plan is `../docs/disc-scanner-scope.md`, which wins over this
file.**

Covers the main GitHub and Hugging Face candidates found by search and by name; it is not every project.

Evidence: **[seen]** read in the source, registry or file on 2026-11-26. **[inferred]** my reading, untested.
Stars and dates are from the GitHub API. Sizes are uncompressed `arm64-v8a` native libraries inside the published
AAR; with `useLegacyPackaging=false` the APK should grow by about that much **[inferred]**. Today's arm64 APK is
about 36 MB.

## Recommendation

| Piece | Pick | New permission | Added size |
| --- | --- | --- | --- |
| Photo input | `expo-document-picker` (already in the app): shoot with the phone camera, pick the photo | none | 0 |
| Color | `expo-image-manipulator` + `fast-png` + our own ~50 lines of color math | none **[inferred]** | small |
| Text reading | Decide by desktop test: Tesseract vs RapidOCR/PP-OCR | none | ~11 MB or ~47 MB, runtime and models |
| Name matching | Own fuzzy scorer over the catalog | none | 0 |
| Image matching | Not now | | |

Build order: quick add, then color, then the OCR test, then OCR in the app only if it passes.

## 1. Existing disc golf scanners

Several repo searches (disc golf scanner / recognition / identification / dataset / detection / OCR) found **no
open-source disc scanner and no disc stamp dataset** **[seen]**. Searches cover names and descriptions, so a hidden
one is possible. Nearest: `hislopzach/disc-tracker` (tracks flights in video), `chinsan-lim/discgolfdiscs` (a disc
profile API). We would be building this ourselves.

## 2. Color

Color fills the disc's color field. It does not identify the mold.

| Option | Stars, license, last push | Notes |
| --- | --- | --- |
| [react-native-image-colors](https://github.com/osamaqarem/react-native-image-colors) | 819, MIT, 2026-10-19 | AndroidX Palette + `androidsvg` **[seen]**, no Google services. Returns whole-image colors, so crop first or grass wins |
| [fast-png](https://www.npmjs.com/package/fast-png) / [upng-js](https://www.npmjs.com/package/upng-js) | MIT | Pure JS PNG decoding for pixel access |
| [culori](https://github.com/danburzo/culori) | 1259, MIT | Perceptual color distance; ~1.1 MB unpacked, more than we need |
| [color.js](https://github.com/color-js/color.js) | 2330, MIT | Same job, same reason to skip |
| [react-native-skia](https://github.com/wcandillon/react-native-skia) | 8794, MIT | Can read pixels; far too heavy for this |

Plan: user centers the disc, crop, shrink to about 64 px, decode, cluster in OKLab or CIELAB, ignore the center
stamp and outer background, snap to the nearest `DISC_COLORS` swatch or keep the custom hex. Lighting, tie-dye and
translucent plastic will need a manual override **[inferred]**.

## 3. Text reading (OCR)

| Option | Stars, license, last push | arm64 size + model | Fit |
| --- | --- | --- | --- |
| [Tesseract4Android](https://github.com/adaptech-cz/Tesseract4Android) 4.9.0 | 951, Apache-2.0, 2026-02-05 | 7.2 MB + 4.1 MB (`eng` fast) | Smallest. Java library from JitPack, so we write the Expo module. Built for document text **[inferred: weak on stamps]** |
| [onnxruntime-react-native](https://www.npmjs.com/package/onnxruntime-react-native) 1.24.3 + PP-OCRv5 models | MIT / Apache-2.0 | 34.7 MB (measured on `onnxruntime-android` 1.32.0) + ~12 MB (det 4.5, English rec 7.4, Paddle format) | Likely better on scene text **[inferred]**. Needs model conversion and our own pre/post-processing |
| [RapidOCR](https://github.com/RapidAI/RapidOCR) | 8637, Apache-2.0, 2026-11-26 | | Ready-made PP-OCR pipeline. Use it for the desktop test |
| [RapidOcrAndroidOnnx](https://github.com/RapidAI/RapidOcrAndroidOnnx) | 119, Apache-2.0 | | Android reference code; last release 2023-02 |
| [react-native-executorch](https://github.com/software-mansion/react-native-executorch) 0.11.1 and [react-native-ocr](https://github.com/software-mansion-labs/react-native-ocr) | 1797 / 6, MIT | | **No.** Postinstall downloads native binaries from GitHub releases **[seen]** (an F-Droid problem **[inferred]**); the OCR package needs Android API 26, we support 24 |
| [react-native-tesseract-ocr](https://github.com/jonathanpalma/react-native-tesseract-ocr) | 594, MIT | | **No.** Last commit 2021, uses old `tess-two` |
| [ncnn-android-ppocrv5](https://github.com/nihui/ncnn-android-ppocrv5), [ncnn_paddleocr](https://github.com/FeiGeChuanShu/ncnn_paddleocr) | 204 / 211, **no license file** | | Don't copy code |
| ML Kit wrappers (`rn-mlkit-ocr` and similar) | | | **No.** Proprietary; F-Droid's scanner list flags `com/google/mlkit` **[seen]** |
| [docTR](https://github.com/mindee/doctr), [EasyOCR](https://github.com/JaidedAI/EasyOCR) | Apache-2.0 | | Python first; test-bench comparisons only |

Curved stamp text is the main risk. A possible fix is to unwrap the ring into a straight strip before reading
(OpenCV polar warp) **[inferred]**.

## 4. Name matching (OCR text to catalog)

OCR output is noisy ("TEEB1RD"), which differs from typed search.

| Option | Stars, license | Verdict |
| --- | --- | --- |
| Own scorer: normalize, swap look-alikes (0/O, 1/I), edit distance + trigrams, bonus when manufacturer also reads | | **Use.** About 1,800 names, pure TypeScript, Jest-testable |
| [uFuzzy](https://github.com/leeoniya/uFuzzy) | 3045, MIT | Good for typed search |
| [Fuse](https://github.com/krisk/Fuse) | 20540, Apache-2.0 | Good general fallback |
| [fuzzysort](https://github.com/farzher/fuzzysort) | 4353, MIT | Typed search |
| `string-similarity` | 2525, MIT, **archived** | No |

Always show the top 3 and let the user tap one. Matching needs a downloaded catalog or custom discs.

## 5. Image matching (recognize the disc without text)

| Option | License | Notes |
| --- | --- | --- |
| [DINOv2](https://github.com/facebookresearch/dinov2) | Apache-2.0 | Best license of the embedding models checked |
| [CLIP](https://github.com/openai/CLIP), [open_clip](https://github.com/mlfoundations/open_clip) | MIT code / mixed | Check each weight's terms |
| [MobileCLIP](https://github.com/apple-aiml-research/ml-mobileclip) | model license is research-only **[seen]** | No |
| [react-native-fast-tflite](https://github.com/margelo/react-native-fast-tflite) + LiteRT | MIT / Apache-2.0 | Smallest runtime, 4.1 MB |
| [react-native-fast-opencv](https://github.com/lukaszkurantdev/react-native-fast-opencv) | MIT | 23.6 MB. Keypoint matching or polar warp |

The blocker is reference images: we have no licensed photos of each mold, and one mold has many stamps. The one
case that needs no outside data is matching a photo against **the user's own** disc photos ("which of mine is
this"). Park it unless that is wanted.

## 6. Camera

| Option | Permission | Notes |
| --- | --- | --- |
| Document picker | none | Two apps to switch between, but free |
| `expo-image-picker` | `CAMERA` required; its code checks it before launching **[seen]** | Also declares storage permissions we block |
| [react-native-vision-camera](https://github.com/margelo/react-native-vision-camera) 5.2.5 | `CAMERA` | Live viewfinder. Core has no ML Kit **[seen]**; barcode support is a separate package. Needs Nitro modules |
| `expo-camera` | `CAMERA` | Pulls ML Kit and Play services by default **[seen]**. `barcodeScannerEnabled: false` makes them compile-only; F-Droid's scanner may still flag the lines **[inferred]** |

Adding `CAMERA` means updating the manifest allowlist, `docs/privacy.html` and `README.md` together.

## F-Droid notes

- `fdroidserver`'s scanner allows Maven Central, Google Maven and JitPack as repositories **[seen]**.
- Its signature list flags ML Kit and Google Play services; my search of it showed no entry for OpenCV, ONNX Runtime,
  LiteRT or Tesseract **[seen]**. That is not reviewer approval.
- Prebuilt native libraries and bundled model files may draw reviewer questions, and any native library can affect
  reproducible builds **[inferred]**. Run a fork pipeline before building features on one.

## 7. The pipeline, one small job per step

| Step | First choice (no model) | Model, only if the test shows a need |
| --- | --- | --- |
| Find the disc | On-screen circle guide | Detector or cutout (section 8) |
| Straighten curved text | Polar unwrap | |
| Find text | | PP-OCRv5 mobile detector (4.5 MB), or Tesseract's own |
| Read text | | Tesseract `eng` (4.1 MB) or PP-OCRv5 English recognizer (7.4 MB) |
| Name the mold | Fuzzy matcher (section 4) | |
| Color | Color math (section 2) | |

## 8. Other small models

Probably unnecessary: an on-screen circle ("fit your disc here") does the cropping for free.

- Detectors: [YOLOX](https://github.com/Megvii-BaseDetection/YOLOX), [NanoDet](https://github.com/RangiLyu/nanodet),
  [D-FINE](https://github.com/Peterande/D-FINE), [RT-DETR](https://github.com/lyuwenyu/RT-DETR) (all Apache-2.0).
  [Ultralytics YOLO](https://github.com/ultralytics/ultralytics) is AGPL-3.0; avoid.
- Cutouts: [MobileSAM](https://github.com/ChaoningZhang/MobileSAM), [U-2-Net](https://github.com/xuebinqin/U-2-Net)
  (Apache-2.0).
- Small recognizers for a trained-in-house reader: [PARSeq](https://github.com/baudm/parseq),
  [OpenOCR](https://github.com/Topdu/OpenOCR) (Apache-2.0). Training needs labeled stamp photos we don't have.
- Embeddings: `dinov2-small` is 84 MB unquantized, Apache-2.0. DINOv3 is gated with a custom license.

## 9. Packaging it as a dependency

Whatever the engine, give it one narrow interface: **photo in; ranked molds, plastic guess and color out.**

| Shape | Camera permission lands on | APK | Cost |
| --- | --- | --- | --- |
| **Local module** `app/modules/disc-scanner`, split to its own repo or package later | Disc Tracker, only if live camera is added | Grows by the runtime | Lowest. **Recommended start** |
| Separate companion app that returns results to Disc Tracker | the companion | Disc Tracker unchanged | Second app ID, F-Droid MR and release cycle; user installs two apps |

The engine ships inside the APK; model files download on opt-in, after which scanning works offline.

F-Droid **[seen]**: the inclusion policy allows prebuilt FLOSS binaries from trusted Maven repositories.
`space.subread.app` on `master` (2026-11-26) ships a small speech model inside the app, with a `scanignore` and a
documented origin; do the same for any model file **[inferred]**.

## 10. Permissions, plainly

1. **Now:** none new. The user shoots with the camera app and picks the photo. No storage permission either.
2. **Later:** `CAMERA` for a live viewfinder. Android asks only when the user taps Scan, and declining should leave
   everything else working. Disclose it in the privacy page and README.
3. **Never needed** for any option here: microphone, location, broad storage.

## Next directions

1. `v0.29.0` as scoped.
2. Quick add and color fill (no new permission).
3. Desktop test below. It decides whether there is a scanner and which engine.
4. If it passes: local module, photo picker first, live camera later.

## Next step: desktop test (no app changes)

1. Logan photographs about 30 owned discs, straight on, in normal light. Include worn, foil and custom stamps.
2. Run Tesseract and RapidOCR on a computer, each with and without polar unwrap; match with the scorer in section 4.
3. Gate, fixed in advance: **right mold in the top 3 for at least 70%** of photos. Below that, no scanner. If both
   pass, prefer Tesseract unless RapidOCR is at least 15 points better.
4. Score color on the same photos.
5. Photos and the catalog stay out of git.
