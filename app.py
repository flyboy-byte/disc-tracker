#!/usr/bin/env python3
import os
import json
import sqlite3
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
        ''')
        # Migrations for columns added after initial deploy
        for col, ddl in [
            ('color', "ALTER TABLE discs ADD COLUMN color TEXT DEFAULT ''"),
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


# ── Picker ────────────────────────────────────────────────────────────────────

@app.route('/pick', methods=['GET'])
def pick():
    error = session.pop('pick_error', None)
    with get_db() as db:
        users = db.execute(
            'SELECT id, username FROM users ORDER BY username COLLATE NOCASE'
        ).fetchall()
    return render_template('pick.html', users=users, error=error)


@app.route('/pick', methods=['POST'])
def pick_post():
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
    username = (request.form.get('username') or '').strip()
    if not username:
        session['pick_error'] = 'Username cannot be empty.'
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
def delete_user():
    user_id = request.form.get('user_id', type=int)
    if user_id:
        with get_db() as db:
            db.execute('DELETE FROM users WHERE id = ?', (user_id,))
        if session.get('user_id') == user_id:
            session.clear()
    return redirect(url_for('pick'))


@app.route('/switch', methods=['POST'])
def switch():
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
    return render_template('index.html', username=row['username'])


@app.route('/api/data', methods=['GET'])
@login_required
def get_data():
    user_id = session['user_id']
    with get_db() as db:
        meta = db.execute(
            'SELECT next_id, sort_mode FROM user_meta WHERE user_id = ?', (user_id,)
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
    return jsonify({'discs': discs, 'nextId': meta['next_id'], 'sortMode': meta['sort_mode']})


@app.route('/api/data', methods=['POST'])
@login_required
def set_data():
    payload = request.get_json(silent=True)
    if payload is None:
        abort(400)
    user_id   = session['user_id']
    discs     = payload.get('discs', [])
    next_id   = payload.get('nextId', 100)
    sort_mode = payload.get('sortMode', 'speed-desc')
    with get_db() as db:
        db.execute('DELETE FROM discs WHERE user_id = ?', (user_id,))
        db.executemany(
            'INSERT INTO discs (user_id, disc_id, mfr, mold, plastic, weight, '
            'speed, glide, turn, fade, use_desc, thr, notes, color, sort_order) '
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                (user_id, d.get('id', 0), d.get('mfr', ''), d.get('mold', ''),
                 d.get('plastic', ''), d.get('weight', ''),
                 d.get('speed', 0), d.get('glide', 0),
                 d.get('turn', 0), d.get('fade', 0),
                 d.get('use', ''), d.get('thr', ''), d.get('notes', ''),
                 d.get('color', ''), i)
                for i, d in enumerate(discs)
            ]
        )
        db.execute(
            'INSERT INTO user_meta (user_id, next_id, sort_mode) VALUES (?, ?, ?) '
            'ON CONFLICT(user_id) DO UPDATE SET '
            'next_id = excluded.next_id, sort_mode = excluded.sort_mode',
            (user_id, next_id, sort_mode)
        )
    return jsonify({'ok': True})


# ── Master disc library ───────────────────────────────────────────────────────

_master_cache = None

@app.route('/api/master')
def get_master():
    global _master_cache
    if _master_cache is None:
        master_path = os.path.join(os.path.dirname(__file__), 'static', 'discs_master.json')
        with open(master_path) as f:
            _master_cache = f.read()
    return app.response_class(_master_cache, mimetype='application/json')


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5757, debug=False)
