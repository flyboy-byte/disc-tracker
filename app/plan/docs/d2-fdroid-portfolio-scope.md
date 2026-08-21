# D2 Scope — Self-Hosted F-Droid Repo, Across the Whole Android Portfolio (2026-08-20)

> **Tier:** High-level (decision-maker) · **Audience:** Logan, deciding whether/when/which
> app to start D2 with · **Use when:** before actually standing up a self-hosted F-Droid
> repo for any app. Lives in disc-tracker only because this is the active session's repo
> — the content itself is cross-project, not disc-tracker-specific. Move or copy it
> wherever makes sense once a real decision is made.

This is scoped one level above `fdroid-reference.md` (which is build-mechanics detail for
*disc-tracker specifically* going through D3). This doc is "what is D2, what does it cost
once vs. per-app, and which of the apps in `~/projects/` are actual candidates" — a
decision doc, not an implementation runbook.

## What D2 actually is

A self-hosted F-Droid repo is a directory of index files (`index-v1.json`/`index-v2.json`,
`entry.jar`) plus the APKs themselves, all signed by **one repo key** (distinct from any
app's own APK signing key), served as plain static files over HTTPS. Any F-Droid client
(the F-Droid app, Droid-ify, etc.) can add it via "Add repository" with the URL + the
repo's fingerprint. Built with `fdroidserver`:
- `fdroid init` — one-time, generates the repo signing key + keystore.
- `fdroid update` — regenerates the index whenever a metadata file or APK changes.

**Much lower bar than D3.** No external reviewer, no reproducible-build requirement, no
`Binaries:` byte-matching against F-Droid's own build server. You build a normal signed
release APK yourself (exactly what already happens for every GitHub Release today), drop
it into the repo directory, write one `metadata/<packageId>.yml` (summary, description,
license, source URL, categories, `AntiFeatures:` if any), run `fdroid update`. Everything
in `fdroid-reference.md` about reproducible builds, `Binaries:`, ABI splits, and reviewer
requirements is **D3-specific** — none of it gates D2. Worth doing anyway where cheap
(it's real prep for D3), but nothing here should be treated as blocking D2.

## Shared, one-time infra (pays for every app that joins later)

- **One repo signing key**, generated once via `fdroid init`. Treat it like any other
  production keystore — it's a new one-way-door credential, separate from each app's own
  upload key, and losing it means every app in the repo needs users to manually
  re-trust a new fingerprint.
- **One hosting location.** Matches the existing pattern of per-service VPS subdomains
  already running on `51.81.80.126` (`disc.flyboybyte.com` for the catalog,
  `transcribe.flyboybyte.com`, `golf.flyboybyte.com`) — a natural
  `fdroid.flyboybyte.com` (or similar) nginx-served static directory on the same box.
  No new server, no new provider — this is the same shape of thing already running.
- **`fdroid update` as a manual or lightly-scripted step** — run locally, rsync the
  `repo/` output up, or a small cron job on the VPS. No CI needed to start; automation is
  an optimization for later, not a prerequisite.
- **One repo-level icon/description** ("Logan's apps" or similar) — shown in F-Droid
  clients when someone adds the repo URL.

## Per-app requirements (each app pays this individually before it can join)

A signed release APK (already the normal GitHub Release artifact for these apps), a
`metadata/<packageId>.yml`, an app icon, and — recommended but not required for D2 itself
— a Fastlane-format `fastlane/metadata/android/en-US/` listing folder (summary,
full description, changelog per version, screenshots). Worth doing once per app even for
D2 alone, since it's also exactly what D3's "strongly recommended" checklist item wants
(see `fdroid-reference.md`'s MR checklist section) and what a future Play Store listing
needs too.

## Candidate apps and current readiness

### disc-tracker (this repo) — DEPLOYED (2026-08-20), pending DNS

**D2 is done except for one step only Logan can take.** Repo key generated
(`fdroid init`), `com.disctracker.app` v0.25.0 built/signed/indexed, `fdroid deploy`
rsynced it to `/var/www/fdroid.flyboybyte.com/fdroid/repo` on the VPS, a matching nginx
vhost is live and verified (real signed index + working APK download over plain HTTP,
confirmed via `curl -H "Host: fdroid.flyboybyte.com" ...` against the VPS IP directly,
since DNS isn't there yet). Full detail in `fdroid/README.md` and
`fdroid/KEYSTORE-INFO.txt` (both in this repo — the latter gitignored).

**Blocked only on:** `fdroid.flyboybyte.com`'s DNS A record (Spaceship registrar — no
API/token reachable from this environment). Once added, `sudo certbot --nginx -d
fdroid.flyboybyte.com` on the VPS finishes it (issues the cert, rewrites the vhost with
the HTTPS block + redirect, identical to every other vhost on that box).

- `com.disctracker.app` · GPLv3 · Expo/RN, no EAS.
- A signed release APK already exists as a normal workflow (`./gradlew assembleRelease`
  + `gh release create`, done for every `vX` tag so far) — nothing new required to
  produce the artifact D2 actually needs.
- **AntiFeatures to declare:** `NonFreeNet` for the opt-in Marshall Street/DiscIt
  reference-image lookup (third-party network service, off by default) is the clear one.
  Whether the opt-in Try Discs catalog download also needs a tag is a judgment call —
  it's third-party *data*, not a live network service the running app depends on by
  default, but worth deciding deliberately rather than skipping the question.
- **Not a D2 blocker, but flagged anyway:** the `versionCode`/signing/minify-flags
  durability gap found this session (`fdroid-reference.md`'s "Config-plugin durability"
  section) only matters for D3's from-source rebuild — D2 just uses the APK you already
  built and signed yourself, so this doesn't block D2 at all. Still worth fixing before
  D3, just not gating D2.

### drag-tree — already past D2-equivalent readiness, mid-D3

Already has a signed, reproducible release and is one merge away from the *official*
F-Droid index (MR #41671). Could also be dropped into a self-hosted D2 repo in parallel —
not harmful, but worth a deliberate decision rather than a default: running the same app
through both a self-hosted repo and the official index gives users two install sources
with potentially different update cadences. Decide this once the D3 MR actually merges,
not speculatively now — the answer may become obvious then (e.g. "D2 was training wheels,
drop it once D3 lands").

### focusfence — not ready yet

No signed release has shipped at all — `FRAMEWORK.md` Phase 5 ("Formalize") is still
open: signing-key custody undecided, no GitHub Release cut yet. F-Droid inclusion is
itself still an open decision in that project's own docs ("Decide whether F-Droid is
wanted"), and it's co-owned with @sidewinderzz — not a call to make unilaterally from
here. Native Kotlin/Gradle, not Expo/RN, so none of the Expo-specific reproducibility
gotchas in `fdroid-reference.md` would apply if it ever pursues D3 — but that's moot until
it ships a first release at all.

### Not candidates

`mini-golf`, `budget`, `foss-radar`, `trans` — not Android apps (F-Droid only distributes
Android APKs). `jesse-project` — hardware/ESP32, not applicable.

## Recommended sequencing

1. Stand up the shared repo infra once (repo key, VPS subdomain, `fdroid init`) — no
   app-specific work required to do this step.
2. Add disc-tracker first — closest to ready today, and the metadata/AntiFeatures work
   doubles as real prep for its own eventual D3.
3. Decide drag-tree's dual-listing question once its D3 MR actually merges — don't
   decide it speculatively before that's real.
4. Revisit focusfence once it ships a first signed release and the F-Droid question is
   actually decided there — not blocked on this doc, just not ready to act on yet.
