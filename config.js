/* ===========================
   ParkShare — Configuration
   =========================== */

// 👇 PASTE YOUR GOOGLE MAPS API KEY BETWEEN THE QUOTES BELOW 👇
const GOOGLE_MAPS_API_KEY = 'AIzaSyDEKvgvn2HAa8OFguSBPIY3zEn8LFQcuqo';

// Default map center (used if user denies geolocation). Helsinki by default.
const DEFAULT_CENTER = { lat: 60.1699, lng: 24.9384 };
const DEFAULT_ZOOM = 14;

// Community busyness thresholds — based on number of free spots reported
// 🟢 GREEN  = >= GREEN_THRESHOLD free spots (not busy)
// 🟡 YELLOW = between RED_THRESHOLD and GREEN_THRESHOLD
// 🔴 RED    = <= RED_THRESHOLD free spots (busy)
const BUSYNESS = {
  GREEN_THRESHOLD: 4,   // 4 or more free spots = not busy
  RED_THRESHOLD: 1,     // 1 or 0 free spots = busy
  STALE_HOURS: 6        // data older than this is treated as unknown (gray)
};
