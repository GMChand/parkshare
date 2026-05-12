/* ===========================================================
   ParkShare — Home Screen Logic
   Features:
   1. Mobile-friendly gestures (pan, pinch, double-tap-to-drop)
   2. Combined Google + user parking spots with unified red/yellow/green
   3. Distance filtering + remote address search
   4. Reverse-geocoded address autofill + draggable pin fine-tuning
   =========================================================== */

let map;
let trafficLayer;
let trafficOn = false;

// Search center: where the radius filter is applied from.
// May differ from userLocation when the user searches a remote location.
let userLocation = { ...DEFAULT_CENTER };
let searchCenter = { ...DEFAULT_CENTER };
let searchCenterLabel = 'Default location';
let radiusKm = DEFAULT_RADIUS_KM;

let userMarker = null;
let searchCenterMarker = null;
let radiusCircle = null;

let userSpotMarkers = [];      // markers for user-submitted spots
let googleSpotMarkers = [];    // markers for Google parking results
let googleSpots = [];          // cached Google parking results

// Pending pin (drop-then-confirm flow)
let pendingPin = null;         // google.maps.Marker
let pendingCoords = null;      // { lat, lng }
let pendingAddress = '';

// Mini-map inside report modal
let reportMiniMap = null;
let reportMiniPin = null;

let geocoder = null;
let placesService = null;
let autocomplete = null;
let lastFetchTimestamp = 0;

// =============================================================
// SECTION 1: Map initialization (called by Google API loader)
// =============================================================
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: userLocation,
    zoom: DEFAULT_ZOOM,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    // Gesture handling — these are the official Google Maps switches
    // for one-finger pan + two-finger pinch:
    gestureHandling: 'greedy',     // one-finger drag works on touch devices
    disableDoubleClickZoom: true,  // we use double-tap for pin-drop instead
    clickableIcons: false,
    styles: [
      { featureType: 'poi.business', stylers: [{ visibility: 'off' }] }
    ]
  });

  trafficLayer = new google.maps.TrafficLayer();
  geocoder = new google.maps.Geocoder();
  placesService = new google.maps.places.PlacesService(map);

  // ----- Gesture: double-click / double-tap drops a pin -----
  // The 'dblclick' event fires on both desktop double-click and mobile double-tap,
  // because Google Maps normalizes touch into mouse events for this listener.
  map.addListener('dblclick', (e) => {
    dropPin(e.latLng.lat(), e.latLng.lng());
  });

  // Set up search bar + radius dropdown
  initSearchBar();
  initAutocomplete();

  // Try to locate the user; fall back silently to default
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        searchCenter = { ...userLocation };
        searchCenterLabel = 'My location';
        map.setCenter(userLocation);
        updateUserMarker();
        updateSearchCenterIndicator();
        refreshAllSpots();
      },
      () => {
        // No location: use defaults
        updateSearchCenterIndicator();
        refreshAllSpots();
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  } else {
    updateSearchCenterIndicator();
    refreshAllSpots();
  }

  // Hide gesture hint after a few seconds (or on first interaction)
  setTimeout(() => document.getElementById('gestureHint').classList.add('fade-out'), 6000);
  map.addListener('dragstart', () => document.getElementById('gestureHint').classList.add('fade-out'));
}

// =============================================================
// SECTION 2: Markers for user location + search center + radius
// =============================================================
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
    title: 'You are here',
    zIndex: 1000
  });
}

function updateSearchCenterIndicator() {
  if (searchCenterMarker) searchCenterMarker.setMap(null);
  if (radiusCircle) radiusCircle.setMap(null);

  // Only draw a separate search marker if it differs from user location
  const sameAsUser = userLocation &&
    Math.abs(searchCenter.lat - userLocation.lat) < 1e-5 &&
    Math.abs(searchCenter.lng - userLocation.lng) < 1e-5;

  if (!sameAsUser) {
    searchCenterMarker = new google.maps.Marker({
      position: searchCenter,
      map: map,
      icon: {
        path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
        scale: 5,
        fillColor: '#2d6a4f',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2
      },
      title: 'Search center: ' + searchCenterLabel,
      zIndex: 999
    });
  }

  // Always draw a faint circle showing the search radius
  radiusCircle = new google.maps.Circle({
    map: map,
    center: searchCenter,
    radius: radiusKm * 1000,
    strokeColor: '#2d6a4f',
    strokeOpacity: 0.4,
    strokeWeight: 1.5,
    fillColor: '#2d6a4f',
    fillOpacity: 0.04,
    clickable: false,
    zIndex: 1
  });
}

