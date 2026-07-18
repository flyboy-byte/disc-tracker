Source papers backing the physics model in `RESEARCH.md` §7 (Physics Architecture: V2 Design)
and `static/physics.js`'s `MOD` coefficients. Kept locally so they don't get lost between sessions.

- **`giljarhus-2022-disc-golf-trajectory-modelling.pdf`** — Giljarhus, Gooding & Njærheim (2022),
  "Disc golf trajectory modelling combining computational fluid dynamics and rigid body dynamics,"
  *Sports Engineering* 25:26. CC BY 4.0. Combines CFD-derived aero coefficients with rigid-body
  flight simulation; validated against real tracked throws. Author also wrote the open-source
  `shotshaper` simulator (GPLv3 — code itself not reusable here, but this paper's equations and
  methodology are CC BY 4.0 and freely citable/reimplementable).
  - Cites Potts JR (2005) "Disc-wing aerodynamics" PhD thesis, University of Manchester, as ref [6]
    — likely upstream source of the "Kamaruddin/Potts" citation in `static/physics.js`. Still don't
    have that thesis on file; if it turns up again, save it here too.
  - Relevant to `physicsV2.ts`: validates the phase-based turn→fade model (high-speed lift raises
    AoA down → turn phase; low-speed lift drop raises AoA up → fade phase) and the inverse
    spin/roll-rate relationship (Eq. 11) that `spin_turn`/`spinEffect` already assumes.

- **`kamaruddin-potts-crowther-2018-aerodynamic-performance-of-flying-discs.pdf`** — Kamaruddin,
  Potts & Crowther (2018), "Aerodynamic Performance of Flying Discs," *Aircraft Engineering and
  Aerospace Technology* 90(2), 390–397. Accepted-manuscript copy from Sheffield Hallam's SHURA
  repository (green open access — author's peer-reviewed version, not publisher's typeset PDF, and
  not CC-BY like the paper above; keep this for internal research reference, don't republish it
  elsewhere). This is the direct wind-tunnel source behind the "Kamaruddin/Potts" citation already in
  `static/physics.js` (`pitch_turn` coefficient) and the primary aero dataset the Giljarhus 2022 CFD
  paper validates against (ref [8] there).
  - Wind-tunnel-measured Cl/Cd/Cm for putter/mid/driver golf discs plus 4 parametric disc shapes,
    isolating the effect of camber, rim edge profile, cavity height, and thickness-to-diameter ratio.
  - Key finding: **Cₘ (pitching moment) matters more than Cl/Cd for flight performance** — its
    magnitude and gradient drive the disc's tendency to yaw off its intended path (i.e. turn/fade
    severity), while Cl/Cd mainly governs throwing distance. Framing worth carrying into how
    `physicsV2.ts` weights turn/fade tuning vs. distance/glide tuning.
