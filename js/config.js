/* ===========================
   ParkShare — Configuration
   =========================== */

// 👇 PASTE YOUR GOOGLE MAPS API KEY BETWEEN THE QUOTES BELOW 👇
// IMPORTANT: This key must have THREE APIs enabled in Google Cloud Console:
//   1. Maps JavaScript API
//   2. Places API (New)
//   3. Geocoding API
const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY_HERE';

// Default map center (used if user denies geolocation). Helsinki by default.
const DEFAULT_CENTER = { lat: 60.1699, lng: 24.9384 };
const DEFAULT_ZOOM = 14;

// Search radius options (km) shown in the dropdown
const RADIUS_OPTIONS_KM = [1, 3, 5, 10, 25];
const DEFAULT_RADIUS_KM = 3;

// Community busyness thresholds (for user-submitted spots)
//   GREEN  = >= GREEN_THRESHOLD free spots  -> not busy / easy access
//   YELLOW = between RED_THRESHOLD and GREEN_THRESHOLD
//   RED    = <= RED_THRESHOLD free spots    -> busy / hard access
const BUSYNESS = {
  GREEN_THRESHOLD: 4,
  RED_THRESHOLD: 1,
  STALE_HOURS: 6
};

// For Google-returned parking locations we don't know real occupancy,
// so we infer congestion from road traffic delay at the location.
// Distance Matrix duration-in-traffic / duration:
//   <= 1.15  -> green (low traffic)
//   1.15-1.40 -> yellow (moderate)
//   > 1.40   -> red (heavy)
const TRAFFIC_BUSYNESS = {
  GREEN_MAX_RATIO: 1.15,
  YELLOW_MAX_RATIO: 1.40
};