// =============================================================
// SECTION 3: Search bar + radius dropdown
// =============================================================
function initSearchBar() {
  // Populate radius dropdown
  const sel = document.getElementById('radiusSelect');
  RADIUS_OPTIONS_KM.forEach(km => {
    const opt = document.createElement('option');
    opt.value = km;
    opt.textContent = km + ' km';
    if (km === DEFAULT_RADIUS_KM) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', (e) => {
    radiusKm = parseFloat(e.target.value);
    updateSearchCenterIndicator();
    refreshAllSpots();
  });

  document.getElementById('useLocationBtn').addEventListener('click', searchFromMyLocation);
  document.getElementById('clearSearchBtn').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    searchFromMyLocation();
  });
}

// Hook up Places Autocomplete on the search input.
// Note: the classic Autocomplete widget still works and is simpler than the
// new PlaceAutocompleteElement for our flat-HTML setup.
function initAutocomplete() {
  const input = document.getElementById('searchInput');
  autocomplete = new google.maps.places.Autocomplete(input, {
    fields: ['geometry', 'formatted_address', 'name'],
    types: ['geocode', 'establishment']
  });

  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();
    if (!place.geometry || !place.geometry.location) {
      // User typed something then hit Enter without selecting — fall back to geocoding
      fallbackGeocode(input.value);
      return;
    }
    const loc = place.geometry.location;
    searchCenter = { lat: loc.lat(), lng: loc.lng() };
    searchCenterLabel = place.formatted_address || place.name || input.value;
    map.setCenter(searchCenter);
    map.setZoom(15);
    updateSearchCenterIndicator();
    refreshAllSpots();
  });
}

function fallbackGeocode(query) {
  if (!query.trim()) return;
  geocoder.geocode({ address: query }, (results, status) => {
    if (status === 'OK' && results[0]) {
      const loc = results[0].geometry.location;
      searchCenter = { lat: loc.lat(), lng: loc.lng() };
      searchCenterLabel = results[0].formatted_address;
      map.setCenter(searchCenter);
      map.setZoom(15);
      updateSearchCenterIndicator();
      refreshAllSpots();
    } else {
      showToast('Location not found: ' + query);
    }
  });
}

function searchFromMyLocation() {
  if (!navigator.geolocation) return showToast('Geolocation not supported');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      searchCenter = { ...userLocation };
      searchCenterLabel = 'My location';
      document.getElementById('searchInput').value = '';
      map.setCenter(userLocation);
      map.setZoom(15);
      updateUserMarker();
      updateSearchCenterIndicator();
      refreshAllSpots();
    },
    () => showToast('Could not get your location'),
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// =============================================================
// SECTION 4: Refresh all spots (user + Google) within radius
// =============================================================
async function refreshAllSpots() {
  renderUserMarkers();
  await fetchGoogleParking();
  renderSpotList();
}

function withinRadius(lat, lng) {
  return haversineDistance(searchCenter.lat, searchCenter.lng, lat, lng) <= radiusKm;
}

// ---- User-submitted markers ----
function renderUserMarkers() {
  userSpotMarkers.forEach(m => m.setMap(null));
  userSpotMarkers = [];

  const spots = DataStore.getAll().filter(s => withinRadius(s.lat, s.lng));
  spots.forEach(spot => {
    const busy = busynessForUserSpot(spot);
    const marker = new google.maps.Marker({
      position: { lat: spot.lat, lng: spot.lng },
      map: map,
      icon: makeParkingIcon(busy.color, 'user'),
      title: spot.name,
      zIndex: 10
    });

    const iw = new google.maps.InfoWindow({
      content: `
        <div class="iw-content">
          <div class="iw-row"><strong>${escapeHtml(spot.name)}</strong>
            <span class="iw-tag iw-tag-user">User</span></div>
          <div style="color:${busy.color};font-weight:600;margin:4px 0;">● ${busy.label}</div>
          <div>${spot.freeSpots} free · ${spot.duration} min limit</div>
          <a href="pages/details.html?id=${spot.id}">View details →</a>
        </div>`
    });
    marker.addListener('click', () => iw.open({ anchor: marker, map }));
    userSpotMarkers.push(marker);
  });
}

