A TypeScript reimplementation of `DiscGolfDisc` and its supporting math from
[shotshaper](https://github.com/kegiljarhus/shotshaper) by Knut Erik Teigen Giljarhus, licensed
GPLv3 — compatible with this project's license (see repo root `LICENSE`). Mirrors the vendored
Python copy at `vendor/shotshaper/` (see that directory's own `NOTICE.md`), which stays the
reference oracle this port is parity-tested against (`parity.test.ts`).

`coeffs.ts` is the same 4-archetype (`cd1`/`cd5`/`dd2`/`fd2`) aerodynamic coefficient data from
`vendor/shotshaper/discs/*.yaml`, extracted verbatim — no putter or midrange data exists upstream,
same limitation as the server-side sim.

Runs entirely on-device (no server, no network) to back Flight Shaper's opt-in "Physics sim" mode
on the Android app. See CLAUDE.md's "Physics simulation" section for the full history — this port
shipped in R4.5 (2026-07-29).
