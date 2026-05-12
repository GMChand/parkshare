/* ===========================
   ParkShare — Spot Details Page
   (Google Maps version)
   =========================== */

let currentSpot = null;
let timerInterval = null;
let detailMap = null;

function getSpotId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

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

// Called by Google Maps loader once API is ready
function initDetailMap() {
  loadSpot();
}

function loadSpot() {
  const id = getSpotId();
  currentSpot = DataStore.getById(id);

  if (!currentSpot) {
    document.querySelector('.detail-card').innerHTML = `
      <h2>Spot not found</h2>
      <p style="color:var(--ink-soft);margin-top:1rem;">This parking spot may have been removed.</p>
      <a href="../index.html" class="btn btn-primary" style="margin-top:1rem;display:inline-block;text-decoration:none;">← Back to map</a>
    `;
    return;
  }

  const busy = getBusyness(currentSpot);

  document.getElementById('detailName').textContent = currentSpot.name;
  document.getElementById('detailFreeSpots').textContent = currentSpot.freeSpots;
  document.getElementById('detailDuration').textContent = currentSpot.duration + ' min';
  document.getElementById('detailNotes').textContent = currentSpot.notes || 'No notes provided.';
  document.getElementById('detailUpdated').textContent = formatTimeAgo(currentSpot.updated);

  const pill = document.getElementById('busynessPill');
  pill.textContent = busy.label;
  pill.className = 'busyness-pill busy-' + busy.level;

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, currentSpot.lat, currentSpot.lng);
      document.getElementById('detailDistance').textContent = formatDistance(dist);
    }, () => {
      document.getElementById('detailDistance').textContent = 'Unknown';
    });
  } else {
    document.getElementById('detailDistance').textContent = 'Unknown';
  }

  // Render Google mini-map with traffic layer on by default
  detailMap = new google.maps.Map(document.getElementById('detailMap'), {
    center: { lat: currentSpot.lat, lng: currentSpot.lng },
    zoom: 16,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false
  });

  new google.maps.Marker({
    position: { lat: currentSpot.lat, lng: currentSpot.lng },
    map: detailMap,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 12,
      fillColor: busy.color,
      fillOpacity: 0.95,
      strokeColor: '#ffffff',
      strokeWeight: 3
    },
    label: { text: 'P', color: '#fff', fontWeight: '700', fontSize: '12px' }
  });

  // Show Google's road-traffic layer here — relevant context for "is the area busy?"
  const trafficLayer = new google.maps.TrafficLayer();
  trafficLayer.setMap(detailMap);

  // Restore timer if it belongs to this spot
  const activeTimer = DataStore.getTimer();
  if (activeTimer && activeTimer.spotId === currentSpot.id) {
    startTimer(activeTimer.endsAt);
  }
}

// ===========================
// Timer Logic
// ===========================
function startTimer(endsAt) {
  document.getElementById('timerSection').classList.remove('hidden');
  DataStore.saveTimer({ spotId: currentSpot.id, endsAt });

  if (timerInterval) clearInterval(timerInterval);
  updateTimerDisplay(endsAt);
  timerInterval = setInterval(() => updateTimerDisplay(endsAt), 1000);
}

function updateTimerDisplay(endsAt) {
  const remaining = endsAt - Date.now();
  const display = document.getElementById('timerDisplay');
  const label = document.getElementById('timerLabel');

  if (remaining <= 0) {
    display.textContent = '00:00:00';
    display.classList.remove('warning');
    display.classList.add('expired');
    label.textContent = '⚠️ Time expired!';
    return;
  }

  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  display.textContent = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  if (remaining < 10 * 60 * 1000) {
    display.classList.add('warning');
    label.textContent = '⏰ Less than 10 minutes left';
  } else {
    display.classList.remove('warning');
    label.textContent = 'Time remaining';
  }
}

function pad(n) { return n.toString().padStart(2, '0'); }

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  DataStore.clearTimer();
  document.getElementById('timerSection').classList.add('hidden');
  document.getElementById('timerDisplay').classList.remove('warning', 'expired');
}

// ===========================
// Event Listeners
// ===========================
document.getElementById('confirmParkedBtn').addEventListener('click', () => {
  if (!currentSpot) return;
  const endsAt = Date.now() + currentSpot.duration * 60 * 1000;
  startTimer(endsAt);
});

document.getElementById('stopTimerBtn').addEventListener('click', () => {
  if (confirm('Stop and clear this parking timer?')) stopTimer();
});

document.getElementById('adjustTimerBtn').addEventListener('click', () => {
  document.getElementById('newDuration').value = currentSpot.duration;
  document.getElementById('adjustModal').classList.remove('hidden');
});

document.getElementById('saveAdjustBtn').addEventListener('click', () => {
  const newDur = parseInt(document.getElementById('newDuration').value, 10);
  if (isNaN(newDur) || newDur < 1) return alert('Enter a valid number of minutes.');
  const endsAt = Date.now() + newDur * 60 * 1000;
  startTimer(endsAt);
  document.getElementById('adjustModal').classList.add('hidden');
});

document.getElementById('correctInfoBtn').addEventListener('click', () => {
  document.getElementById('correctFreeSpots').value = currentSpot.freeSpots;
  document.getElementById('correctDuration').value = currentSpot.duration;
  document.getElementById('correctNotes').value = currentSpot.notes || '';
  document.getElementById('correctModal').classList.remove('hidden');
});

document.getElementById('correctForm').addEventListener('submit', (e) => {
  e.preventDefault();
  DataStore.update(currentSpot.id, {
    freeSpots: parseInt(document.getElementById('correctFreeSpots').value, 10),
    duration: parseInt(document.getElementById('correctDuration').value, 10),
    notes: document.getElementById('correctNotes').value.trim()
  });
  document.getElementById('correctModal').classList.add('hidden');
  loadSpot();
});

document.getElementById('deleteSpotBtn').addEventListener('click', () => {
  if (!confirm('Delete this parking spot? This cannot be undone.')) return;
  DataStore.remove(currentSpot.id);
  window.location.href = '../index.html';
});

document.querySelectorAll('.close-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById(btn.dataset.close).classList.add('hidden');
  });
});

// Required for Google Maps callback to find it
window.initDetailMap = initDetailMap;