// ---- Google parking results ----
// Uses Places Nearby Search to find parking type within radius,
// then Distance Matrix to estimate traffic-based busyness.
async function fetchGoogleParking() {
  googleSpotMarkers.forEach(m => m.setMap(null));
  googleSpotMarkers = [];
  googleSpots = [];

  // Cap the Places radius at 50km (API max) and our selected radius
  const radiusMeters = Math.min(radiusKm * 1000, 50000);
  const myFetchId = ++lastFetchTimestamp;

  return new Promise((resolve) => {
    placesService.nearbySearch(
      {
        location: searchCenter,
        radius: radiusMeters,
        type: 'parking'  // Google's place type for parking lots / structures
      },
      async (results, status) => {
        // If a newer fetch already started, abort to avoid stale render
        if (myFetchId !== lastFetchTimestamp) return resolve();

        if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
          // Silent: no parking found or quota issue — user spots still render
          return resolve();
        }

        // Filter to within selected radius (Places returns up to 20 results,
        // but they can extend beyond when our radius is small)
        const inRange = results.filter(p => {
          const loc = p.geometry && p.geometry.location;
          if (!loc) return false;
          return withinRadius(loc.lat(), loc.lng());
        });

        // Get traffic ratios via Distance Matrix (one call, up to 25 destinations)
        const trafficMap = await fetchTrafficRatios(searchCenter, inRange);

        inRange.forEach(place => {
          const loc = place.geometry.location;
          const ratio = trafficMap.get(place.place_id);
          const busy = busynessForGoogleSpot(ratio);

          const spotObj = {
            id: 'google-' + place.place_id,
            name: place.name,
            lat: loc.lat(),
            lng: loc.lng(),
            address: place.vicinity || '',
            rating: place.rating,
            busy: busy,
            source: 'google',
            trafficRatio: ratio
          };
          googleSpots.push(spotObj);

          const marker = new google.maps.Marker({
            position: { lat: spotObj.lat, lng: spotObj.lng },
            map: map,
            icon: makeParkingIcon(busy.color, 'google'),
            title: spotObj.name,
            zIndex: 5
          });
          const iw = new google.maps.InfoWindow({
            content: `
              <div class="iw-content">
                <div class="iw-row"><strong>${escapeHtml(spotObj.name)}</strong>
                  <span class="iw-tag iw-tag-google">Google</span></div>
                <div style="color:${busy.color};font-weight:600;margin:4px 0;">● ${busy.label}</div>
                <div>${escapeHtml(spotObj.address)}</div>
                ${spotObj.rating ? `<div>⭐ ${spotObj.rating}</div>` : ''}
                <div style="font-size:0.8em;color:#666;margin-top:4px;">
                  Color = road traffic around this lot, not lot occupancy.
                </div>
              </div>`
          });
          marker.addListener('click', () => iw.open({ anchor: marker, map }));
          googleSpotMarkers.push(marker);
        });

        resolve();
      }
    );
  });
}

// Distance Matrix: returns a Map of place_id -> ratio (durationInTraffic / duration)
function fetchTrafficRatios(origin, places) {
  return new Promise((resolve) => {
    if (places.length === 0) return resolve(new Map());

    // API limit: 25 destinations per request
    const destinations = places.slice(0, 25).map(p => ({
      lat: p.geometry.location.lat(),
      lng: p.geometry.location.lng()
    }));
    const placeIds = places.slice(0, 25).map(p => p.place_id);

    const service = new google.maps.DistanceMatrixService();
    service.getDistanceMatrix(
      {
        origins: [origin],
        destinations: destinations,
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: google.maps.TrafficModel.BEST_GUESS
        }
      },
      (response, status) => {
        const map = new Map();
        if (status !== 'OK' || !response) return resolve(map);
        const row = response.rows[0];
        row.elements.forEach((el, i) => {
          if (el.status === 'OK' && el.duration && el.duration_in_traffic) {
            map.set(placeIds[i], el.duration_in_traffic.value / el.duration.value);
          } else {
            map.set(placeIds[i], null);
          }
        });
        resolve(map);
      }
    );
  });
}

// =============================================================
// SECTION 5: Marker icon factory — same visual system for both
// =============================================================
function makeParkingIcon(color, source) {
  // source: 'user' or 'google' — same P marker, slight visual diff for source
  const strokeColor = source === 'google' ? '#1f2937' : '#ffffff';
  const strokeWeight = source === 'google' ? 2 : 3;
  return {
    path: 'M -14 0 a 14 14 0 1 0 28 0 a 14 14 0 1 0 -28 0',
    fillColor: color,
    fillOpacity: 0.95,
    strokeColor: strokeColor,
    strokeWeight: strokeWeight,
    scale: 1,
    labelOrigin: new google.maps.Point(0, 0)
  };
}

