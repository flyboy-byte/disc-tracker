#!/usr/bin/env python3
import json
import os
import re
import secrets
import sqlite3
import urllib.parse
import urllib.request
from functools import wraps
from flask import Flask, jsonify, request, render_template, session, redirect, url_for, abort

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
DB_FILE  = os.path.join(DATA_DIR, 'disc_tracker.db')
KEY_FILE = os.path.join(DATA_DIR, '.secret_key')

app = Flask(__name__)

os.makedirs(DATA_DIR, exist_ok=True)
if os.path.exists(KEY_FILE):
    with open(KEY_FILE, 'rb') as f:
        app.secret_key = f.read()
else:
    key = os.urandom(32)
    with open(KEY_FILE, 'wb') as f:
        f.write(key)
    app.secret_key = key


# ── Database ──────────────────────────────────────────────────────────────────

def get_db():
    db = sqlite3.connect(DB_FILE)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys = ON')
    return db


def init_db():
    with get_db() as db:
        db.executescript('''
            CREATE TABLE IF NOT EXISTS users (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL
            );
            CREATE TABLE IF NOT EXISTS discs (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                disc_id    INTEGER NOT NULL,
                mfr        TEXT DEFAULT '',
                mold       TEXT NOT NULL,
                plastic    TEXT DEFAULT '',
                weight     TEXT DEFAULT '',
                speed      REAL DEFAULT 0,
                glide      REAL DEFAULT 0,
                turn       REAL DEFAULT 0,
                fade       REAL DEFAULT 0,
                use_desc   TEXT DEFAULT '',
                thr        TEXT DEFAULT '',
                notes      TEXT DEFAULT '',
                sort_order INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS user_meta (
                user_id   INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                next_id   INTEGER DEFAULT 100,
                sort_mode TEXT DEFAULT 'speed-desc'
            );
            CREATE TABLE IF NOT EXISTS ms_pic_cache (
                lookup_key TEXT PRIMARY KEY,
                pic        TEXT NOT NULL DEFAULT ''
            );
        ''')
        # Migrations for columns added after initial deploy
        for col, ddl in [
            ('color',    "ALTER TABLE discs ADD COLUMN color TEXT DEFAULT ''"),
            ('arc_view', "ALTER TABLE user_meta ADD COLUMN arc_view TEXT DEFAULT 'RHBH'"),
        ]:
            try:
                db.execute(ddl)
            except Exception:
                pass


init_db()


# ── Auth ──────────────────────────────────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('pick'))
        return f(*args, **kwargs)
    return decorated

def get_csrf_token():
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(32)
    return session['csrf_token']

def check_csrf():
    token = request.form.get('_csrf') or request.headers.get('X-CSRF-Token')
    if not token or token != session.get('csrf_token'):
        abort(403)


# ── Picker ────────────────────────────────────────────────────────────────────

@app.route('/pick', methods=['GET'])
def pick():
    error = session.pop('pick_error', None)
    with get_db() as db:
        users = db.execute(
            'SELECT id, username FROM users ORDER BY username COLLATE NOCASE'
        ).fetchall()
    return render_template('pick.html', users=users, error=error, csrf_token=get_csrf_token())


@app.route('/pick', methods=['POST'])
def pick_post():
    check_csrf()
    user_id = request.form.get('user_id', type=int)
    if not user_id:
        return redirect(url_for('pick'))
    with get_db() as db:
        row = db.execute('SELECT id FROM users WHERE id = ?', (user_id,)).fetchone()
    if not row:
        return redirect(url_for('pick'))
    session['user_id'] = user_id
    return redirect(url_for('index'))


@app.route('/add_user', methods=['POST'])
def add_user():
    check_csrf()
    username = (request.form.get('username') or '').strip()
    if not username:
        session['pick_error'] = 'Username cannot be empty.'
        return redirect(url_for('pick'))
    if len(username) > 40:
        session['pick_error'] = 'Username must be 40 characters or fewer.'
        return redirect(url_for('pick'))
    try:
        with get_db() as db:
            cur = db.execute('INSERT INTO users (username) VALUES (?)', (username,))
            user_id = cur.lastrowid
    except sqlite3.IntegrityError:
        session['pick_error'] = f'"{username}" is already taken.'
        return redirect(url_for('pick'))
    session['user_id'] = user_id
    return redirect(url_for('index'))


@app.route('/delete_user', methods=['POST'])
@login_required
def delete_user():
    check_csrf()
    user_id = request.form.get('user_id', type=int)
    if user_id and user_id == session.get('user_id'):
        with get_db() as db:
            db.execute('DELETE FROM users WHERE id = ?', (user_id,))
        session.clear()
    return redirect(url_for('pick'))


@app.route('/switch', methods=['POST'])
def switch():
    check_csrf()
    session.clear()
    return redirect(url_for('pick'))


