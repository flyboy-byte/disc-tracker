# Sync / Backup Design (roadmap step R5)

> **Status:** design locked 2026-07-25 (decisions below). **Build deferred to roadmap step
> R5** — after app polish (R1–R3) and Marshall Street (R4), before the store track (R6/R7).
> This is the authoritative design for sync; where it differs from the older minimal sketch
> in [`../../PORT_PLAN.md`](../../PORT_PLAN.md) "Phase 10 — VPS Sync", this doc wins.
>
> Bound by the **Network-feature privacy bar** (PORT_PLAN.md, Post-v1 Roadmap) because the
> developer reviews F-Droid MRs himself — this feature must pass PCAPdroid/permission review.

## What it is (and isn't)

Manual **backup / restore** between the phone (local SQLite, the source of truth) and the
developer's **own Flask VPS** (the same app that runs the website). It is **not** real-time
sync, **not** a third-party cloud, **not** a multi-device merge engine. Full-replace, one
direction at a time, user-initiated.

Data is a disc-golf bag — small (dozens–hundreds of rows) and low-sensitivity.

## Decisions (locked 2026-07-25)

1. **Model — full replace, one direction at a time.** Two explicit actions:
   - **Back up to server** (phone → VPS): replaces the server-side bag for the chosen user.
   - **Restore from server** (VPS → phone): replaces the local bag.
   No CRDT/merge — pointless for a single-user bag, and full-replace matches the existing
   `/api/data` export/import contract.

2. **Pre-flight overwrite confirmation (both directions).** Before any destructive replace,
   show what's about to be clobbered: *"Server has 47 discs, last modified 2026-07-20 —
   overwrite with your 51?"* (and the reverse for restore). This is the core transparency
   affordance and the guard against silent data loss.

3. **Trigger — manual only.** Zero network on launch or in the background. Every request is
   user-initiated (tap Back up / Restore / Test connection). A "last synced N days ago"
   line is **UI-only** (reads a stored timestamp; makes no network call). This is forced by
   the privacy bar, not just preferred.

4. **Transport — HTTPS mandatory; cleartext disabled in release.**
   ⚠️ **Infra prerequisite:** the VPS currently answers on `http://51.81.80.126` (bare IP,
   no TLS). A bearer token over plain HTTP is sniffable. Sync needs the Flask app behind a
   domain + TLS (Caddy / Let's Encrypt) **before** it's usable. Track this as an ops task,
   not a code task. The release manifest must **not** allow cleartext traffic.

5. **Encryption at rest — none (plaintext on the own VPS).** Same as the website already
   stores it; the website has to *read* the bag to display it, so end-to-end encryption
   would defeat the purpose. TLS covers in-transit. **Revisit path (documented, not built):**
   if the threat model ever includes an untrusted server, add an E2E encrypted-blob mode
   (the old "Path C" from RESEARCH.md §2) — at the cost of the website no longer being able
   to render the synced bag.

6. **Identity / auth — single `SYNC_TOKEN` gates the endpoints; user selected behind it.**
   The website is **already passwordless** (`/pick` lets anyone reaching the site select and
   edit any user's bag — no accounts by design). So:
   - **Fully-open sync endpoints would be the one real nightmare** — not reads, but
     unauthenticated **writes**: anyone on the internet could overwrite/destroy any bag.
   - The fix is one deployment-level secret: `SYNC_TOKEN` (env var on the VPS). All sync
     endpoints require `Authorization: Bearer <SYNC_TOKEN>`. *Behind* the token, the request
     names which user to act on (by id/username) — as open as `/pick` already is, nothing
     new exposed. One secret stops random internet vandalism.
   - This is simpler than per-user token tables (no issuance/revocation) and matches the
     site's trust model. **Upgrade path (documented, not built):** per-user tokens + a
     `sync_tokens` table if real per-user isolation is ever wanted.

7. **Token storage on device — Android Keystore via `expo-secure-store`.** Never plaintext
   in SQLite / AsyncStorage. The token is the one real at-rest secret to protect.

## Protocol

Reuse the existing endpoints, add a token guard and a lightweight metadata probe:

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| GET | `/api/data?user=<id\|name>` | Pull full bag (restore source) | Bearer |
| POST | `/api/data?user=<id\|name>` | Push full bag (replace server-side) | Bearer |
| GET | `/api/data/meta?user=<id\|name>` | `{count, last_modified, username}` — powers the pre-flight overwrite check **and** the "Test connection" button; transfers no bag data | Bearer |

- Payload carries a `schema_version` field for forward-compat (reject/migrate on mismatch).
- User selection param mirrors the website's `/pick` semantics — consistent mental model.

## Backend (Flask) changes — minimal

```python
SYNC_TOKEN = os.environ.get('SYNC_TOKEN')

def check_sync_token():
    if not SYNC_TOKEN or request.headers.get('Authorization') != f'Bearer {SYNC_TOKEN}':
        abort(401)
```

- Guard the three routes with `check_sync_token()`.
- Reuse the existing `discs` table + the `/api/data` GET/POST logic; add the `?user=` select
  and the `/meta` route. **No new tables** for sync v1 (single token).
- Basic rate-limit is nice-to-have (it's the user's own VPS, low risk).

## Mobile (Settings screen) changes

- Fields: server URL, `SYNC_TOKEN`, username/user to act as.
- Buttons: **Back up to server**, **Restore from server**, **Test connection** (hits `/meta`).
- Each destructive action → pre-flight confirmation from `/meta`.
- Persistent, honest disclosure line: *"Syncs only when you tap, only to this URL. No data
  leaves your device otherwise."*
- Store URL/user in normal prefs; store the token in `expo-secure-store`.
- Last-synced timestamp + direction shown; updated locally, no background polling.

## Transparency summary (answers "how transparent")

- Nothing happens without a tap; the UI states exactly what will be sent/received and to
  where, before it happens.
- Pre-flight "overwrite?" on both directions — no silent clobber.
- Both ends open source — anyone can audit the wire format.
- PCAPdroid-clean by construction (manual only, single configured host, no telemetry).

## Revisit / explicitly out of scope for sync v1

- **E2E encrypted blob** (untrusted-server threat model) — see decision 5.
- **Per-user tokens / token issuance + revocation** — see decision 6.
- **Bidirectional / multi-device auto-sync** — only if that use case actually appears; the
  full-replace + pre-flight model is deliberately single-user.

## Before submitting the sync release to Play / F-Droid

Carried over from PORT_PLAN.md Phase 10 (still required):
- Data Safety form wording: opt-in, user-provided server, user-initiated, user-deletable,
  server is not developer-operated (research how Syncthing/Nextcloud word this).
- Privacy policy gains a sync section.
- Re-run the permission/PCAPdroid audit with sync enabled.
