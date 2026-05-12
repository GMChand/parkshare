/* ===========================
   ParkShare — Data Layer
   Manages user-submitted spots in localStorage,
   and provides shared utilities used everywhere.
   =========================== */

const STORAGE_KEY = 'parkshare_spots_v1';
const TIMER_KEY = 'parkshare_active_timer';

// Sample seed spots (only used on first visit)
const SAMPLE_SPOTS = [
  {
    id: 'sample-1',
    name: 'Helsinki Central Square',
    lat: 60.1699, lng: 24.9384,
    freeSpots: 3, duration: 120,
    notes: 'Free parking after 6 PM and on Sundays. 2-hour limit during weekdays.',
    updated: Date.now() - 1000 * 60 * 30,
    source: 'user'
  },
  {
    id: 'sample-2',
    name: 'Kamppi Shopping Area',
    lat: 60.1689, lng: 24.9314,
    freeSpots: 1, duration: 60,
    notes: '1-hour free parking with disc. Disabled spaces available.',
    updated: Date.now() - 1000 * 60 * 90,
    source: 'user'
  },
  {
    id: 'sample-3',
    name: 'Esplanadi Park Side',
    lat: 60.1675, lng: 24.9456,
    freeSpots: 5, duration: 90,
    notes: 'Street parking. Pay-and-display Mon-Fri 9-19.',
    updated: Date.now() - 1000 * 60 * 15,
    source: 'user'
  }
];

const DataStore = {
  getAll() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      this.saveAll(SAMPLE_SPOTS);
      return [...SAMPLE_SPOTS];
    }
    try { return JSON.parse(raw); }
    catch (e) { console.error('Failed to parse spots:', e); return []; }
  },
  saveAll(spots) { localStorage.setItem(STORAGE_KEY, JSON.stringify(spots)); },
  getById(id) { return this.getAll().find(s => s.id === id); },
  add(spot) {
    const spots = this.getAll();
    const newSpot = {
      id: 'spot-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      updated: Date.now(),
      source: 'user',
      ...spot
    };
    spots.push(newSpot);
    this.saveAll(spots);
    return newSpot;
  },
  update(id, updates) {
    const spots = this.getAll();
    const idx = spots.findIndex(s => s.id === id);
    if (idx === -1) return null;
    spots[idx] = { ...spots[idx], ...updates, updated: Date.now() };
    this.saveAll(spots);
    return spots[idx];
  },
  remove(id) {
    this.saveAll(this.getAll().filter(s => s.id !== id));
  },
  saveTimer(t) { localStorage.setItem(TIMER_KEY, JSON.stringify(t)); },
  getTimer() {
    const raw = localStorage.getItem(TIMER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  clearTimer() { localStorage.removeItem(TIMER_KEY); }
};

// ===========================
// Geometry & formatting helpers
// ===========================
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function formatTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// ===========================
// Unified busyness logic
// One color system for both user spots and Google-returned parking.
// ===========================
function busynessForUserSpot(spot) {
  const hoursSince = (Date.now() - spot.updated) / (1000 * 60 * 60);
  if (hoursSince > BUSYNESS.STALE_HOURS) {
    return { level: 'gray', label: 'Stale', color: '#9ca3af' };
  }
  if (spot.freeSpots >= BUSYNESS.GREEN_THRESHOLD) {
    return { level: 'green', label: 'Low traffic', color: '#16a34a' };
  }
  if (spot.freeSpots <= BUSYNESS.RED_THRESHOLD) {
    return { level: 'red', label: 'Heavy traffic', color: '#dc2626' };
  }
  return { level: 'yellow', label: 'Moderate', color: '#eab308' };
}

// trafficRatio = durationInTraffic / duration (1.0 = free flow)
function busynessForGoogleSpot(trafficRatio) {
  if (trafficRatio == null) {
    return { level: 'gray', label: 'Unknown', color: '#9ca3af' };
  }
  if (trafficRatio <= TRAFFIC_BUSYNESS.GREEN_MAX_RATIO) {
    return { level: 'green', label: 'Low traffic', color: '#16a34a' };
  }
  if (trafficRatio <= TRAFFIC_BUSYNESS.YELLOW_MAX_RATIO) {
    return { level: 'yellow', label: 'Moderate', color: '#eab308' };
  }
  return { level: 'red', label: 'Heavy traffic', color: '#dc2626' };
}
