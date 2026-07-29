#!/usr/bin/env python3
"""
Reference-fixture generator for the shotshaper physics-sim port (R4.5).

Runs the REAL vendored engine (vendor/shotshaper, numpy/scipy) across a grid of
scenarios and dumps the trajectories to JSON. The TS port's Jest parity test
(app/src/physics/sim/parity.test.ts) loads these fixtures and asserts the TS
engine reproduces them within tolerance — this is the oracle that makes the
port trustworthy. Regenerate only if the vendored engine changes (it never
should): from repo root, `python app/plan/tools/gen_physics_fixtures.py`.

Two fixture sets:
  engine.json  — direct DiscGolfDisc.shoot(...) with explicit speed/omega/pitch/
                 nose/roll + wind. Isolates the integrator + force model.
  server.json  — the full /api/shotshaper_sim orchestration (pdgaSpeed + sliders
                 → speed/omega/mass/wind). End-to-end, exactly what the app path
                 must reproduce. Kept in lockstep with app.py:shotshaper_sim.
"""
import json
import os
import sys

import numpy as np

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.insert(0, REPO)
from vendor.shotshaper import environment
from vendor.shotshaper.projectile import DiscGolfDisc

OUT = os.path.join(REPO, 'app', 'src', 'physics', 'sim', '__fixtures__')
ARCHES = ['cd1', 'cd5', 'dd2', 'fd2']


def run_engine(archetype, mass_kg, speed, omega, pitch, nose, roll, uref, winddir):
    """One raw engine shot. Mirrors _shoot: RK45 dense, resample to 200 points."""
    disc = DiscGolfDisc(archetype, mass=mass_kg)
    environment.Uref = uref
    environment.winddir = np.array(winddir, dtype=float)
    try:
        shot = disc.shoot(speed=speed, omega=omega, pitch=pitch,
                          position=np.array((0.0, 0.0, 1.3)),
                          nose_angle=nose, roll_angle=roll)
    finally:
        environment.Uref = 0.0
        environment.winddir = np.array((1.0, 0.0, 0.0))
    x, y, z = shot.position
    return {
        't_end': round(float(shot.time[-1]), 6),
        'x': [round(float(v), 5) for v in x],
        'y': [round(float(v), 5) for v in y],
        'z': [round(float(v), 5) for v in z],
    }


def engine_fixtures():
    cases = []
    # Neutral baseline per archetype (the case the model-agreement diagnostic flagged).
    for a in ARCHES:
        disc = DiscGolfDisc(a)
        U = 24.2
        cases.append(('%s-neutral' % a, dict(archetype=a, mass_kg=0.175, speed=U,
                      omega=disc.empirical_spin(U), pitch=15.0, nose=0.0, roll=0.0,
                      uref=0.0, winddir=(1, 0, 0))))
    # Sweep the physical inputs on dd2 (the representative distance driver).
    U = 24.2
    om = DiscGolfDisc('dd2').empirical_spin(U)
    base = dict(archetype='dd2', mass_kg=0.175, speed=U, omega=om, pitch=15.0,
                nose=0.0, roll=0.0, uref=0.0, winddir=(1, 0, 0))
    sweeps = [
        ('dd2-hyzer15', dict(roll=15.0)),
        ('dd2-anhyzer15', dict(roll=-15.0)),
        ('dd2-nose-up6', dict(nose=6.0)),
        ('dd2-nose-down6', dict(nose=-6.0)),
        ('dd2-headwind', dict(uref=5.0, winddir=(-1, 0, 0))),
        ('dd2-tailwind', dict(uref=5.0, winddir=(1, 0, 0))),
        ('dd2-crosswind', dict(uref=5.0, winddir=(0, 1, 0))),
        ('dd2-slow', dict(speed=16.0, omega=DiscGolfDisc('dd2').empirical_spin(16.0))),
        ('dd2-fast', dict(speed=30.0, omega=DiscGolfDisc('dd2').empirical_spin(30.0))),
        ('dd2-light', dict(mass_kg=0.150)),
        ('dd2-heavy', dict(mass_kg=0.200)),
        ('dd2-combo', dict(roll=12.0, nose=-3.0, uref=4.0, winddir=(-0.7071, 0.7071, 0.0))),
    ]
    for name, over in sweeps:
        p = dict(base); p.update(over)
        cases.append((name, p))
    return {name: {'params': p, 'result': run_engine(**p)} for name, p in cases}


# ---- server orchestration (keep in lockstep with app.py:shotshaper_sim) -------
def run_server(archetype, pdgaSpeed, hyzer, nose, wind, crosswind, armSpeed, spin, arcView, weightG):
    mirror = -1 if arcView in ('RHFH', 'LHBH') else 1
    base_launch_speed = 6.0 + pdgaSpeed * 1.3
    U = max(4.0, base_launch_speed * (armSpeed / 100.0))
    try:
        mass_kg = float(weightG) / 1000.0
    except (TypeError, ValueError):
        mass_kg = 0.175
    mass_kg = max(0.140, min(0.200, mass_kg))

    disc = DiscGolfDisc(archetype, mass=mass_kg)
    omega = max(disc.empirical_spin(U) * (spin / 100.0), 1.0)
    vx = abs(wind) * 0.45 * (1.0 if wind <= 0 else -1.0)
    vy = abs(crosswind) * 0.45 * mirror * (1.0 if crosswind >= 0 else -1.0)
    environment.Uref = (vx ** 2 + vy ** 2) ** 0.5
    n = environment.Uref or 1.0
    environment.winddir = np.array((vx / n, vy / n, 0.0))
    try:
        shot = disc.shoot(speed=U, omega=omega, pitch=15.0,
                          position=np.array((0.0, 0.0, 1.3)),
                          nose_angle=nose, roll_angle=mirror * hyzer)
    finally:
        environment.Uref = 0.0
        environment.winddir = np.array((1.0, 0.0, 0.0))
    x, y, _z = shot.position
    return [[round(float(px), 2), round(float(py), 2)] for px, py in zip(x, y)]


def server_fixtures():
    cases = {
        'srv-dd2-neutral': dict(archetype='dd2', pdgaSpeed=12, hyzer=0, nose=0, wind=0,
                                crosswind=0, armSpeed=100, spin=100, arcView='RHBH', weightG=175),
        'srv-dd2-rhfh-hyzer': dict(archetype='dd2', pdgaSpeed=12, hyzer=20, nose=0, wind=0,
                                   crosswind=0, armSpeed=100, spin=100, arcView='RHFH', weightG=170),
        'srv-fd2-wind': dict(archetype='fd2', pdgaSpeed=7, hyzer=10, nose=-2, wind=6,
                             crosswind=3, armSpeed=90, spin=100, arcView='RHBH', weightG=176),
        'srv-cd1-cross': dict(archetype='cd1', pdgaSpeed=5, hyzer=0, nose=0, wind=0,
                              crosswind=8, armSpeed=100, spin=110, arcView='LHBH', weightG=180),
    }
    return {name: {'params': p, 'points': run_server(**p)} for name, p in cases.items()}


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    eng = engine_fixtures()
    srv = server_fixtures()
    with open(os.path.join(OUT, 'engine.json'), 'w') as f:
        json.dump(eng, f, indent=0)
    with open(os.path.join(OUT, 'server.json'), 'w') as f:
        json.dump(srv, f, indent=0)
    print('engine fixtures:', len(eng), '| server fixtures:', len(srv))
    print('sample dd2-neutral landing: x=%.3f y=%.3f' %
          (eng['dd2-neutral']['result']['x'][-1], eng['dd2-neutral']['result']['y'][-1]))
