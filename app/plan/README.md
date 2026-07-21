# Disc Tracker Mobile Port — Plan Packet

**Start at [`FRAMEWORK.md`](./FRAMEWORK.md)** — it tracks what phase this project is
actually in and what has to happen next. This README is the doc index; `FRAMEWORK.md` is
the status tracker and the thing worth re-opening after time away.

An Android (and eventually F-Droid) app for the same disc-golf bag tracker that runs at
`51.81.80.126` — local-first SQLite instead of hitting the Flask server, single-user,
no accounts, no cloud, no ads. The detailed build plan is
[`../PORT_PLAN.md`](../PORT_PLAN.md); the architecture/toolchain research is
[`../RESEARCH.md`](../RESEARCH.md). This packet is a framing layer above both — the
"is this worth doing this way, what could go wrong, what's still open" view that
PORT_PLAN.md's phase list doesn't itself carry.

## Contents

| Doc | Tier | Purpose |
| --- | --- | --- |
| [`FRAMEWORK.md`](./FRAMEWORK.md) | Meta | Phase-gated status tracker — where this project actually is and what's next |
| [`docs/documentation-guide.md`](./docs/documentation-guide.md) | Meta | Explains the tiers below, who each doc is for, and how they fit together |
| [`docs/overview.md`](./docs/overview.md) | High-level | What it is, who it's for, why it exists, what it's explicitly not |
| [`docs/approach.md`](./docs/approach.md) | High-level | Is this worth doing this way — alternatives considered, tradeoffs |
| [`docs/infrastructure.md`](./docs/infrastructure.md) | Low-level | What you actually need to stand this up — tools, stack, constraints |
| [`docs/risks.md`](./docs/risks.md) | Mixed | Scope, dependency, legal, technical, and operational risks with mitigations |
| [`docs/notes.md`](./docs/notes.md) | High-level | Open questions, sequencing calls, naming — working scratchpad |
| [`docs/research-handoff.md`](./docs/research-handoff.md) | Meta | Workflow for offloading unverified claims to Claude/ChatGPT deep research |
| [`research/`](./research/) | — | Intake folder for raw output from those research sessions |
| [`../PORT_PLAN.md`](../PORT_PLAN.md) | Low-level (external) | The actual phased build plan, parity fixtures, per-phase deliverables |
| [`../RESEARCH.md`](../RESEARCH.md) | Low-level (external) | Framework/toolchain decisions, sync design, F-Droid notes |

## How to use this packet

1. Read `docs/overview.md` first for the framing.
2. Read `docs/approach.md` and `docs/risks.md` together — they're the go/no-go inputs.
3. `docs/infrastructure.md` is what it costs (in setup effort) to actually build.
4. `docs/notes.md` is the working scratchpad of decisions still open.
5. When a doc flags a claim as unverified, check `docs/research-handoff.md`.
6. For the actual step-by-step build work, go to `../PORT_PLAN.md` — this packet frames
   the project, PORT_PLAN.md executes it.

Everything here is reasoning from the source material plus general priors — the one
piece that hasn't been validated against reality yet is the Phase 3 SQLite layer on a
real device (see `FRAMEWORK.md`).
