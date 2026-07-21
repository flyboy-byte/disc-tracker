# Research Handoff Workflow

> **Tier:** Meta (process doc) · **Audience:** you, during the scoping/validation
> phase · **Use when:** a doc in this packet has a claim marked unverified/inferred that
> needs real citations, current facts, or legal/licensing specifics — things a coding
> agent shouldn't fabricate.

## Why this exists

Everything written so far in this packet is reasoning from the source material plus
general priors — there's no live verification behind it except where explicitly noted
otherwise. The right tool for closing those gaps is a **deep research engine with live
web access** (Claude.ai research mode, ChatGPT research mode) run by you in the browser
— not this coding session, which shouldn't be the tool of record for claims that need to
be traceable, current, and citable later.

## What qualifies for handoff

Something is a good handoff candidate if it's **externally verifiable** (a real answer
exists somewhere on the web, in a license, or in a platform's policy) and **not
something this session should guess at**. Internal decisions (which architecture to use,
what to name something) are not handoff candidates — those are judgment calls, not
research questions, and belong in `notes.md` as decisions, not delegated out. Similarly,
questions that need *primary* research (running a real test, trying it on a real device)
are not handoff candidates either — those belong in `FRAMEWORK.md`'s Validation phase as
an action item.

## Current handoff queue

Pulled directly from open items flagged in the other docs. Update this table as items are
resolved or new ones come up.

| # | Question | Source doc | Suggested engine | Why that engine |
| - | -------- | ---------- | ----------------- | ---------------- |
| 1 | What's the current, realistic state of F-Droid's reproducible-build acceptance for Expo/React Native apps built with local Gradle (not EAS) — has any RN app achieved a full byte-match, and what does a reviewer actually accept short of that? | `approach.md`, `risks.md` | Either | Needs current, citable info from F-Droid's own docs/issue tracker/forum discussions — a fast-moving, narrow technical-policy question well suited to either engine's web search. |
| 2 | What does Play Console's Data Safety form currently require for an app that makes zero network calls and collects zero data (fully local-only, no accounts)? | `infrastructure.md`, `risks.md` | Either | Current Play Console policy specifics change over time and need a live, dated source rather than training-data recall. |
| 3 | Is `expo-sqlite`'s current API (SDK 57-era) stable enough across recent Expo SDK versions that this project's `withExclusiveTransactionAsync`-based design won't need rework on the next SDK bump? | `infrastructure.md` | Claude | Framework/library-specific behavior question — favors an engine with strong access to current Expo/RN documentation and changelogs. |
| 4 | What's the actual origin/license of `discs_master.json` (the bundled 1,660+ disc library), and is redistributing it inside a public Play Store/F-Droid app clearly fine? | `risks.md` | Either | Needs a real check against wherever the data was originally sourced — not something to infer from the file itself. |

## Handoff procedure

1. **Pick one row** from the queue above — don't batch multiple unrelated questions into
   one research session; it dilutes the result and makes sourcing harder to track.
2. **Write the prompt** using the template below and run it in the browser, at
   claude.ai (research/deep research mode) or chatgpt.com (deep research mode) per the
   suggested engine column. Ask for citations/sources explicitly — an answer without a
   source is not more trustworthy than what's already in these docs.
3. **Save the raw output** into `research/` before doing anything else with it — keep the
   source material even after you extract a summary.
4. **Merge findings back** into the originating doc: replace the "unverified/inferred"
   language with the finding, and add a citation line pointing at the saved file in
   `research/`. Don't delete the fact that it was once unverified — just update the
   status; the audit trail of what was assumed vs. confirmed is useful later.
5. **Update this queue** — mark the row resolved (or strike it) and add any new questions
   the research surfaced.

## Prompt template

```
I'm scoping a project: {{one or two sentences describing the project and its
context}}.

Research question: {{paste the question from the handoff queue table}}

Please answer with current, sourced information — include links or citations for every
claim, note publication/last-verified dates where relevant, and flag anything that's
opinion/estimate rather than sourced fact.
```

## `research/` folder structure

Raw research session output gets saved as:

```
research/
  YYYY-MM-DD-<short-topic-slug>-<engine>.md
```

Each file should start with the exact prompt used, the engine and date, then the raw
response. Don't edit the raw response after saving — corrections/updates go in the doc
that consumes it, not in the source research file.
