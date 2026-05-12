# ParkShare — Community-Driven Parking 🅿️

A community-driven web app for finding and sharing free parking spots in real time. Built with vanilla HTML, CSS, JavaScript, and **Google Maps**. Hosts perfectly on GitHub Pages.

## ✨ Features

- 🗺️ **Google Maps view** of community-reported parking spots
- 🚦 **Live road traffic layer** (Google's real-time traffic) — toggle on/off
- 🟢🟡🔴 **Community busyness indicator** — each spot shows green/yellow/red based on free spots reported
- 📋 **Distance-sorted list** of nearby spots
- 📍 **Geolocation** support
- ⏱️ **Smart parking timer** with adjustable duration
- ✏️ **Community contributions** — report, correct, delete spots

## ⚠️ Before You Start: Get a Google Maps API Key

This app needs a Google Maps JavaScript API key.

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and sign in.
2. Create a new project (e.g. "parkshare").
3. Search **"Maps JavaScript API"** at the top → **Enable**. You'll be asked to set up billing (credit card required, but the free tier covers ~28,000 map loads/month — far more than a demo needs).
4. **APIs & Services → Credentials → Create Credentials → API key**. Copy the key.
5. **Restrict the key** (important):
   - **Application restrictions:** HTTP referrers → add `http://localhost/*` and `https://YOUR-USERNAME.github.io/*`
   - **API restrictions:** select only **Maps JavaScript API**
6. Open `js/config.js` and paste your key:
   ```js
   const GOOGLE_MAPS_API_KEY = 'AIzaSyXXXXXXXXXXXXXXXXXXXXXXXX';
   ```

## 🚀 Run It

### Locally
Because of the API key referrer restriction, you can't just double-click `index.html`. Use a simple local server. Easiest options:

- **Python:** `python -m http.server 8000` then open `http://localhost:8000`
- **Node:** `npx serve` then open the URL it prints
- **VS Code Live Server** extension

### On GitHub Pages
1. Push to GitHub.
2. **Settings → Pages → Source: Deploy from branch → main → / (root)**.
3. Visit `https://YOUR-USERNAME.github.io/REPO-NAME/`.

## 🚦 How the Busyness Indicator Works

There are two separate signals, and it's worth understanding which is which:

### 1. Community busyness (the colored dots on parking spots)
This is **community-driven**, based on the number of free spots the latest reporter said are available. It's not Google data; it's your users' data.

| Free spots reported | Color | Meaning |
|---|---|---|
| 4 or more | 🟢 Green | Not busy |
| 2–3 | 🟡 Yellow | Medium |
| 0–1 | 🔴 Red | Busy |
| No update in last 6 hours | ⚪ Gray | Stale data |

You can change these thresholds in `js/config.js` (`BUSYNESS` constants).

### 2. Google's road traffic layer (the toggle button)
This is Google's **real-time road traffic** — green/orange/red lines on roads, same as you see in the Google Maps app. Toggle it with the 🚦 Traffic button.

**Why two signals?** Google does not expose a public API for parking lot busyness. The "Popular Times" data inside the Google Maps app is internal. The closest official proxy Google offers is road traffic, which tells you if the *area* around the spot is busy. Combined with community reports of actual free spots, you get a complete picture.

## 📁 Project Structure

```
parkshare/
├── index.html              # Home: map + list view
├── pages/
│   └── details.html        # Spot details + timer
├── css/
│   └── styles.css
├── js/
│   ├── config.js           # 👈 paste your API key here
│   ├── data.js             # localStorage data layer
│   ├── app.js              # Home screen
│   └── details.js          # Details + timer
├── README.md
└── .gitignore
```

## 🔄 Going Beyond MVP

Data lives in each visitor's `localStorage`, so spots are not yet shared across users. To make it a true community app, swap the `DataStore` methods in `js/data.js` for calls to a backend:

- **Firebase Firestore** — quick, free tier, real-time sync
- **Supabase** — Postgres + realtime + auth

The rest of the app stays the same.

## ⚠️ A note on API key exposure

The API key is visible in the client-side code (`config.js`). This is normal and expected for Google Maps JavaScript API. **The HTTP-referrer restriction you set up in step 5 above is what keeps it safe** — even if someone copies the key, they can't use it from any other domain. If you skip that step, you risk someone running up a bill on your account.

## 📄 License

MIT
