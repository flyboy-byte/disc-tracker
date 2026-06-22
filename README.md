# Disc Tracker

A personal disc golf bag tracker. Log your discs, visualize flight paths, and keep your bag organized — all from a clean web UI running on your own server.

![Disc Tracker screenshot](docs/screenshot.png)

---

## Features

- **Multi-user** — profile picker on launch, no passwords, each user has their own bag
- **Disc library** — search 1,660 discs by name or manufacturer, auto-fill flight numbers
- **Flight path arcs** — top-down RHBH visualization per disc, shaped by speed/glide/turn/fade
- **Stability filtering** — filter by overstable / stable / understable, or by disc type
- **Disc colors** — assign a color to each disc with presets or a custom color picker
- **Drag reorder** — manually sort your bag in custom mode
- **CSV import / export** — back up or move your collection

---

## Requirements

- Python 3.9+
- Flask

```bash
pip install flask
```

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

**3. Run the app**

```bash
python app.py
```

The app starts on `http://localhost:5757`. On first launch it creates the SQLite database automatically.

---

## Running as a service (Linux / systemd)

A systemd unit file is included. Edit `disc_tracker.service` to match your paths, then:

```bash
cp disc_tracker.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable disc_tracker
systemctl --user start disc_tracker
```

---

## Data

User data (the SQLite database and secret key) is stored in `data/` and is excluded from version control. The `data/` folder is created automatically on first run.

---

## Flight path visualization

Each disc card shows a top-down flight path arc based on its flight numbers. The path is split into two phases — the high-speed turn phase and the low-speed fade — colored by stability class.

| Stability | Color |
|-----------|-------|
| Overstable | Orange |
| Stable | Blue |
| Understable | Green |

---

## License

MIT
