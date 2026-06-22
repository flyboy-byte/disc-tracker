<p align="center">
  <img src="docs/banner.png" alt="Disc Tracker" width="100%">
</p>

<h1 align="center">Disc Tracker</h1>

<p align="center">
  A personal disc golf bag tracker. Log your discs, visualize flight paths, and keep your bag organized — running on your own server.
</p>

---

![Screenshot](docs/screenshot.png)

---

## Features

- **Multi-user** — profile picker on launch, no passwords, each user has their own bag
- **Disc library** — search 1,660 discs by name or manufacturer, auto-fill flight numbers
- **Flight path arcs** — top-down RHBH visualization per disc, shaped by speed / glide / turn / fade
- **Stability & type filters** — filter by overstable / stable / understable and disc type
- **Disc colors** — assign a color per disc with presets or a custom color picker
- **Drag reorder** — manually sort your bag in custom mode
- **CSV import / export** — back up or move your collection

---

## Requirements

- Python 3.9+
- Flask

---

## Setup

**1. Clone the repo**

```bash
git clone https://github.com/flyboy-byte/disc-tracker.git
cd disc-tracker
```

**2. Install dependencies**

```bash
pip install flask
```

**3. Run**

```bash
python app.py
```

Opens on `http://localhost:5757`. The SQLite database and secret key are created automatically in `data/` on first launch.

---

## Running as a service (Linux / systemd)

A unit file is included. Edit `disc_tracker.service` to match your paths, then:

```bash
cp disc_tracker.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable disc_tracker
systemctl --user start disc_tracker
```

---

## Flight path visualization

Each disc card shows a top-down RHBH flight arc based on its flight numbers, split into two phases — high-speed turn and low-speed fade — colored by stability.

| Stability | Color |
|-----------|-------|
| Overstable | Orange |
| Stable | Blue |
| Understable | Green |

---

## Data

User data lives in `data/` and is excluded from version control. Nothing leaves your server.

---

## License

MIT
