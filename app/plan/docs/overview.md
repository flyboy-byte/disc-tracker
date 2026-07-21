# Overview

> **Tier:** High-level · **Audience:** decision-maker, and anyone hearing about this
> project for the first time · **Use when:** deciding whether/how to pursue this, or
> explaining it to someone new in under 5 minutes.
> See [`documentation-guide.md`](./documentation-guide.md) for how this fits with the
> rest of the packet.

## One-line summary

A local-first Android app (Expo/React Native) that ports the Disc Tracker website's bag
tracker, Flight Shaper, and Disc Suggest tools so they work offline on a phone, backed
by on-device SQLite instead of the Flask VPS.

## Who/what it's for

Primarily the developer's own daily use (checking/editing a disc bag away from a
computer), with a secondary goal of shipping something clean enough to publish publicly
— Play Store first, then F-Droid, since the codebase is FOSS and the developer already
has one other app (DragTree) live on both. Single-user per device; no multi-tenant
concept, no login.

Explicitly **not** trying to be: a cloud-synced multi-device app (v1 is local-only by
design — see `approach.md`), an iOS app (Android-first, iOS deliberately out of scope
for now), a monetized product (no ads, no accounts, no analytics, no purchases — this is
a FOSS personal tool, not a business; see the sibling `idea-to-business` skill if that
framing were ever needed instead), or a rewrite of the physics/scenario logic — it must
match the website's existing math exactly unless a real bug is proven.

## Why this approach (vs. the obvious alternative)

- **Port, don't redesign.** The website is the canonical spec — every screen matches
  its existing behavior byte-for-byte where testable (Phase 0 parity fixtures), rather
  than using the port as an excuse to redesign flows. Keeps risk low and scope bounded.
- **Local-first SQLite, not "call the Flask server from the phone."** The VPS is a
  localhost-bound personal server, not built to be a multi-client backend — hitting it
  from a phone would mean opening it to the internet with all the hardening that
  implies. Local SQLite avoids that entirely for v1, with the schema deliberately shaped
  so an *opt-in* sync layer can be added later without a rewrite (see `approach.md`).
- **Expo + local Gradle, not EAS, not Flutter/native.** Reuses real prior experience
  (DragTree, the developer's other live Expo/F-Droid app) and lets ~all the pure JS
  logic (physics, scenarios, CSV) port with type annotations instead of a full rewrite
  in Dart or Kotlin.
- **Phase 0 parity-fixture-first.** Every stability/distance/scenario calculation was
  captured from the *running* website before any TypeScript was written, catching two
  real bugs in the plan's own fixture tables before they could propagate into the port.

## What success looks like

The `PORT_PLAN.md` "Minimum Credible v1 Milestone" is the concrete bar: app opens cold
on a physical device without crashing, SQLite persists a bag across app kills, stability
labels match the website for the same disc, Phase 0 parity tests pass, Flight Shape arc
renders and updates live, Disc Suggest matches for at least two scenarios, and CSV
export/import round-trips. That's the finish line for "v1 works" — Play Store and
F-Droid submission are separate, later milestones (see `../PORT_PLAN.md`'s Distribution
Track).

## What's genuinely novel here vs. what's just applying an existing pattern

Nothing about the architecture is novel — local-first Expo/SQLite apps with local Gradle
builds are a well-trodden pattern, and this project is deliberately reusing that pattern
(via DragTree) rather than inventing anything new. The one piece of real, non-generic
work is the parity-fixture verification against a live, already-built system (the
website) — most ports don't have a running reference implementation to check every
number against before writing code, and that discipline already caught two real bugs
that would otherwise have shipped silently into the mobile app.
