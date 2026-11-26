# Handoff (written 2026-11-26 18:33 UTC, replace each time)

Branch `dev`. The plan is `disc-scanner-scope.md`; this file is the session's leftovers.

## Waiting on Logan

1. Try `v0.29.0-beta.1` on the phone ("Phone check for beta.1" in the scope doc). 0 downloads when written.
2. About 30 disc photos in `scan-photos/` (empty when written). They start S0.

## Next work that needs neither

- S1 quick add (not started). Ship it as `v0.29.0-beta.2` with `app/scripts/publish-beta.sh 0.29.0 2 --publish`.
- `post-merge-scope.md` 1.2 empty states and 1.3 Delete-all placement (not started).
- Say so before publishing a beta: it goes onto Logan's real app and data.

## Last observed (2026-11-26 18:33 UTC)

- F-Droid: build logs 291 and 292 returned 404; listing API `{"error":"NOT_FOUND"}`. Phase 0 of the post-merge scope is
  still open (watch the first build; foojay question).
- CI: App CI green on `dev` `fc15cfa` and `d8b664d`. `main` is `322bc70`; `dev` contains it.
- `fdroid checkupdates` with the beta tag present: `Latest tags: v0.29.0-beta.1,v0.28.1,…` then `...up to date`.

## Tool notes

- To re-run that check: in an empty folder put the upstream recipe in `metadata/`, add an empty `config.yml`
  (mode 600), `git init` and commit (it refuses a dirty or non-git folder), then
  `fdroid checkupdates -v com.disctracker.app`.
- The beta script clones `origin/dev` into `~/.cache/disc-tracker-beta/` (build about 12 min on this machine; the APK
  stays in `out/`).
- `fdroidserver` reads the latest 5 tags from any branch.

## Not done, needs an OK

- Toolbox `fdroid` skill update (public repo): items in the assessment, section 3, once a build log exists; also add the
  beta method and the local `checkupdates` check.
- `post-merge-scope.md` Phase 2: Azeem message, self-hosted repo, website disc data, old APK assets.
- GitLab token returned 401 on 2026-11-26 (`glab auth login`) before any MR work.
