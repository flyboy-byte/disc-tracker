# disc-tracker F-Droid self-hosted repo (D2)

Working directory for the self-hosted F-Droid repo described in
`app/plan/docs/d2-fdroid-portfolio-scope.md`. Built with `fdroidserver`
(`fdroid init` / `fdroid update`).

**Status (2026-08-21): LIVE.** `https://fdroid.flyboybyte.com/fdroid/repo` — real Let's
Encrypt cert (issued 2026-08-21, expires 2026-11-19, auto-renews via Certbot's scheduled
task), HTTP→HTTPS redirect working, `com.disctracker.app` v0.25.0 indexed and downloadable.
Logan added the DNS A record, then `sudo certbot --nginx -d fdroid.flyboybyte.com` on the
VPS issued the cert and rewrote the vhost in place — `nginx-fdroid.flyboybyte.com.conf` in
this directory is that final file, pulled verbatim from the box.

To add a real F-Droid client: add repo `https://fdroid.flyboybyte.com/fdroid/repo`, verify
the fingerprint against `KEYSTORE-INFO.txt` (gitignored, this machine only).

Deploy path for future updates: build+sign a release APK as usual, drop it in
`fdroid/repo/<packageId>_<versionCode>.apk`, `fdroid update`, `fdroid deploy` — rsyncs to
the VPS, no other steps needed (DNS/cert/nginx vhost are already done, one-time setup).

See `KEYSTORE-INFO.txt` (gitignored) for the repo key's fingerprint and passwords.

## What's committed vs. gitignored

- `metadata/*.yml` — **committed.** The actual F-Droid listing text per app (summary,
  description, license, categories, AntiFeatures). This is real content, safe to version.
- `config.yml`, `KEYSTORE-INFO.txt`, `keystore.p12` — **gitignored.** All three either
  are the repo signing key or contain its passwords in plain text. Never commit any of
  them. `config.yml.example` (below) is the non-secret template.
- `repo/` — **gitignored.** Generated output from `fdroid update` (the signed index files
  + the actual APKs). Regenerate it any time; never a source of truth.

## Regenerating

```sh
export PATH="/usr/lib/jvm/java-21-openjdk/bin:$PATH" JAVA_HOME=/usr/lib/jvm/java-21-openjdk
cd fdroid
cp /path/to/app-release.apk "repo/com.disctracker.app_<versionCode>.apk"
fdroid update
```

If `fdroid update` throws `AttributeError: 'NoOverwriteDict' object has no attribute
'append'` during signature scanning, that's a version mismatch between the system
`fdroidserver` package and a separately pip-installed `androguard` — fixed on this machine
2026-08-20 by pinning `pip install --user --break-system-packages androguard==4.1.2`
(4.1.4 is incompatible with fdroidserver 2.4.3's certificate-parsing code path). If `jar`/
`jarsigner` aren't found, that's the JDK 21 bin dir not being on `PATH` — the export above
covers it.

## Setting up fresh (new machine, or a second app added to this repo)

1. `cd fdroid && fdroid init --android-home <sdk path> --keystore keystore.jks --repo-keyalias repokey -d "CN=, OU=, O=, L=, ST=, C=US" --no-prompt`
   (note: despite requesting `keystore.jks`, `fdroid init` writes PKCS12 format as
   `keystore.p12` — update `config.yml`'s `keystore:` path to match what it actually wrote,
   not what was requested.)
2. Write `metadata/<packageId>.yml` for the app (see `metadata/com.disctracker.app.yml` for
   the shape).
3. Drop a signed release APK into `repo/`, named `<packageId>_<versionCode>.apk`.
4. `fdroid update`.
5. Save the printed repo key fingerprint + `config.yml`'s passwords into a gitignored
   `KEYSTORE-INFO.txt`, same shape as this repo's.