# ── Tracker ───────────────────────────────────────────────────────────────────

@app.route('/')
@login_required
def index():
    with get_db() as db:
        row = db.execute(
            'SELECT username FROM users WHERE id = ?', (session['user_id'],)
        ).fetchone()
    if not row:
        session.clear()
        return redirect(url_for('pick'))
    return render_template('index.html', username=row['username'], csrf_token=get_csrf_token())


@app.route('/flightshape')
@login_required
def flightshape():
    with get_db() as db:
        row = db.execute(
            'SELECT username FROM users WHERE id = ?', (session['user_id'],)
        ).fetchone()
    if not row:
        session.clear()
        return redirect(url_for('pick'))
    return render_template('flightshape.html', username=row['username'], csrf_token=get_csrf_token(),
                            archetype_profile=ARCHETYPE_PROFILE)


@app.route('/api/data', methods=['GET'])
@login_required
def get_data():
    user_id = session['user_id']
    with get_db() as db:
        meta = db.execute(
            'SELECT next_id, sort_mode, arc_view FROM user_meta WHERE user_id = ?', (user_id,)
        ).fetchone()
        if meta is None:
            return jsonify(None), 404
        rows = db.execute(
            'SELECT disc_id, mfr, mold, plastic, weight, speed, glide, turn, fade, '
            'use_desc, thr, notes, color FROM discs WHERE user_id = ? ORDER BY sort_order',
            (user_id,)
        ).fetchall()
    discs = [
        {
            'id': r['disc_id'], 'mfr': r['mfr'], 'mold': r['mold'],
            'plastic': r['plastic'], 'weight': r['weight'],
            'speed': r['speed'], 'glide': r['glide'],
            'turn': r['turn'], 'fade': r['fade'],
            'use': r['use_desc'], 'thr': r['thr'], 'notes': r['notes'],
            'color': r['color'] or '',
        }
        for r in rows
    ]
    return jsonify({'discs': discs, 'nextId': meta['next_id'], 'sortMode': meta['sort_mode'],
                    'arcView': meta['arc_view'] or 'RHBH'})


@app.route('/api/data', methods=['POST'])
@login_required
def set_data():
    check_csrf()
    payload = request.get_json(silent=True)
    if payload is None:
        abort(400)
    user_id   = session['user_id']
    discs     = payload.get('discs', [])
    next_id   = max(1, min(int(payload.get('nextId') or 100), 999_999_999))
    sort_mode = payload.get('sortMode', 'speed-desc')
    arc_view  = payload.get('arcView', 'RHBH')
    if arc_view not in ('RHBH', 'RHFH', 'LHBH', 'LHFH'):
        arc_view = 'RHBH'
    if sort_mode not in ('speed-desc', 'speed-asc', 'name', 'mfr', 'custom'):
        sort_mode = 'speed-desc'
    with get_db() as db:
        db.execute('DELETE FROM discs WHERE user_id = ?', (user_id,))
        db.executemany(
            'INSERT INTO discs (user_id, disc_id, mfr, mold, plastic, weight, '
            'speed, glide, turn, fade, use_desc, thr, notes, color, sort_order) '
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                (user_id, int(d.get('id') or 0), str(d.get('mfr') or '')[:80], str(d.get('mold') or '')[:80],
                 str(d.get('plastic') or '')[:80], str(d.get('weight') or '')[:20],
                 float(d.get('speed') or 0), float(d.get('glide') or 0),
                 float(d.get('turn') or 0), float(d.get('fade') or 0),
                 str(d.get('use') or '')[:200], str(d.get('thr') or '')[:10], str(d.get('notes') or '')[:1000],
                 (c if re.match(r'^#[0-9A-Fa-f]{6}$', c := str(d.get('color') or '')) else ''), i)
                for i, d in enumerate(discs)
                if str(d.get('mold') or '').strip()  # skip discs with no mold name
            ]
        )
        db.execute(
            'INSERT INTO user_meta (user_id, next_id, sort_mode, arc_view) VALUES (?, ?, ?, ?) '
            'ON CONFLICT(user_id) DO UPDATE SET '
            'next_id = excluded.next_id, sort_mode = excluded.sort_mode, arc_view = excluded.arc_view',
            (user_id, next_id, sort_mode, arc_view)
        )
    return jsonify({'ok': True})


@app.route('/api/arcview', methods=['POST'])
@login_required
def set_arcview():
    check_csrf()
    payload = request.get_json(silent=True)
    if not payload:
        abort(400)
    view = payload.get('arcView', 'RHBH')
    if view not in ('RHBH', 'RHFH', 'LHBH', 'LHFH'):
        abort(400)
    with get_db() as db:
        db.execute(
            'INSERT INTO user_meta (user_id, arc_view) VALUES (?, ?) '
            'ON CONFLICT(user_id) DO UPDATE SET arc_view = excluded.arc_view',
            (session['user_id'], view)
        )
    return jsonify({'ok': True})