// =============================================================
// SECTION 6: Spot list (combined user + Google, sorted by distance)
// =============================================================
function renderSpotList() {
  const listEl = document.getElementById('spotList');
  const countEl = document.getElementById('spotCount');
  const titleEl = document.getElementById('listTitle');

  titleEl.textContent = `Spots within ${radiusKm} km`;

  const userSpots = DataStore.getAll()
    .filter(s => withinRadius(s.lat, s.lng))
    .map(s => ({
      id: s.id,
      name: s.name,
      lat: s.lat, lng: s.lng,
      busy: busynessForUserSpot(s),
      meta: `${s.freeSpots} free · ${s.duration}min · ${formatTimeAgo(s.updated)}`,
      source: 'user',
      href: 'pages/details.html?id=' + s.id
    }));

  const gSpots = googleSpots.map(s => ({
    id: s.id,
    name: s.name,
    lat: s.lat, lng: s.lng,
    busy: s.busy,
    meta: s.address + (s.rating ? ` · ⭐ ${s.rating}` : ''),
    source: 'google',
    href: null
  }));

  const all = [...userSpots, ...gSpots].map(s => ({
    ...s,
    distance: haversineDistance(searchCenter.lat, searchCenter.lng, s.lat, s.lng)
  })).sort((a, b) => a.distance - b.distance);

  countEl.textContent = all.length;

  if (all.length === 0) {
    listEl.innerHTML = `<p class="empty-state">No spots within ${radiusKm} km of ${escapeHtml(searchCenterLabel)}. Try a bigger radius or report one!</p>`;
    return;
  }

  listEl.innerHTML = all.map(spot => {
    const tag = spot.source === 'google'
      ? '<span class="badge-mini badge-google" title="Google parking">G</span>'
      : '<span class="badge-mini" title="User-submitted">P</span>';
    const inner = `
      <div class="spot-card-top">
        <div class="spot-card-title">
          ${tag}
          <h3>${escapeHtml(spot.name)}</h3>
          <span class="busyness-pill busy-${spot.busy.level}">${spot.busy.label}</span>
        </div>
        <span class="distance">${formatDistance(spot.distance)}</span>
      </div>
      <div class="meta">${escapeHtml(spot.meta)}</div>
    `;
    if (spot.href) {
      return `<a class="spot-card busy-${spot.busy.level}" href="${spot.href}">${inner}</a>`;
    }
    return `<div class="spot-card busy-${spot.busy.level}" data-lat="${spot.lat}" data-lng="${spot.lng}">${inner}</div>`;
  }).join('');

  // Clicking a Google spot in the list pans the map there (no detail page for them)
  listEl.querySelectorAll('.spot-card[data-lat]').forEach(el => {
    el.addEventListener('click', () => {
      const lat = parseFloat(el.dataset.lat);
      const lng = parseFloat(el.dataset.lng);
      map.panTo({ lat, lng });
      map.setZoom(17);
    });
  });
}

// =============================================================
// SECTION 7: Pin drop flow (double-tap → adjust → report)
// =============================================================
function dropPin(lat, lng) {
  if (pendingPin) pendingPin.setMap(null);
  pendingCoords = { lat, lng };

  pendingPin = new google.maps.Marker({
    position: pendingCoords,
    map: map,
    draggable: true,
    animation: google.maps.Animation.DROP,
    icon: {
      path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
      scale: 7,
      fillColor: '#2d6a4f',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 3
    },
    zIndex: 2000
  });

  // Dragging updates coords + re-fetches address
  pendingPin.addListener('dragend', (e) => {
    pendingCoords = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    reverseGeocode(pendingCoords).then(addr => {
      pendingAddress = addr;
      document.getElementById('pinAddress').textContent = addr;
    });
  });

  // Haptic feedback on supported devices
  if (navigator.vibrate) navigator.vibrate(40);

  // Toast + open pin panel
  showToast('📍 Pin dropped — drag to adjust');
  document.getElementById('pinPanel').classList.remove('hidden');
  document.getElementById('pinAddress').textContent = 'Fetching address…';

  // Reverse-geocode to fill in address
  reverseGeocode(pendingCoords).then(addr => {
    pendingAddress = addr;
    document.getElementById('pinAddress').textContent = addr;
  });
}

