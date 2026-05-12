/* ===========================
   ParkShare — Home Screen Logic
   =========================== */

let map;
let userLocation = { lat: 60.1699, lng: 24.9384 }; // Default: Helsinki
let userMarker = null;
let spotMarkers = [];
let pendingSpotCoords = null;
let pendingMarker = null;

// Initialize map
function initMap() {
  map = L.map('map').setView([userLocation.lat, userLocation.lng], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19
  }).addTo(map);

  // Listen for map clicks (used when reporting a spot)
  map.on('click', (e) => {
    if (!document.getElementById('reportModal').classList.contains('hidden')) {
      pendingSpotCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
      updateCoordsDisplay();
      placePendingMarker();
    }
  });
}

function placePendingMarker() {
  if (pendingMarker) map.removeLayer(pendingMarker);
  if (!pendingSpotCoords) return;
  pendingMarker = L.marker([pendingSpotCoords.lat, pendingSpotCoords.lng], {
    opacity: 0.7
  }).addTo(map);
}

function updateCoordsDisplay() {
  const el = document.getElementById('coordsDisplay');
  if (pendingSpotCoords) {
    el.textContent = `📍 ${pendingSpotCoords.lat.toFixed(5)}, ${pendingSpotCoords.lng.toFixed(5)}`;
  } else {
    el.textContent = 'No location selected';
  }
}

// Get user location
function locateUser() {
  if (!navigator.geolocation) {
    alert('Geolocation not supported by your browser.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      map.setView([userLocation.lat, userLocation.lng], 15);
      updateUserMarker();
      renderSpotList();
    },
    (err) => {
      console.warn('Geolocation error:', err.message);
      alert('Could not get your location. Using default location.');
    }
  );
}

function updateUserMarker() {
  if (userMarker) map.removeLayer(userMarker);
  const icon = L.divIcon({
    className: '',
    html: '<div style="width:18px;height:18px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 2px #3b82f6;"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
  userMarker = L.marker([userLocation.lat, userLocation.lng], { icon }).addTo(map);
}

// Render markers on the map
function renderMarkers() {
  // Clear existing
  spotMarkers.forEach(m => map.removeLayer(m));
  spotMarkers = [];

  const spots = DataStore.getAll();
  spots.forEach(spot => {
    const icon = L.divIcon({
      className: '',
      html: `<div class="parking-marker">P</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    const marker = L.marker([spot.lat, spot.lng], { icon })
      .addTo(map)
      .bindPopup(`
        <strong>${escapeHtml(spot.name)}</strong><br>
        ${spot.freeSpots} free spot(s)<br>
        <a href="pages/details.html?id=${spot.id}">View details →</a>
      `);
    spotMarkers.push(marker);
  });
}

// Render list view
function renderSpotList() {
  const listEl = document.getElementById('spotList');
  const countEl = document.getElementById('spotCount');
  const spots = DataStore.getAll();

  if (spots.length === 0) {
    listEl.innerHTML = '<p class="empty-state">No spots yet. Be the first to report one!</p>';
    countEl.textContent = '0';
    return;
  }

  // Sort by distance
  const withDistance = spots.map(s => ({
    ...s,
    distance: haversineDistance(userLocation.lat, userLocation.lng, s.lat, s.lng)
  })).sort((a, b) => a.distance - b.distance);

  countEl.textContent = withDistance.length;

  listEl.innerHTML = withDistance.map(spot => `
    <a class="spot-card" href="pages/details.html?id=${spot.id}">
      <div class="spot-card-top">
        <h3>${escapeHtml(spot.name)}</h3>
        <span class="distance">${formatDistance(spot.distance)}</span>
      </div>
      <div class="meta">
        <span>${spot.freeSpots} free</span>
        <span>${spot.duration}min limit</span>
        <span>${formatTimeAgo(spot.updated)}</span>
      </div>
    </a>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ===========================
// Modal handling
// ===========================
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  if (id === 'reportModal') {
    pendingSpotCoords = null;
    if (pendingMarker) { map.removeLayer(pendingMarker); pendingMarker = null; }
    updateCoordsDisplay();
    document.getElementById('reportForm').reset();
  }
}

document.querySelectorAll('.close-btn').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});

// ===========================
// Event Listeners
// ===========================
document.getElementById('locateBtn').addEventListener('click', locateUser);

document.getElementById('reportBtn').addEventListener('click', () => {
  openModal('reportModal');
});

document.getElementById('useMyLocationBtn').addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Geolocation not supported.');
  navigator.geolocation.getCurrentPosition((pos) => {
    pendingSpotCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    updateCoordsDisplay();
    placePendingMarker();
    map.setView([pendingSpotCoords.lat, pendingSpotCoords.lng], 16);
  });
});

document.getElementById('reportForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!pendingSpotCoords) {
    alert('Please pick a location on the map or use your current location.');
    return;
  }
  const newSpot = {
    name: document.getElementById('spotName').value.trim(),
    lat: pendingSpotCoords.lat,
    lng: pendingSpotCoords.lng,
    freeSpots: parseInt(document.getElementById('freeSpots').value, 10),
    duration: parseInt(document.getElementById('duration').value, 10),
    notes: document.getElementById('notes').value.trim()
  };
  DataStore.add(newSpot);
  closeModal('reportModal');
  renderMarkers();
  renderSpotList();
});

// ===========================
// Boot
// ===========================
window.addEventListener('DOMContentLoaded', () => {
  initMap();
  renderMarkers();
  renderSpotList();
  // Try to locate user on load
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        map.setView([userLocation.lat, userLocation.lng], 14);
        updateUserMarker();
        renderSpotList();
      },
      () => { /* silently keep default */ }
    );
  }
});