# ── Marshall Street reference images (DiscIt API) ──────────────────────────────
# Optional, read-only, best-effort. Never let a failure here affect the rest of
# the app — any error just means no reference image is shown.

MS_API_BASE = 'https://discit-api.fly.dev/disc'

def _ms_lookup_key(mfr, mold):
    return f"{mfr.strip().lower()}|{mold.strip().lower()}"

def fetch_ms_pic(mfr, mold):
    mfr, mold = (mfr or '').strip(), (mold or '').strip()
    if not mold:
        return None
    key = _ms_lookup_key(mfr, mold)
    with get_db() as db:
        row = db.execute(
            'SELECT pic FROM ms_pic_cache WHERE lookup_key = ?', (key,)
        ).fetchone()
        if row is not None:
            return row['pic'] or None

    pic = ''
    try:
        url = MS_API_BASE + '?' + urllib.parse.urlencode({'name': mold})
        with urllib.request.urlopen(url, timeout=4) as resp:
            results = json.loads(resp.read().decode('utf-8'))
        for r in results:
            if str(r.get('name', '')).strip().lower() != mold.lower():
                continue
            brand = str(r.get('brand', '')).strip().lower()
            if mfr and mfr.lower() not in brand and brand not in mfr.lower():
                continue
            if r.get('pic'):
                pic = r['pic']
                break
    except Exception:
        pic = ''

    with get_db() as db:
        db.execute(
            'INSERT INTO ms_pic_cache (lookup_key, pic) VALUES (?, ?) '
            'ON CONFLICT(lookup_key) DO UPDATE SET pic = excluded.pic',
            (key, pic)
        )
    return pic or None


@app.route('/api/ms_pic', methods=['GET'])
@login_required
def get_ms_pic():
    mfr  = request.args.get('mfr', '')
    mold = request.args.get('mold', '')
    pic = fetch_ms_pic(mfr, mold)
    return jsonify({'pic': pic})


@app.route('/api/ms_pic_img', methods=['GET'])
@login_required
def get_ms_pic_img():
    # Proxies the actual image bytes so the browser only ever loads same-origin
    # <img> sources — avoids relaxing the site's img-src CSP to a third-party host.
    mfr  = request.args.get('mfr', '')
    mold = request.args.get('mold', '')
    pic = fetch_ms_pic(mfr, mold)
    if not pic:
        abort(404)
    try:
        with urllib.request.urlopen(pic, timeout=5) as resp:
            data = resp.read()
            ctype = resp.headers.get('Content-Type', 'image/webp')
    except Exception:
        abort(502)
    response = app.response_class(data, mimetype=ctype)
    response.headers['Cache-Control'] = 'public, max-age=604800'
    return response


# ── shotshaper physics simulation (Flight Shaper "Physics sim" mode) ───────────
# Vendored rigid-body disc flight simulator (vendor/shotshaper/, GPLv3, see NOTICE.md there).
# Only 4 archetypes have wind-tunnel/CFD aero coefficients upstream — no putter or midrange —
# so a slow disc still runs against the nearest driver archetype (see ARCHETYPE_PROFILE)
# as an extrapolation, not a real model of putter/midrange flight. Everything here is
# research/experimental: launch speed and spin are approximated from the PDGA speed number,
# not measured. Mass and wind (including crosswind) use real inputs to the same vendored API.

import threading as _threading

_shotshaper_lock = _threading.Lock()

SHOTSHAPER_ARCHETYPES = {
    'fd2': 'Fairway driver',
    'cd1': 'Control driver A',
    'cd5': 'Control driver B',
    'dd2': 'Distance driver',
}

# Empirical characterization, not invented data: each archetype was run once through
# shotshaper's own unmodified DiscGolfDisc.shoot(), using the exact throw parameters from
# upstream's own examples/disc_golf_throw.py (speed=24.2, omega=116.8, pitch=15.5, roll=14.7).
# Reproduce with the throwaway script referenced in the git history for this block if these
# numbers ever need re-deriving. Results (distance, final lateral drift):
#   cd1: 61.5m, +25.6m drift (drifts one way the whole flight, never fades back)
#   fd2: 65.8m, +29.4m drift (same shape as cd1, shortest distance)
#   cd5: 83.0m, -6.5m drift  (turns to -12m then fades back partway — mild S-curve)
#   dd2: 81.9m, +4.1m drift  (turns to -6.3m then fades all the way past center — full S-curve)
# This is used only to pick which of the 4 pre-built vendored discs best matches a real disc's
# recorded flight numbers — it never changes any coefficient inside vendor/shotshaper/.
ARCHETYPE_PROFILE = {
    'cd1': {'label': 'Control driver A', 'speed_class': 'control',  'tendency': 'understable',
            'char_dist_m': 61.5, 'char_drift_m': 25.6},
    'fd2': {'label': 'Fairway driver',   'speed_class': 'fairway',  'tendency': 'understable',
            'char_dist_m': 65.8, 'char_drift_m': 29.4},
    'cd5': {'label': 'Control driver B', 'speed_class': 'control',  'tendency': 'overstable',
            'char_dist_m': 83.0, 'char_drift_m': -6.5},
    'dd2': {'label': 'Distance driver',  'speed_class': 'distance', 'tendency': 'overstable',
            'char_dist_m': 81.9, 'char_drift_m': 4.1},
}