function reverseGeocode({ lat, lng }) {
  return new Promise((resolve) => {
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results[0]) {
        resolve(results[0].formatted_address);
      } else {
        resolve(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    });
  });
}

function cancelPin() {
  if (pendingPin) { pendingPin.setMap(null); pendingPin = null; }
  pendingCoords = null;
  pendingAddress = '';
  document.getElementById('pinPanel').classList.add('hidden');
}

function openReportModal() {
  if (!pendingCoords) return;
  document.getElementById('spotName').value = pendingAddress || '';
  document.getElementById('coordsDisplay').textContent =
    `📍 ${pendingCoords.lat.toFixed(5)}, ${pendingCoords.lng.toFixed(5)}`;
  document.getElementById('pinPanel').classList.add('hidden');
  document.getElementById('reportModal').classList.remove('hidden');
  // Build the mini-map inside the report modal AFTER it's visible
  setTimeout(initReportMiniMap, 50);
}

// =============================================================
// SECTION 8: Report-modal mini-map (drag pin to fine-tune)
// =============================================================
function initReportMiniMap() {
  const el = document.getElementById('reportMiniMap');
  if (!el) return;

  if (!reportMiniMap) {
    reportMiniMap = new google.maps.Map(el, {
      center: pendingCoords,
      zoom: 17,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
      clickableIcons: false
    });
  } else {
    reportMiniMap.setCenter(pendingCoords);
    reportMiniMap.setZoom(17);
    google.maps.event.trigger(reportMiniMap, 'resize');
  }

  if (reportMiniPin) reportMiniPin.setMap(null);
  reportMiniPin = new google.maps.Marker({
    position: pendingCoords,
    map: reportMiniMap,
    draggable: true,
    icon: {
      path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
      scale: 7,
      fillColor: '#2d6a4f',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 3
    }
  });

  // Drag the mini-map pin → update coords + refresh address
  reportMiniPin.addListener('dragend', async (e) => {
    pendingCoords = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    document.getElementById('coordsDisplay').textContent =
      `📍 ${pendingCoords.lat.toFixed(5)}, ${pendingCoords.lng.toFixed(5)}`;
    const addr = await reverseGeocode(pendingCoords);
    pendingAddress = addr;
    document.getElementById('spotName').value = addr;
    // Also move the big-map pin so the two stay in sync
    if (pendingPin) pendingPin.setPosition(pendingCoords);
  });
}

// =============================================================
// SECTION 9: UI helpers
// =============================================================
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2500);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  if (id === 'reportModal') {
    document.getElementById('reportForm').reset();
    cancelPin();
  }
}

// =============================================================
// SECTION 10: Event wiring
// =============================================================
document.getElementById('locateBtn').addEventListener('click', searchFromMyLocation);

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

// Search input: Enter triggers geocode fallback if user didn't pick suggestion
document.getElementById('searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    // Give the autocomplete a chance to fire first
    setTimeout(() => {
      if (e.target.value.trim()) fallbackGeocode(e.target.value);
    }, 50);
  }
});

// Pin panel buttons
document.getElementById('pinCancelBtn').addEventListener('click', cancelPin);
document.getElementById('pinContinueBtn').addEventListener('click', openReportModal);

// Refetch address button inside report modal
document.getElementById('refetchAddressBtn').addEventListener('click', async () => {
  if (!pendingCoords) return;
  document.getElementById('spotName').value = 'Fetching…';
  const addr = await reverseGeocode(pendingCoords);
  pendingAddress = addr;
  document.getElementById('spotName').value = addr;
});

// Save spot
document.getElementById('reportForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!pendingCoords) {
    showToast('No location selected. Double-tap the map to drop a pin.');
    return;
  }
  DataStore.add({
    name: document.getElementById('spotName').value.trim(),
    lat: pendingCoords.lat,
    lng: pendingCoords.lng,
    freeSpots: parseInt(document.getElementById('freeSpots').value, 10),
    duration: parseInt(document.getElementById('duration').value, 10),
    notes: document.getElementById('notes').value.trim()
  });
  closeModal('reportModal');
  showToast('✓ Spot saved');
  refreshAllSpots();
});

document.querySelectorAll('.close-btn').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});

// Expose initMap for the Google Maps loader callback
window.initMap = initMap;
