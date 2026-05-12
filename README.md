# ParkShare — Community-Driven Parking 🅿️

A lightweight, community-driven web app for finding and sharing free parking spots in real time. Built with vanilla HTML, CSS, JavaScript, and Leaflet maps. No backend required — runs entirely in the browser using `localStorage`.

## ✨ Features

- 🗺️ **Real-time map view** of community-reported parking spots
- 📋 **Distance-sorted list** of nearby free spots
- 📍 **Geolocation** support to find your current position
- 🅿️ **Spot details** with free count, time limit, and community notes
- ⏱️ **Smart parking timer** that auto-starts when you confirm parking
- ✏️ **Community contributions** — report new spots, correct info, or delete obsolete entries
- 📱 **Responsive** design (works on mobile and desktop)

## 🚀 Quick Start

### Run locally
1. Clone this repo or download the ZIP.
2. Open `index.html` in your browser. That's it.

### Run with Visual Studio (or VS Code)
1. Open the folder in Visual Studio / VS Code.
2. Install the **Live Server** extension (in VS Code) or use Visual Studio's built-in static web server.
3. Right-click `index.html` → "Open with Live Server".

## 🌐 Hosting on GitHub Pages

1. Push this repo to GitHub.
2. In your repo, go to **Settings → Pages**.
3. Under **Source**, choose **Deploy from a branch** → `main` → `/ (root)`.
4. Save. Your app is live at `https://<username>.github.io/<repo-name>/`.

## 📁 Project Structure

```
parkshare/
├── index.html              # Home: map + list view
├── pages/
│   └── details.html        # Spot details + timer
├── css/
│   └── styles.css          # All styles
├── js/
│   ├── data.js             # localStorage data layer
│   ├── app.js              # Home screen logic
│   └── details.js          # Details + timer logic
├── README.md
└── .gitignore
```

## 🛠️ Tech Stack

- **HTML5 / CSS3 / Vanilla JavaScript** — no frameworks
- **[Leaflet](https://leafletjs.com/)** — open-source interactive maps
- **OpenStreetMap** — free map tiles
- **localStorage** — client-side data persistence

## 🔄 Going Beyond MVP

Currently each user sees their own localStorage data. To make spots truly shared across users, plug in a backend:

- **Firebase Firestore** — quick, free tier, real-time sync
- **Supabase** — Postgres + realtime + auth
- **Custom Node.js/Express + MongoDB** — full control

Replace the `DataStore` object in `js/data.js` with API calls; the rest of the app stays the same.

## 📄 License

MIT — free to use, modify, and share.
