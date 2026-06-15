# CLAUDE.md — Dashboard Stack Design Language

> Inject this file into context at the start of any coding session for this project.
> Keep responses consistent with the decisions below. Do not propose alternatives unless explicitly asked.

---

## Project Identity

A local-first, cross-platform personal dashboard system. Desktop (Python) + Android (Kotlin + WebView). Sync via Syncthing. No cloud. No external dependencies beyond stdlib.

---

## Absolute Rules

- **No pip installs.** Python stdlib only on desktop (`sqlite3`, `http.server`, `json`, `pathlib`, `datetime`, `urllib`).
- **No npm on desktop.** Chart.js loads from CDN on desktop; bundled locally in Android assets.
- **No cloud sync.** No Firebase, no Supabase. Syncthing only. Exception: outbound API calls to approved external services (TickTick) are permitted from desktop scanner only.
- **No Jetpack Compose.** Android UI is WebView only.
- **No bi-directional DB writes.** Desktop writes. Android reads.
- **One DB per dashboard.** Never share a SQLite file across dashboards.
- **Android never calls external APIs.** All API sync happens on desktop via scanner.py. Android reads the result from SQLite only.

---

## File Structure Convention

Every dashboard follows this pattern exactly:

```
dashboards/
  {name}/
    {name}.db            # SQLite database
    scanner.py           # ingest raw data → SQLite
    dashboard.py         # HTTP server + HTML string generator
    cli.py               # entry point: scan | today | stats | dashboard | sync
    ticktick_sync.py     # (optional) TickTick API → SQLite; only present if dashboard uses TickTick
    .ticktick_token      # cached OAuth token — NEVER commit to git
    .env                 # TICKTICK_CLIENT_ID, TICKTICK_CLIENT_SECRET — NEVER commit to git
```

Android app:
```
app/src/main/
  assets/
    {name}/
      index.html       # dashboard UI (mirrors desktop HTML output)
      chart.min.js     # Chart.js bundled
      bridge.js        # JavascriptInterface wrapper
  java/.../
    {Name}Database.kt  # Room DB
    {Name}Dao.kt       # Room DAO
    {Name}Bridge.kt    # @JavascriptInterface class
    MainActivity.kt    # nav + WebView host
```

---

## Python Conventions

```python
# DB path pattern — always relative to the script
DB_PATH = Path(__file__).parent / "{name}.db"

# Scanner is always incremental
# Track processed files by path + mtime in processed_files table

# dashboard.py always generates HTML as a Python string
# Never use template files or Jinja

# HTTP server always reads HOST and PORT from env with defaults
HOST = os.environ.get("HOST", "localhost")
PORT = int(os.environ.get("PORT", 8080))
```

SQLite schema conventions:
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- Dates as `TEXT` in ISO 8601 (`YYYY-MM-DD`)
- Timestamps as `TEXT` in ISO 8601 (`YYYY-MM-DDTHH:MM:SSZ`)
- Booleans as `INTEGER` (0/1)
- No foreign keys across dashboards

---

## External API Conventions (TickTick and future services)

All external API calls live in a dedicated `{service}_sync.py` file. Never inline API calls in `scanner.py` or `dashboard.py`.

```python
# Pattern for all external API sync modules
# Uses urllib only — no pip installs

TOKEN_PATH = Path(__file__).parent / ".{service}_token"
BASE_URL = "https://api.{service}.com/..."

def get_token() -> dict: ...          # loads cached token from TOKEN_PATH
def refresh_token() -> dict: ...      # exchanges refresh_token for new access_token
def api_get(path: str) -> dict: ...   # authenticated GET via urllib
def fetch_and_store(conn, **kwargs):  # upserts API response into SQLite
    ...                               # always uses INSERT OR REPLACE / ON CONFLICT
```

TickTick task status values: `0` = active, `2` = completed.

Progress bar formula: `percent = (completed / total) * 100` — computed in SQL or JS, never hardcoded.

Credentials are always loaded from `.env` in the dashboard folder:
```python
from pathlib import Path

def load_env():
    env = {}
    env_file = Path(__file__).parent / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env
```

CLI commands added by any sync module:
- `python3 cli.py ticktick-auth` — one-time OAuth browser flow, caches token
- `python3 cli.py sync` — calls all registered `_sync.py` modules, updates DB

---

## Android Conventions

Room always opens the Syncthing-synced file by absolute path:
```kotlin
Room.databaseBuilder(
    context,
    {Name}Database::class.java,
    "/storage/emulated/0/dashboards/{name}/{name}.db"
).build()
```

