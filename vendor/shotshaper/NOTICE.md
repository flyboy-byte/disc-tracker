Vendored from https://github.com/kegiljarhus/shotshaper, commit `c99e7a511b48f1290e7d6e34676785d5830b8522`
(2023-02-24), by Knut Erik Teigen Giljarhus. Licensed GPLv3 (see `LICENSE` in this directory) —
compatible with this project's license (see repo root `LICENSE`).

Only the pieces needed to run the rigid-body flight simulation are included: `projectile.py`,
`environment.py`, `transforms.py`, `__init__.py`, and the 4 disc aero-coefficient files under
`discs/`. The `.stl` 3D geometry files, examples, and GUI from the upstream repo are intentionally
excluded — they're only used for the offline CFD/meshing step that already produced the `.yaml`
coefficient data, not for running `DiscGolfDisc.shoot()`.

Used server-side (`app.py`) via `/api/shotshaper_sim` to back Flight Shaper's "Physics sim" mode.
Only 3 archetypes are available: `cd1`/`cd5` (control/fairway drivers), `dd2` (distance driver),
`fd2` (fairway driver) — no putter or midrange data exists upstream.

**Local modification:** `projectile.py`'s top-level `import matplotlib.pyplot` was moved to a
local import inside `plot_coeffs()` (the only method that uses it), so matplotlib isn't a hard
server dependency just to run the flight simulation. No other logic changed.

See `app/references/README.md` for the two papers (Giljarhus 2022, Kamaruddin/Potts/Crowther 2018)
this simulator's methodology is based on.
