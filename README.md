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
pip install flask
python app.py
```

Opens at `http://localhost:5757`. Database and secret key are created automatically in `data/` on first run.

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
| Arm | 50–100% | Under-power shifts fast discs understable |
| Spin | 50–100% | Lower spin = reduced gyroscopic stability, more turn |

Physics based on Kamaruddin, Potts & Crowther (2018) — *Aerodynamic Performance of Flying Discs*.

---

## Stability

| Label | Net (fade + turn) | Color |
|-------|-------------------|-------|
| OS (overstable) | ≥ 1 | Purple |
| ST (stable) | −1 to 1 exclusive | Green |
| US (understable) | ≤ −1 | Gold |

---

## Mobile app

An Android/iOS port (Expo / React Native) is in development. Plan docs are in [`app/PORT_PLAN.md`](app/PORT_PLAN.md). Targeting Play Store + F-Droid. Local-first SQLite, no server dependency.

---

## Data & privacy

All data lives in `data/` on your own machine or server. Nothing is transmitted anywhere. No analytics, no tracking, no external services.

---

## License

MIT
