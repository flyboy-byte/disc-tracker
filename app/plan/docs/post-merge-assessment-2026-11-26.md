# Post-merge assessment (2026-11-26)

F-Droid MR [!52998](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/52998) was merged by linsui on
2026-11-25 (upstream `17f713b5b6`). Checked 2026-11-26: recipe on upstream `master`; no build log yet for 291 or
292; f-droid.org listing 404. Evidence marks: **[seen]** checked, **[inferred]** my reading.

## 1. Fix first: the published app shows a false prompt

`app/app/_layout.tsx:31` still shows on first launch: "Try Discs offers an expanded catalog (1,874 discs vs. the
built-in 1,660)". There has been no built-in catalog since v0.28.0, so every fresh F-Droid install sees a false
claim. **[seen]** in the code, not run on a phone. The v0.28.0 change missed it, and the later "no first-run prompt exists" gap note was wrong.
The prompt is still opt-in, so no privacy problem. Fix: reword it to say the app has no disc list and offers the
download. Stale comments say "bundled" in `_layout.tsx`, `index.tsx:120`, `catalogLoader.ts`.

## 2. Why the recipe went through

| What | Evidence |
| --- | --- |
| Started from drag-tree's accepted recipe + the RN template; each earlier reviewer request mapped before opening | `fdroid-submission.md`, R1–R12 table |
| Reference APKs were F-Droid's own unsigned output, signed by us | Run 2 verified on v0.27.0, v0.28.0, v0.28.1 |
| Permissions, privacy text, fastlane, version footer fixed before opening | privacy audit, CI manifest allowlist |
| Anything prebuild wipes lives in config plugins | `withAllowBackupDisabled`, `withR8Release` |
| Data of unclear provenance dropped before anyone asked | v0.28.0 |
| One reviewer ask ("enable R8"), answered next pipeline with a link | MR thread through 2026-10-27 |
| Flat npm, so plain `node_modules` paths | R5 |

Not smooth: Run 1 took 5 attempts (Expo 57 differences); R8 was silently off; the prompt above got through every
check because nobody ran a fresh install. Merge took about 5.5 weeks, mostly waiting. Comments after 2026-10-27
were not read (GitLab token returned 401). Whether foojay matters is still open.

## 3. Toolbox (`toolbox/skills/fdroid`): yes, update it, after the 291/292 build log exists

1. `casebook.md` Case B: merged, dates, one reviewer ask. Remove "its real build would fail" (never observed).
2. Foojay: the skill states the offline server fails without the sed, and `check-recipe.py` FAILs on it. What was
   seen: a maintainer added it to drag-tree. Counter-evidence **[seen]**: `com.scalepractice` (log 2026-10-07) and
   `jp.nonbili.nori` (2026-11-21, RN 0.88) built on the real server without it. Only 4 of 43 upstream
   `expo prebuild` recipes mention foojay. Drag-tree pins foojay 0.5.0, this app 1.0.0 (local `node_modules`);
   whether that matters is **[inferred]**. Downgrade to WARN unless our log shows a toolchain failure.
3. Build logs: `https://monitor.f-droid.org/builds/log/<appid>/<code>` works (HTML); adding `.log.gz` is a 404.
4. Expo 57 notes from our attempt log: `autolinking_implementation.gradle` scanignore no longer applies;
   generated `gradle.properties` has no trailing newline (use `echo -e '\n…'`); `view-shot`, `masked-view`, `svg`
   `build.gradle` scanignores; reanimated/worklets JDK sed.
5. New rule: after removing a feature or data, grep user-facing strings and do a fresh-install first launch
   before tagging.
6. Calibration: new app, ~38 days open to merge.

## 4. Parked, deferred and open ideas

Verdicts are recommendations; Logan decides.

### Do next
| Item | Why now |
| --- | --- |
| First-run prompt (section 1) | False text in a published app |
| Fresh-install pass + backup/restore/CSV on the R8 build | Never reported as tested |
| Empty states: Disc Suggest, autofill, library with no catalog | Every new user starts empty |
| Azeem check-in (owed before store submission) | Overdue; also tell them about the Kaggle lineage |
| Self-hosted F-Droid repo serves `0.25.0` (code 25) **[seen]** | Old build with the Kaggle data; update or remove. Official codes (291/292) are higher |

### Worth doing soon
| Item | Note |
| --- | --- |
| A4 font scaling | Only P0 left; no `allowFontScaling`/`maxFontSizeMultiplier` in the code |
| F5 Delete-all placement, B2 Clear-bag styling | Cheap; do together |
| Website `static/discs_master.json` (served by `app.py:530`) and the `v0.27.0` release assets | Same data you removed from the app; deleting needs Logan's OK |
| Android ≤12 backup with storage permissions blocked | Needs an old device or emulator |

### Keep parked
| Item | Trigger to revisit |
| --- | --- |
| B4 multiselect hint / exit | A user hits it |
| C4/F4 trim explainer text | While editing those screens |
| F6 Settings micro-labels | Same |
| Open default dataset | A simple, clearly licensed one turns up; load in `masterLibrary.ts` |
| Wind slider in Disc Suggest (what survives of C2) | A user asks |
| foojay sed | Real build fails on it |
| Track E website tests | Website changes again |
| iOS | A real reason and a Mac |
| jitpack repo removal (privacy audit) | Next build-config change |
| R6 Play Store | Only if Logan raises it |

### Close
| Item | Why |
| --- | --- |
| D1 emoji icons | Already shipped 2026-08-31 (`14def75`); the leftover list was wrong |
| Physics V2 | Obsolete since the on-device sim |
| R5 sync and its pre-submission checklist | Dropped |
| C1, C2, C3–C6 | Graveyarded; a fresh pitch would need a new reason |

Not re-verified on device: older "not yet verified" notes in `suggest-swipe-scope.md` and PORT_PLAN (B5).

## 5. Direction

The app is in a public index, so the next risk is first impressions and update safety, not missing features.

1. **v0.29, "first user":** prompt, empty states, F5/B2, backup test on a phone. Ship it as the first auto-update
   and prove that path end to end.
2. **Cleanup:** Azeem, self-hosted repo, website data, old release.
3. **v0.30:** A4 font scaling.
4. **Then stop and listen.** 0 stars, a few downloads per release and no open issues on 2026-11-26, so there is
   no user signal yet. Pick the next feature from an issue or from your own rounds, not from the old C-series.

Release in batches: each one costs a two-run F-Droid cycle and can break reproducibility. Avoid dependency
bumps in the same release as features.