JavaScript bridge pattern:
```kotlin
class {Name}Bridge(private val dao: {Name}Dao) {
    @JavascriptInterface
    fun getData(): String = Gson().toJson(dao.getAll())

    // For dashboards with TickTick sync:
    @JavascriptInterface
    fun getProgress(): String {
        val total = dao.total()
        val completed = dao.completed()
        return Gson().toJson(mapOf(
            "total" to total,
            "completed" to completed,
            "percent" to if (total > 0) (completed * 100 / total) else 0
        ))
    }
}

// In Activity:
webView.addJavascriptInterface({Name}Bridge(dao), "Android")
```

HTML bridge call pattern (in index.html):
```javascript
const data = JSON.parse(Android.getData());
// render with Chart.js
```

WebView must always enable:
```kotlin
webView.settings.javaScriptEnabled = true
webView.settings.allowFileAccessFromFileURLs = true
webView.loadUrl("file:///android_asset/{name}/index.html")
```

---

## HTML/JS Dashboard Conventions

- Chart.js only. No React, no Vue, no build step.
- All charts in a single `index.html` file.
- Data arrives via `Android.getData()` on Android, or via a `fetch('/data')` call on desktop.
- Detect platform at runtime:
```javascript
const isAndroid = typeof Android !== 'undefined';
const data = isAndroid
  ? JSON.parse(Android.getData())
  : await fetch('/data').then(r => r.json());

// For progress bar (TickTick-enabled dashboards):
const progress = isAndroid
  ? JSON.parse(Android.getProgress())
  : await fetch('/progress').then(r => r.json());

document.getElementById('progress-bar').style.width = progress.percent + '%';
document.getElementById('progress-label').textContent =
  `${progress.completed} of ${progress.total} done`;
```
- Auto-refresh on desktop only (30s interval, skip if `isAndroid`).

---

## Naming Conventions

| Thing | Pattern | Example |
|---|---|---|
| Dashboard folder | lowercase, no spaces | `habits`, `finance`, `enviro` |
| SQLite file | `{name}.db` | `habits.db` |
| Sync module | `{service}_sync.py` | `ticktick_sync.py` |
| Token cache | `.{service}_token` | `.ticktick_token` |
| Room DB class | `{Name}Database` | `HabitsDatabase` |
| Room DAO | `{Name}Dao` | `HabitsDao` |
| Bridge class | `{Name}Bridge` | `HabitsBridge` |
| JS bridge name | `Android` | always `Android` |
| HTTP data endpoint | `/data` | always `/data` |
| HTTP progress endpoint | `/progress` | always `/progress` (if TickTick enabled) |

---

## Adding a New Dashboard — Checklist

```
[ ] Create dashboards/{name}/ folder
[ ] Write {name}.db schema (scanner.py creates it on first run)
[ ] Write scanner.py (ingest → SQLite, incremental)
[ ] Write dashboard.py (HTTP server, /data endpoint returns JSON, / returns HTML)
[ ] Write cli.py (scan | today | stats | dashboard | sync commands)
[ ] Write index.html (Chart.js, platform detection, Android.getData())
[ ] Add {Name}Database.kt, {Name}Dao.kt, {Name}Bridge.kt
[ ] Register bridge in MainActivity.kt nav menu
[ ] Copy index.html + chart.min.js + bridge.js to assets/{name}/
[ ] Add {name}.db path to Syncthing watch folder

If using TickTick:
[ ] Write ticktick_sync.py (OAuth flow + fetch_and_store)
[ ] Add tasks table to schema (ticktick_id UNIQUE, status INTEGER)
[ ] Add ticktick-auth and sync commands to cli.py
[ ] Add /progress endpoint to dashboard.py
[ ] Add getProgress() to {Name}Bridge.kt
[ ] Add progress bar HTML/JS to index.html
[ ] Create .env with TICKTICK_CLIENT_ID and TICKTICK_CLIENT_SECRET
[ ] Add .env and .ticktick_token to .gitignore
```

---

## What Claude Should Never Do in This Project

- Suggest adding a backend framework (Flask, FastAPI, Django)
- Suggest a frontend framework (React, Vue, Svelte)
- Suggest cloud storage or sync (exception: TickTick and similar approved APIs are outbound only)
- Add pip dependencies to desktop code
- Use Jetpack Compose for UI
- Write to the DB from Android
- Create shared state between dashboards
- Call external APIs from Android (Kotlin) — all API sync is desktop-only
- Store credentials in code — always load from `.env`
