/* ===========================
   ParkShare — Home Screen Logic
   (Google Maps + Traffic Layer + Community Busyness)
   =========================== */

let map;
let trafficLayer;
let trafficOn = false;
let userLocation = { ...DEFAULT_CENTER };
let userMarker = null;
let spotMarkers = [];
let pendingSpotCoords = null;
let pendingMarker = null;

// ===========================
// Busyness logic — purely community-driven
// ===========================
function getBusyness(spot) {
  const hoursSinceUpdate = (Date.now() - spot.updated) / (1000 * 60 * 60);
  if (hoursSinceUpdate > BUSYNESS.STALE_HOURS) {
    return { level: 'gray', label: 'Stale', color: '#9ca3af' };
  }
  if (spot.freeSpots >= BUSYNESS.GREEN_THRESHOLD) {
    return { level: 'green', label: 'Not busy', color: '#16a34a' };
  }
  if (spot.freeSpots <= BUSYNESS.RED_THRESHOLD) {
    return { level: 'red', label: 'Busy', color: '#dc2626' };
  }
  return { level: 'yellow', label: 'Medium', color: '#eab308' };
}

// ===========================
// Google Maps initialization
// (this name MUST match callback in the API loader URL)
// ===========================
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: userLocation,
    zoom: DEFAULT_ZOOM,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    styles: [
      { featureType: 'poi.business', stylers: [{ visibility: 'off' }] }
    ]
  });

  // Traffic layer — provided by Google. Shows real-time road traffic
  // (green = flowing, orange = slow, red = heavy).
  trafficLayer = new google.maps.TrafficLayer();

  // Map click — used when reporting a new spot
  map.addListener('click', (e) => {
    if (!document.getElementById('reportModal').classList.contains('hidden')) {
      pendingSpotCoords = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      updateCoordsDisplay();
      placePendingMarker();
    }
  });

  renderMarkers();
  renderSpotList();

  // Geolocate on load (silent fallback to default)
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        map.setCenter(userLocation);
        updateUserMarker();
        renderSpotList();
      },
      () => { /* keep default */ }
    );
  }
}

function placePendingMarker() {
  if (pendingMarker) pendingMarker.setMap(null);
  if (!pendingSpotCoords) return;
  pendingMarker = new google.maps.Marker({
    position: pendingSpotCoords,
    map: map,
    opacity: 0.7,
    animation: google.maps.Animation.DROP
  });
}

function updateCoordsDisplay() {
  const el = document.getElementById('coordsDisplay');
  if (pendingSpotCoords) {
    el.textContent = `📍 ${pendingSpotCoords.lat.toFixed(5)}, ${pendingSpotCoords.lng.toFixed(5)}`;
  } else {
    el.textContent = 'No location selected';
  }
}

function updateUserMarker() {
  if (userMarker) userMarker.setMap(null);
  userMarker = new google.maps.Marker({
    position: userLocation,
    map: map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: '#3b82f6',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 3
    },
    title: 'You are here'
  });
}

function locateUser() {
  if (!navigator.geolocation) return alert('Geolocation not supported.');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      map.setCenter(userLocation);
      map.setZoom(15);
      updateUserMarker();
      renderSpotList();
    },
    () => alert('Could not get your location.')
  );
}

// ===========================
// Render parking-spot markers, colored by community busyness
// ===========================
function renderMarkers() {
  spotMarkers.forEach(m => m.setMap(null));
  spotMarkers = [];

  const spots = DataStore.getAll();
  spots.forEach(spot => {
    const busy = getBusyness(spot);
    const marker = new google.maps.Marker({
      position: { lat: spot.lat, lng: spot.lng },
      map: map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: busy.color,
        fillOpacity: 0.95,
        strokeColor: '#ffffff',
        strokeWeight: 3
      },
      title: spot.name,
      label: { text: 'P', color: '#fff', fontWeight: '700', fontSize: '12px' }
    });

    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div class="iw-content">
          <strong>${escapeHtml(spot.name)}</strong><br>
          <span style="color:${busy.color};font-weight:600;">● ${busy.label}</span> · ${spot.freeSpots} free<br>
          <a href="pages/details.html?id=${spot.id}">View details →</a>
        </div>`
    });
    marker.addListener('click', () => infoWindow.open({ anchor: marker, map }));

    spotMarkers.push(marker);
  });
}

// ===========================
// Render distance-sorted list
// ===========================
function renderSpotList() {
  const listEl = document.getElementById('spotList');
  const countEl = document.getElementById('spotCount');
  const spots = DataStore.getAll();

  if (spots.length === 0) {
    listEl.innerHTML = '<p class="empty-state">No spots yet. Be the first to report one!</p>';
    countEl.textContent = '0';
    return;
  }

  const withDistance = spots.map(s => ({
    ...s,
    distance: haversineDistance(userLocation.lat, userLocation.lng, s.lat, s.lng),
    busy: getBusyness(s)
  })).sort((a, b) => a.distance - b.distance);

  countEl.textContent = withDistance.length;

  listEl.innerHTML = withDistance.map(spot => `
    <a class="spot-card busy-${spot.busy.level}" href="pages/details.html?id=${spot.id}">
      <div class="spot-card-top">
        <div class="spot-card-title">
          <h3>${escapeHtml(spot.name)}</h3>
          <span class="busyness-pill busy-${spot.busy.level}">${spot.busy.label}</span>
        </div>
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
    if (pendingMarker) { pendingMarker.setMap(null); pendingMarker = null; }
    updateCoordsDisplay();
    document.getElementById('reportForm').reset();
  }
}

// ===========================
// Event Listeners
// ===========================
document.getElementById('locateBtn').addEventListener('click', locateUser);

document.getElementById('reportBtn').addEventListener('click', () => openModal('reportModal'));

// Traffic toggle — switches Google's real-time road traffic on/off
document.getElementById('trafficToggle').addEventListener('click', (e) => {
  trafficOn = !trafficOn;
  if (trafficOn) {
    trafficLayer.setMap(map);
    e.currentTarget.classList.add('active');
  } else {
    trafficLayer.setMap(null);
    e.currentTarget.classList.remove('active');
  }
});

document.getElementById('useMyLocationBtn').addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Geolocation not supported.');
  navigator.geolocation.getCurrentPosition((pos) => {
    pendingSpotCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    updateCoordsDisplay();
    placePendingMarker();
    map.setCenter(pendingSpotCoords);
    map.setZoom(16);
  });
});

document.getElementById('reportForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!pendingSpotCoords) {
    alert('Please pick a location on the map or use your current location.');
    return;
  }
  DataStore.add({
    name: document.getElementById('spotName').value.trim(),
    lat: pendingSpotCoords.lat,
    lng: pendingSpotCoords.lng,
    freeSpots: parseInt(document.getElementById('freeSpots').value, 10),
    duration: parseInt(document.getElementById('duration').value, 10),
    notes: document.getElementById('notes').value.trim()
  });
  closeModal('reportModal');
  renderMarkers();
  renderSpotList();
});

document.querySelectorAll('.close-btn').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});

// initMap is called by the Google Maps API loader (see index.html bottom)
window.initMap = initMap;
