# Setup Guide: Cross-Platform Dashboard Stack

Zero Android experience assumed. Follow in order.

---

## Prerequisites

### All platforms
- Python 3.8+ — check with `python3 --version`
- Git — check with `git --version`

### Android development
- [Android Studio](https://developer.android.com/studio) — free, installs everything you need (JDK, Android SDK, emulator)
- An Android phone **or** the built-in emulator (no physical device required to start)

Install Android Studio, open it, and let it finish the first-run setup wizard. This takes 10–20 minutes and downloads the Android SDK automatically.

---

## Step 1 — Project Folder Structure

Create your root folder. Everything lives here.

```
mkdir ~/dashboards
cd ~/dashboards
```

Create your first dashboard (habits as the example):

```
mkdir habits
cd habits
touch scanner.py dashboard.py cli.py
```

This folder (`~/dashboards/habits/`) will be watched by Syncthing later.

---

## Step 2 — Write the Habit Tracker (Desktop)

### `habits.db` schema

`scanner.py` creates the database on first run. The schema goes inside `scanner.py`:

```python
# scanner.py
import sqlite3
import json
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).parent / "habits.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(conn):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS habits (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            date        TEXT NOT NULL,
            habit_name  TEXT NOT NULL,
            completed   INTEGER DEFAULT 0,
            notes       TEXT
        );
        CREATE TABLE IF NOT EXISTS processed_files (
            path  TEXT PRIMARY KEY,
            mtime REAL
        );
    """)
    conn.commit()

def scan(source_path=None):
    conn = get_db()
    init_db(conn)
    # Add your data ingestion logic here
    # e.g. read a CSV and insert rows
    conn.close()
    print("Scan complete.")

if __name__ == "__main__":
    scan()
```

### `dashboard.py`

```python
# dashboard.py
import json
import os
import sqlite3
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

DB_PATH = Path(__file__).parent / "habits.db"
HOST = os.environ.get("HOST", "localhost")
PORT = int(os.environ.get("PORT", 8080))

def get_data():
    if not DB_PATH.exists():
        return {"error": "Run scanner.py first"}
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM habits ORDER BY date DESC LIMIT 100").fetchall()
    conn.close()
    return {"habits": [dict(r) for r in rows]}

HTML = """<!DOCTYPE html>
<html>
<head><title>Habits</title></head>
<body>
<canvas id="chart"></canvas>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"></script>
<script>
const isAndroid = typeof Android !== 'undefined';
async function load() {
    const data = isAndroid
        ? JSON.parse(Android.getData())
        : await fetch('/data').then(r => r.json());
    // render your Chart.js charts here using data.habits
    console.log(data);
}
load();
if (!isAndroid) setInterval(load, 30000);
</script>
</body>
</html>"""

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/data":
            body = json.dumps(get_data()).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(HTML.encode())
    def log_message(self, *args): pass

def serve():
    server = HTTPServer((HOST, PORT), Handler)
    print(f"Dashboard → http://{HOST}:{PORT}")
    server.serve_forever()

if __name__ == "__main__":
    serve()
```

### `cli.py`

```python
# cli.py
import sys
import webbrowser
import threading
import time

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"
    if cmd == "scan":
        from scanner import scan; scan()
    elif cmd == "dashboard":
        from scanner import scan; scan()
        from dashboard import serve, HOST, PORT
        threading.Timer(1, lambda: webbrowser.open(f"http://{HOST}:{PORT}")).start()
        serve()
    else:
        print("Commands: scan | dashboard")

if __name__ == "__main__":
    main()
```

### Run it

```bash
cd ~/dashboards/habits
python3 cli.py scan
python3 cli.py dashboard
```

Browser opens at `http://localhost:8080`.

---

## Step 3 — Set Up Syncthing

Syncthing copies your `.db` file to your Android phone automatically.

### Install

| Platform | Download |
|---|---|
| Windows | [syncthing.net](https://syncthing.net/) → Windows installer |
| macOS | `brew install syncthing` or download from site |
| Linux | `sudo apt install syncthing` |
| Android | Install **Syncthing** from the Play Store |

### Configure

1. Start Syncthing on desktop → opens at `http://localhost:8384`
2. Start Syncthing on Android
3. On desktop, click **Add Remote Device** → scan the QR code shown in the Android app
4. On desktop, click **Add Folder** → point it at `~/dashboards/`
5. Share that folder with your Android device
6. On Android, accept the incoming folder share → set the destination to `/storage/emulated/0/dashboards/`

After a few seconds, your `habits.db` should appear on the phone.

**Verify on Android:** Use a file manager app to check that `/storage/emulated/0/dashboards/habits/habits.db` exists.

---

## Step 4 — Create the Android App

Open Android Studio. Create a new project:

- Template: **Empty Views Activity**
- Name: `Dashboards`
- Package: `com.yourname.dashboards`
- Language: **Kotlin**
- Min SDK: API 26 (Android 8.0) — covers ~95% of devices

### Add dependencies

Open `app/build.gradle` and add inside `dependencies {}`:

```gradle
implementation "androidx.room:room-runtime:2.6.1"
kapt "androidx.room:room-compiler:2.6.1"
implementation "com.google.code.gson:gson:2.10.1"
```

Add `kapt` plugin at the top of the file:
```gradle
plugins {
    id 'com.android.application'
    id 'kotlin-android'
    id 'kotlin-kapt'   // ← add this
}
```

Click **Sync Now** when prompted.

### Room database files

Create these Kotlin files in `app/src/main/java/com/yourname/dashboards/`:

**`Habit.kt`** — data model:
```kotlin
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "habits")
data class Habit(
    @PrimaryKey val id: Int,
    val date: String,
    val habit_name: String,
    val completed: Int,
    val notes: String?
)
```

**`HabitsDao.kt`** — queries:
```kotlin
import androidx.room.*

@Dao
interface HabitsDao {
    @Query("SELECT * FROM habits ORDER BY date DESC")
    fun getAll(): List<Habit>
}
```

**`HabitsDatabase.kt`** — database:
```kotlin
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import android.content.Context

@Database(entities = [Habit::class], version = 1, exportSchema = false)
abstract class HabitsDatabase : RoomDatabase() {
    abstract fun habitsDao(): HabitsDao

    companion object {
        fun open(context: Context): HabitsDatabase =
            Room.databaseBuilder(
                context,
                HabitsDatabase::class.java,
                "/storage/emulated/0/dashboards/habits/habits.db"
            )
            .allowMainThreadQueries()  // fine for read-only personal apps
            .build()
    }
}
```

**`HabitsBridge.kt`** — JavaScript bridge:
```kotlin
import android.webkit.JavascriptInterface
import com.google.gson.Gson

class HabitsBridge(private val dao: HabitsDao) {
    @JavascriptInterface
    fun getData(): String = Gson().toJson(mapOf("habits" to dao.getAll()))
}
```

### WebView in MainActivity

Replace the contents of `MainActivity.kt`:

```kotlin
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val db = HabitsDatabase.open(this)
        val bridge = HabitsBridge(db.habitsDao())
        
        val webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.allowFileAccessFromFileURLs = true
        webView.addJavascriptInterface(bridge, "Android")
        webView.webViewClient = WebViewClient()
        webView.loadUrl("file:///android_asset/habits/index.html")
        
        setContentView(webView)
    }
}
```

### Add the HTML asset

1. In Android Studio, right-click `app/src/main` → New → Directory → `assets`
2. Inside `assets/`, create folder `habits/`
3. Copy your `dashboard.py` HTML string into a file: `assets/habits/index.html`
4. Download [Chart.js](https://cdn.jsdelivr.net/npm/chart.js/dist/chart.umd.min.js) and save as `assets/habits/chart.min.js`
5. Update the `<script>` tag in `index.html` to load locally:

```html
<script src="chart.min.js"></script>
```

### Add storage permission

In `AndroidManifest.xml`, inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
```

For Android 13+, also add:
```xml
<uses-permission android:name="android.permission.READ_MEDIA_FILES"/>
```

### Run

Connect your phone via USB (enable USB debugging in Developer Options), or use the emulator. Click the green **Run** button in Android Studio.

---

## Step 5 — Adding a Second Dashboard

Follow this checklist for every new dashboard:

```
Desktop:
[ ] Create dashboards/{name}/
[ ] Write scanner.py (schema + ingest logic)
[ ] Write dashboard.py (HTTP + /data endpoint + HTML string)
[ ] Write cli.py
[ ] Test: python3 cli.py dashboard

Android:
[ ] Write {Name}.kt, {Name}Dao.kt, {Name}Database.kt, {Name}Bridge.kt
[ ] Create assets/{name}/index.html + chart.min.js
[ ] Add bridge in MainActivity.kt
[ ] Add a nav menu to switch between dashboards

Sync:
[ ] Confirm {name}.db appears in Syncthing-watched folder
[ ] Verify file appears on phone before first Android run
```

---

## Troubleshooting

**`habits.db` not appearing on phone**
- Check Syncthing is running on both devices
- Check both are on the same Wi-Fi network (for LAN sync)
- Check the folder path matches exactly on both sides

**Android app crashes on launch**
- Check `READ_EXTERNAL_STORAGE` permission is in manifest
- On Android 6+, you may need to grant storage permission manually: Settings → Apps → Dashboards → Permissions

**WebView shows blank page**
- Check `index.html` is in `assets/habits/`
- Check `allowFileAccessFromFileURLs = true` is set
- Open Chrome on the connected phone, go to `chrome://inspect` on desktop to see WebView console errors

**Room crashes with schema mismatch**
- The `.db` file was created by Python with a different schema than Room expects
- Solution: uninstall the app, delete the `.db` from the phone, resync, reinstall

**Port already in use on desktop**
- `PORT=8090 python3 cli.py dashboard`
