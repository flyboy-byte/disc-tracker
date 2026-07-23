# Documentation Guide

> **Tier:** Meta (about the docs themselves) · **Audience:** anyone new to this packet,
> including future-you after time away · **Use when:** you don't know which doc to open,
> or you're adding a new doc and need to decide where it fits.

This packet has two altitudes. Knowing which altitude you're reading (or writing) at
prevents the two failure modes that hit project-planning docs specifically: framing
material that's all vision and no way to actually build the thing, and build docs that
bury the "is this worth doing this way" question under implementation detail.

## The two tiers

### High-level — the decision layer

**Question it answers:** *Should this exist, and is this the right way to build it?*
**Written for:** the person deciding whether/how to pursue this.
**Properties:** short enough to read in one sitting, states conclusions and open
questions plainly, doesn't require deep technical literacy to follow.

| Doc | What it's for |
| --- | --- |
| [`overview.md`](./overview.md) | What it is, who/what it's for, why it exists |
| [`approach.md`](./approach.md) | Is this worth doing this way — alternatives, tradeoffs, validation plan |
| [`notes.md`](./notes.md) | Live scratchpad of open decisions |
| [`risks.md`](./risks.md) *(scope/legal sections)* | What could derail this and why |

### Low-level — the build layer

**Question it answers:** *Given we're doing this, how does it actually get built and run?*
**Written for:** whoever is implementing. Assumes the high-level case has already been
read — doesn't re-argue the framing.
**Properties:** specific enough to act on directly.

| Doc | What it's for |
| --- | --- |
| [`infrastructure.md`](./infrastructure.md) | What tools/stack/constraints to actually work within |
| [`risks.md`](./risks.md) *(technical/operational sections)* | What breaks in practice and how it's guarded against |
| [`fdroid-reference.md`](./fdroid-reference.md) | F-Droid submission playbook distilled from DragTree's real, completed submission — relevant at D2/D3, not before |

| [`../PORT_PLAN.md`](../../PORT_PLAN.md) | The actual phased build plan (Phases 0–8 + distribution track), parity fixtures, per-phase deliverables — lives one directory up, outside this packet |
| [`../RESEARCH.md`](../../RESEARCH.md) | Framework/toolchain decisions, sync design, F-Droid notes — same, one directory up |

## How the tiers relate

`PORT_PLAN.md` and `RESEARCH.md` came first — they're the real build plan and existing
architecture research, and this packet was built by reading both in full. This packet
adds the framing layer they didn't have (is this worth doing, what could kill it, what's
still genuinely open) without duplicating their build-step detail. Read this packet
top-down if you're re-orienting after time away or deciding priorities; go straight to
`../PORT_PLAN.md` if you already know what phase you're in and just need the next
concrete task.

## Who this packet is actually for, concretely

Just the developer, at two different moments — deciding what to prioritize next, and
re-orienting after time away from the project. Nothing here has been pressure-tested
against an outside reader or a real device yet; the one concrete gap (on-device SQLite
verification) is tracked honestly in `FRAMEWORK.md` Phase 2, not glossed over.

## Adding a new doc

Before writing: decide which tier it belongs to (does it answer "should we" or "how do
we"), add it to the table above, and give it the same header block used in the existing
docs (`Tier / Audience / Use when`, one line each, at the top of the file). If a section
depends on facts nobody in this project actually knows yet, don't invent numbers — flag
it as a research-handoff candidate instead.
