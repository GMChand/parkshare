# ParkShare — Community-Driven Parking 🅿️

A community-driven parking app with Google Maps, real-time traffic, address search, and combined community + Google parking data. Runs entirely client-side; deploy on GitHub Pages.

## ✨ Features

- 🗺️ **Google Maps** with one-finger pan, two-finger pinch, and **double-tap to drop a pin**
- 🅿️ **Both Google parking + user-submitted spots** on the same map
- 🟢🟡🔴 **Unified red/yellow/green** traffic-access color system across both sources
- 🚦 **Live road traffic layer** toggle
- 🔍 **Address search** with autocomplete — search from current location *or* a typed address
- 📏 **Radius filter** (1, 3, 5, 10, 25 km) — only shows spots within range
- 📍 **Reverse geocoding** — drop a pin and address autofills
- 🎯 **Draggable pin** in the report form for precise positioning
- ⏱️ **Smart parking timer** with adjustable duration
- ✏️ **Community contributions** — add, correct, delete spots

## 🔑 Google Cloud Setup — IMPORTANT

This version requires **three APIs** enabled in your Google Cloud project. Open [Google Cloud Console](https://console.cloud.google.com/), then under your project:

**APIs & Services → Library**, find and enable each:

| API | Why we need it |
|---|---|
| **Maps JavaScript API** | The map itself |
| **Places API (New)** | Search autocomplete + Nearby Search for Google parking lots |
| **Geocoding API** | Reverse-geocode pin drops into addresses |

The same API key works for all three. You don't need separate keys.

Also confirm your API key restrictions allow all three APIs:
**APIs & Services → Credentials → your key → Edit → API restrictions**: select **Maps JavaScript API**, **Places API (New)**, and **Geocoding API**.

And keep your HTTP referrer restriction set to your GitHub Pages domain (e.g. `https://YOUR-USERNAME.github.io/*` and `http://localhost/*` for local testing).

Paste your key into `js/config.js`:

```js
const GOOGLE_MAPS_API_KEY = 'AIzaSyXXXXXXXXXXXXXXXXXXXXXXXX';
```

## 💰 Cost note

Each map load, places search, distance matrix call, and geocode counts against the $200/month free credit. The app makes one Places Nearby Search + one Distance Matrix call every time the search center or radius changes. For a small demo project you'll stay well within the free tier; if it scales up, monitor your billing dashboard.

## 🚀 Run It

### Locally
```bash
python -m http.server 8000
# or
npx serve
```
Then open `http://localhost:8000`.

### On GitHub Pages
1. Push to GitHub.
2. **Settings → Pages → Source: Deploy from branch → main → / (root)**.
3. Visit `https://YOUR-USERNAME.github.io/REPO-NAME/`.

## 🎨 How the busyness colors work

Both Google parking and user-submitted spots use the **same green/yellow/red** scale, but the data sources differ:

| Source | Signal | What the color means |
|---|---|---|
| **User-submitted spots** | Free spots reported | Green = 4+ free, Yellow = 2–3, Red = 0–1 |
| **Google parking lots** | Road traffic delay around the lot (via Distance Matrix) | Green = roads flowing, Yellow = some delay, Red = heavy congestion |

**Why two signals for the same colors?** Google does not expose real-time lot occupancy through any public API. The closest objective signal Google provides for "is this parking lot easy to access right now?" is road traffic in its vicinity, which we get from the Distance Matrix `duration_in_traffic` field. The InfoWindow for Google spots makes this distinction explicit so users aren't misled.

Thresholds are tweakable in `js/config.js` (`BUSYNESS` and `TRAFFIC_BUSYNESS` constants).

## 🎮 Mobile gestures

- **One finger drag**: pan the map
- **Two fingers pinch**: zoom in/out
- **Double tap**: drop a parking pin at that location (haptic feedback on supported devices)
- **Drag the pin**: fine-tune the exact spot
- **Hit Continue**: opens the full report form with the address pre-filled

This is enabled via Google Maps' `gestureHandling: 'greedy'` setting combined with `disableDoubleClickZoom: true` so we can repurpose double-tap for pin drops.

## 📁 Project Structure

```
parkshare/
├── index.html              # Home: map + list + search
├── pages/details.html      # Spot details + timer
├── css/styles.css
├── js/
│   ├── config.js           # 👈 paste API key here
│   ├── data.js             # storage + busyness helpers
│   ├── app.js              # Home screen (gestures, search, pin flow)
│   └── details.js          # Details page + timer
├── README.md
└── .gitignore
```

## 🔄 Going beyond MVP

User-submitted spots still live in `localStorage`, so they're not shared across users. Swap `DataStore` in `js/data.js` for Firebase Firestore or Supabase to make it a true shared community app — the rest of the codebase doesn't need to change.

## 📄 License

MIT