@app.route('/api/shotshaper_sim', methods=['POST'])
@login_required
def shotshaper_sim():
    check_csrf()
    try:
        import numpy as np
        from vendor.shotshaper import environment
        from vendor.shotshaper.projectile import DiscGolfDisc
    except ImportError:
        return jsonify({'error': 'physics sim dependencies not installed'}), 501

    data = request.get_json(force=True) or {}
    archetype = data.get('archetype', 'dd2')
    if archetype not in SHOTSHAPER_ARCHETYPES:
        return jsonify({'error': 'unknown archetype'}), 400

    pdga_speed = float(data.get('pdgaSpeed', 9))
    hyzer      = float(data.get('hyzer', 0))
    nose       = float(data.get('nose', 0))
    wind       = float(data.get('wind', 0))
    crosswind  = float(data.get('crosswind', 0))
    arm_speed  = float(data.get('armSpeed', 100))
    spin_pct   = float(data.get('spin', 100))
    arc_view   = data.get('arcView', 'RHBH')
    weight_g   = data.get('weightG')

    mirror = -1 if arc_view in ('RHFH', 'LHBH') else 1

    # Calibrated to shotshaper's own dd2 example: PDGA speed ~12 -> ~24.2 m/s launch speed.
    base_launch_speed = 6.0 + pdga_speed * 1.3
    U = max(4.0, base_launch_speed * (arm_speed / 100.0))

    # Real recorded disc weight as sim mass, same input upstream's own disc_gui2d.py exposes
    # via a slider (range 0.140-0.200 kg is that slider's own validated range).
    try:
        mass_kg = float(weight_g) / 1000.0
    except (TypeError, ValueError):
        mass_kg = 0.175
    mass_kg = max(0.140, min(0.200, mass_kg))

    with _shotshaper_lock:
        disc = DiscGolfDisc(archetype, mass=mass_kg)
        omega = max(disc.empirical_spin(U) * (spin_pct / 100.0), 1.0)

        # environment module state is process-global; guarded by _shotshaper_lock since the
        # dev server is single-threaded anyway, but this keeps it correct if that ever changes.
        # headwind (wind>0) opposes +x travel, tailwind (wind<0) aids it; crosswind is the
        # y-component of the same 3-axis winddir vector environment.py already exposes.
        vx = abs(wind) * 0.45 * (1.0 if wind <= 0 else -1.0)
        vy = abs(crosswind) * 0.45 * mirror * (1.0 if crosswind >= 0 else -1.0)
        environment.Uref = (vx ** 2 + vy ** 2) ** 0.5
        norm = environment.Uref or 1.0
        environment.winddir = np.array((vx / norm, vy / norm, 0.0))

        try:
            shot = disc.shoot(
                speed=U, omega=omega, pitch=15.0,
                position=np.array((0.0, 0.0, 1.3)),
                nose_angle=nose, roll_angle=mirror * hyzer,
            )
        except Exception as e:
            return jsonify({'error': str(e)}), 500
        finally:
            environment.Uref = 0.0

    x, y, z = shot.position
    points = [[round(float(px), 2), round(float(py), 2)] for px, py in zip(x, y)]
    return jsonify({'points': points, 'archetype': archetype})


# ── Master disc library ───────────────────────────────────────────────────────

_master_cache = None

@app.route('/api/master')
def get_master():
    global _master_cache
    if _master_cache is None:
        master_path = os.path.join(os.path.dirname(__file__), 'static', 'discs_master.json')
        try:
            with open(master_path) as f:
                _master_cache = f.read()
        except (FileNotFoundError, IOError):
            return jsonify({'error': 'Master disc library unavailable'}), 500
    return app.response_class(_master_cache, mimetype='application/json')



@app.route('/discsuggestion')
@login_required
def discsuggestion():
    with get_db() as db:
        row = db.execute(
            'SELECT username FROM users WHERE id = ?', (session['user_id'],)
        ).fetchone()
    if not row:
        session.clear()
        return redirect(url_for('pick'))
    return render_template('discsuggestion.html', username=row['username'], csrf_token=get_csrf_token())


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5757, debug=False)
