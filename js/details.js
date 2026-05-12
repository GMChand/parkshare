/* ===========================
   ParkShare — Spot Details Page
   =========================== */

let currentSpot = null;
let timerInterval = null;

// Read spot ID from URL
function getSpotId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
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

  document.getElementById('detailName').textContent = currentSpot.name;
  document.getElementById('detailFreeSpots').textContent = currentSpot.freeSpots;
  document.getElementById('detailDuration').textContent = currentSpot.duration + ' min';
  document.getElementById('detailNotes').textContent = currentSpot.notes || 'No notes provided.';
  document.getElementById('detailUpdated').textContent = formatTimeAgo(currentSpot.updated);

  // Distance (if user grants location)
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

  // Render mini-map
  const miniMap = L.map('detailMap').setView([currentSpot.lat, currentSpot.lng], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19
  }).addTo(miniMap);
  const icon = L.divIcon({
    className: '',
    html: `<div class="parking-marker">P</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
  L.marker([currentSpot.lat, currentSpot.lng], { icon }).addTo(miniMap);

  // Restore timer if it's for this spot
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

  // Warning when < 10 minutes remain
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

// Boot
window.addEventListener('DOMContentLoaded', loadSpot);
