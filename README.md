<p align="center">
  <img src="docs/banner.png" alt="Disc Tracker" width="100%">
</p>

<h1 align="center">Disc Tracker</h1>

<p align="center">
  Personal disc golf bag tracker — self-hosted, no accounts, no cloud, no ads.
</p>

---

## Features

- **Bag management** — search 1,660+ discs, auto-fill flight numbers, assign colors, drag to reorder
- **Flight path arcs** — top-down visualization shaped by speed/glide/turn/fade, colored by stability
- **Flight Shape tool** — adjust hyzer, nose pitch, wind, arm power, and spin; watch the arc update live with a distance estimate
- **Disc Suggest tool** — recommends discs from your bag for 12 shot shapes (Roller, Max Distance, Reliable Hyzer, etc.)
- **Today's bag** — check off what's in your bag today, export a filtered CSV
- **Multi-user** — profile picker on launch, no passwords, each user has their own bag
- **CSV import / export** — back up or migrate your collection

---

## Self-hosting

**Requirements:** Python 3.9+, Flask

```bash
git clone https://github.com/flyboy-byte/disc-tracker.git
cd disc-tracker
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Opens at `http://localhost:5757`. Database and secret key are created automatically in `data/` on first run.
`numpy`/`scipy`/`pyyaml` are only needed for the optional Physics sim mode in Flight Shaper —
everything else runs on Flask alone.

### Run as a systemd service

```bash
cp disc_tracker.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable disc_tracker
systemctl --user start disc_tracker
```

---

## Flight Shape tool

| Slider | Range | Effect |
|--------|-------|--------|
| Hyzer | ±30° | Positive = hyzer angle, increases fade |
| Nose | ±15° | Nose up = higher AOA, more understable |
| Wind | ±20 mph | Headwind = more overstable; tailwind = more understable |
| Crosswind | ±20 mph | Physics-sim mode only — lateral wind |
| Arm | 50–100% | Under-power shifts fast discs understable |
| Spin | 50–100% | Lower spin = reduced gyroscopic stability, more turn |

Physics based on Kamaruddin, Potts & Crowther (2018) — *Aerodynamic Performance of Flying Discs*.

There's also an opt-in **Physics sim** mode — a real rigid-body flight simulator
([shotshaper](https://github.com/kegiljarhus/shotshaper), GPLv3) instead of the default curve
model, for driver-class discs. Research/experimental, off by default.

---

## Stability

| Label | Net (fade + turn) | Color |
|-------|-------------------|-------|
| OS (overstable) | ≥ 1 | Purple |
| ST (stable) | −1 to 1 exclusive | Green |
| US (understable) | ≤ −1 | Gold |

---

## Mobile app

An **Android app** (Expo / React Native) — a local-first port of the bag tracker, Flight Shaper, and Disc Suggest tools plus a Settings screen, backed by on-device SQLite with no server dependency. **v1 is feature-complete** and confirmed running on real hardware; early **debug-signed preview APKs** are on the [Releases page](https://github.com/flyboy-byte/disc-tracker/releases) for sideloading. Play Store + F-Droid distribution is the next step. Build/plan docs live in [`app/PORT_PLAN.md`](app/PORT_PLAN.md). (Android-first — iOS is out of scope for now.)

---

## Data & privacy

All data lives in `data/` on your own machine or server. Nothing is transmitted anywhere. No analytics, no tracking, no external services.

---

## License

GPLv3 — see [`LICENSE`](LICENSE).
