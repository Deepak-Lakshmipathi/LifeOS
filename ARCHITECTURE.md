# Architecture: Cross-Platform Local-First Dashboard System

## What This Is

A personal data platform for running isolated, purpose-built dashboards across Windows/macOS/Linux and Android. Each dashboard is a self-contained app (habit tracker, finance log, environmental tracker, etc.) that shares the same underlying stack. No cloud accounts. No third-party backends. Data lives locally and syncs peer-to-peer via Syncthing.

---

## Core Design Principles

| Principle | Decision |
|---|---|
| Zero cloud dependency | Syncthing P2P sync only |
| No install friction | Python stdlib on desktop, no pip required |
| One schema per dashboard | Isolated SQLite DB per app |
| One UI codebase | HTML/JS served via WebView on Android |
| Offline-first | Android reads local SQLite copy; sync is on-demand |

---

## Full Stack

```
                    TickTick API
                    (open/v1 REST)
                         │
                    ticktick_sync.py
                    (OAuth2, urllib only)
                         │
┌────────────────────────▼────────────────────────────┐
│                  DESKTOP (Win/Mac/Linux)             │
│                                                      │
│  scanner.py  ──►  SQLite DB  ◄──  ticktick_sync.py  │
│  (local data)     (source of       (API → upsert)   │
│                    truth)                            │
│                        │                             │
│                   dashboard.py                       │
│                   /data + /progress endpoints        │
│                   localhost:8080 → browser tab       │
└────────────────────────┬────────────────────────────┘
                         │
                  Syncthing (P2P)
                  syncs the .db file
                         │
┌────────────────────────┴────────────────────────────┐
│                     ANDROID                          │
│                                                      │
│  Synced SQLite  ──►  Room (Kotlin)  ──►  WebView     │
│  (local copy)        (query layer)      (renders      │
│                      getData()          HTML/JS UI    │
│                      getProgress()      + progress    │
│                                          bar)         │
└─────────────────────────────────────────────────────┘
```

---

## Layer Breakdown

### 1. Data Layer — SQLite

- One `.db` file per dashboard (e.g. `habits.db`, `finance.db`, `enviro.db`)
- Stored in a Syncthing-watched folder (e.g. `~/dashboards/`)
- Schema is defined once and shared across platforms
- On Android, Room reads the same `.db` file — no schema translation needed

### 2. Sync Layer — Syncthing

- Watches `~/dashboards/` on desktop
- Syncs to `/storage/emulated/0/dashboards/` on Android
- Sync is triggered on-demand or on file change
- No account, no server, works on LAN or internet
- **Critical:** Never write to the DB from Android while desktop is also writing. Treat desktop as the write source; Android as read-only by default.

### 3. Desktop App Layer — Python (stdlib only)

Each dashboard has three core Python files, plus an optional sync module per external service:

| File | Role |
|---|---|
| `scanner.py` | Ingests raw data (CSV, JSONL, manual entry) into SQLite |
| `dashboard.py` | HTTP server serving `/data`, `/progress`, and the HTML UI |
| `cli.py` | Entry point: `scan`, `today`, `stats`, `dashboard`, `sync`, `{service}-auth` |
| `ticktick_sync.py` | (optional) Fetches TickTick tasks via REST API, upserts into SQLite |

No pip installs. No virtual environments. Runs on Python 3.8+. External API calls use `urllib` from stdlib.

### 4. Android App Layer — Kotlin + WebView (Option B)

The Android app is a thin shell. It does three things:

1. **Room** reads the synced SQLite file and exposes data as JSON
2. **WebView** loads `index.html` from the app's `assets/` folder
3. A **JavaScript bridge** (`@JavascriptInterface`) passes JSON from Room to the HTML page

The HTML/JS UI is the same codebase as the desktop dashboard — just loaded locally instead of over HTTP.

```
assets/
  index.html     ← same HTML as desktop dashboard.py generates
  chart.min.js   ← Chart.js bundled locally (no CDN needed on Android)
  bridge.js      ← thin JS wrapper for the Android JavascriptInterface
```

---

## External API Integration — TickTick

TickTick is the first approved external API. The pattern it establishes applies to any future service.

**Key facts about the TickTick API:**
- Official REST API at `https://api.ticktick.com/open/v1`
- OAuth 2.0 with scopes `tasks:read` / `tasks:write`
- No webhooks — polling only (fits the on-demand `cli.py sync` pattern)
- Task status: `0` = active, `2` = completed
- Completed tasks are not returned by default from `/project/{id}/data` — only active tasks

**Data flow:**
```
TickTick servers
      │  HTTPS (urllib, no pip)
      ▼
ticktick_sync.py
  fetch_and_store()
      │  upsert via ON CONFLICT(ticktick_id)
      ▼
tasks table in {name}.db
      │  Syncthing
      ▼
Android Room → getProgress() bridge → WebView progress bar
```

**Credentials:** Stored in `.env` (gitignored). Token cached in `.ticktick_token` (gitignored). One-time auth via `python3 cli.py ticktick-auth`. Subsequent syncs via `python3 cli.py sync`.

**Tasks table schema (added to any TickTick-enabled dashboard):**
```sql
CREATE TABLE IF NOT EXISTS tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    ticktick_id  TEXT UNIQUE NOT NULL,
    project_id   TEXT,
    title        TEXT,
    status       INTEGER DEFAULT 0,   -- 0=active, 2=completed
    due_date     TEXT,
    synced_at    TEXT
);
```

---

Each dashboard is fully isolated. Adding a new dashboard means:

```
dashboards/
  habits/
    habits.db
    scanner.py
    dashboard.py
    cli.py
  finance/
    finance.db
    scanner.py
    dashboard.py
    cli.py
  enviro/
    enviro.db
    scanner.py
    dashboard.py
    cli.py
```

On Android, a single app hosts all dashboards. A nav menu lists available dashboards. Selecting one swaps the SQLite source Room reads from and reloads the WebView with the matching HTML.

---

## Broad Use Case: Habit Tracker

**Desktop flow:**
1. `python cli.py scan` — reads a `habits.csv` you update daily, writes to `habits.db`
2. `python cli.py dashboard` — opens browser with streak charts, completion rates, trend lines

**Android flow:**
1. Syncthing delivers updated `habits.db` to phone
2. App opens — Room queries the DB, passes JSON to WebView
3. WebView renders the same Chart.js dashboard, offline

**Schema example:**
```sql
CREATE TABLE habits (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT NOT NULL,        -- ISO 8601: 2025-04-19
    habit_name  TEXT NOT NULL,
    completed   INTEGER DEFAULT 0,    -- 0 or 1
    notes       TEXT
);
```

---

## Sync Safety Rules

1. Desktop is the **write source**. Android is **read-only**.
2. Syncthing syncs the `.db` file only after the desktop process closes its connection.
3. Use `processed_files` table (as in claude-usage) to make scans incremental — safe to re-run.
4. If bi-directional write is ever needed, use JSONL append logs on Android and merge on desktop.

---

## What This Is Not

- Not a cloud app — no Firebase, no Supabase, no cloud sync. Exception: approved outbound API calls (TickTick) from desktop only
- Not a native Android UI — Jetpack Compose is not used; WebView renders the UI
- Not a multi-user system — single user, personal data only
- Not always-on — sync happens when both devices are reachable; app works offline
- Not real-time — TickTick data is polled on demand via `cli.py sync`, not pushed
