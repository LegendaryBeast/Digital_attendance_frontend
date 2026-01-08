// API_URL is defined in auth.js as window.API_URL
let currentClass = null;
let studentLocation = null;
let cameraStream = null;
let capturedImageData = null;

// Check authentication
const { token, user } = getUserData();
if (!token || !user || user.role !== 'student') {
    window.location.href = '/index.html';
}

// Display student info
document.getElementById('student-name').textContent = user.name;
document.getElementById('student-info').textContent =
    `Registration: ${user.registrationNumber} | ${user.email}`;

// API call helper
async function apiCall(endpoint, options = {}) {
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        }
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }
    return data;
}

// Show alert
function showAlert(elementId, message, type) {
    const alertDiv = document.getElementById(elementId);
    alertDiv.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => {
        alertDiv.innerHTML = '';
    }, 5000);
}

// Get user's current location
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
            },
            (error) => {
                reject(new Error('Unable to get location: ' + error.message));
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}

// Load active classes
async function loadActiveClasses() {
    try {
        const data = await apiCall('/classes/active');
        const container = document.getElementById('classes-container');
        const loading = document.getElementById('classes-loading');

        loading.classList.add('hidden');
        container.classList.remove('hidden');

        if (data.classes.length === 0) {
            container.innerHTML = '<p class="text-secondary">No active classes at the moment</p>';
            return;
        }

        container.innerHTML = data.classes.map(cls => `
      <div class="class-card" onclick="openAttendanceModal('${cls._id}')" style="cursor: pointer;">
        <div class="flex-between mb-sm">
          <h3 style="margin: 0;">${cls.name}</h3>
          <span class="badge badge-${cls.type === 'online' ? 'primary' : 'warning'}">
            ${cls.type.toUpperCase()}
          </span>
        </div>
        <p class="text-secondary" style="margin: 0; font-size: 0.9rem;">Teacher: ${cls.teacherName}</p>
        <p class="text-muted" style="margin: 0; font-size: 0.85rem; margin-top: 0.25rem;">
          ${new Date(cls.date).toLocaleString('en-US', {
            timeZone: 'Asia/Dhaka',
            dateStyle: 'medium',
            timeStyle: 'short'
        })}
        </p>
      </div>
    `).join('');
    } catch (error) {
        console.error('Load classes error:', error);
        showAlert('alert-container', error.message, 'error');
    }
}

// Open attendance modal
async function openAttendanceModal(classId) {
    try {
        const data = await apiCall(`/classes/${classId}`);
        currentClass = data.class;

        document.getElementById('modal-class-name').textContent = currentClass.name;
        document.getElementById('modal-teacher-name').textContent = `Teacher: ${currentClass.teacherName}`;

        const typeBadge = document.getElementById('modal-class-type');
        typeBadge.textContent = currentClass.type.toUpperCase();
        typeBadge.className = `badge badge-${currentClass.type === 'online' ? 'primary' : 'warning'}`;

        // If offline class, get location and show camera
        if (currentClass.type === 'offline') {
            document.getElementById('location-status').classList.remove('hidden');
            document.getElementById('camera-section').classList.remove('hidden');

            document.getElementById('location-info').innerHTML = `
        <div class="flex gap-sm">
          <div class="spinner spinner-small"></div>
          <span>Getting your location...</span>
        </div>
      `;
            document.getElementById('location-info').className = 'alert alert-warning';

            try {
                studentLocation = await getCurrentLocation();
                document.getElementById('location-info').innerHTML =
                    `✓ Location acquired: ${studentLocation.latitude.toFixed(6)}, ${studentLocation.longitude.toFixed(6)}`;
                document.getElementById('location-info').className = 'alert alert-success';
            } catch (error) {
                document.getElementById('location-info').innerHTML =
                    `⚠ ${error.message}. You must enable location to mark attendance for offline classes.`;
                document.getElementById('location-info').className = 'alert alert-error';
                studentLocation = null;
            }
        } else {
            document.getElementById('location-status').classList.add('hidden');
            document.getElementById('camera-section').classList.add('hidden');
            studentLocation = null;
        }

        document.getElementById('validation-code-input').value = '';
        document.getElementById('modal-alert').innerHTML = '';
        document.getElementById('attendance-modal').classList.remove('hidden');
    } catch (error) {
        showAlert('alert-container', error.message, 'error');
    }
}

// Camera Functions
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });

        cameraStream = stream;
        const video = document.getElementById('camera-video');
        video.srcObject = stream;

        // Show/hide appropriate buttons
        document.getElementById('start-camera-btn').classList.add('hidden');
        document.getElementById('capture-photo-btn').classList.remove('hidden');
        document.getElementById('camera-error').classList.add('hidden');

        // Hide captured image if any
        document.getElementById('captured-image-preview').classList.add('hidden');
        video.classList.remove('hidden');
    } catch (error) {
        const errorDiv = document.getElementById('camera-error');
        errorDiv.textContent = '⚠ Camera access denied. Please enable camera permissions.';
        errorDiv.classList.remove('hidden');
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
}

function capturePhoto() {
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    const capturedImage = document.getElementById('captured-image');

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64
    capturedImageData = canvas.toDataURL('image/jpeg', 0.8);

    // Display captured image
    capturedImage.src = capturedImageData;
    document.getElementById('captured-image-preview').classList.remove('hidden');

    // Hide video
    video.classList.add('hidden');

    // Stop camera
    stopCamera();

    // Update buttons
    document.getElementById('capture-photo-btn').classList.add('hidden');
    document.getElementById('retake-photo-btn').classList.remove('hidden');

    // Show success message
    document.getElementById('camera-success').classList.remove('hidden');
    document.getElementById('camera-error').classList.add('hidden');
}

function retakePhoto() {
    capturedImageData = null;
    document.getElementById('camera-success').classList.add('hidden');
    document.getElementById('retake-photo-btn').classList.add('hidden');
    document.getElementById('start-camera-btn').classList.remove('hidden');

    // Clear captured image
    document.getElementById('captured-image-preview').classList.add('hidden');
    document.getElementById('camera-video').classList.remove('hidden');
}

// Close attendance modal
function closeAttendanceModal() {
    // Stop camera if running
    stopCamera();

    // Reset camera UI
    document.getElementById('start-camera-btn').classList.remove('hidden');
    document.getElementById('capture-photo-btn').classList.add('hidden');
    document.getElementById('retake-photo-btn').classList.add('hidden');
    document.getElementById('camera-success').classList.add('hidden');
    document.getElementById('camera-error').classList.add('hidden');
    document.getElementById('captured-image-preview').classList.add('hidden');
    document.getElementById('camera-video').classList.remove('hidden');

    // Reset variables
    capturedImageData = null;

    document.getElementById('attendance-modal').classList.add('hidden');
    currentClass = null;
    studentLocation = null;
}

// Submit attendance
document.getElementById('submit-attendance-btn').addEventListener('click', async () => {
    const validationCode = document.getElementById('validation-code-input').value.trim();

    if (!validationCode) {
        showAlert('modal-alert', 'Please enter the validation code', 'error');
        return;
    }

    if (currentClass.type === 'offline') {
        if (!studentLocation) {
            showAlert('modal-alert', 'Location is required for offline classes', 'error');
            return;
        }

        if (!capturedImageData) {
            showAlert('modal-alert', 'Please capture your photo before submitting attendance', 'error');
            return;
        }
    }

    const btnText = document.getElementById('submit-btn-text');
    const spinner = document.getElementById('submit-spinner');
    const btn = document.getElementById('submit-attendance-btn');

    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');
    btn.disabled = true;

    try {
        await apiCall('/attendance/submit', {
            method: 'POST',
            body: JSON.stringify({
                classId: currentClass._id,
                validationCode,
                location: studentLocation,
                imageData: capturedImageData
            })
        });

        showAlert('modal-alert', '✓ Attendance submitted successfully!', 'success');

        setTimeout(() => {
            closeAttendanceModal();
            loadActiveClasses();
            loadAttendanceHistory();
        }, 1500);
    } catch (error) {
        showAlert('modal-alert', error.message, 'error');
    } finally {
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
        btn.disabled = false;
    }
});

// Camera button event listeners
document.getElementById('start-camera-btn').addEventListener('click', startCamera);
document.getElementById('capture-photo-btn').addEventListener('click', capturePhoto);
document.getElementById('retake-photo-btn').addEventListener('click', retakePhoto);

// Open history modal
function openHistoryModal() {
    document.getElementById('history-modal').classList.remove('hidden');
    loadAttendanceHistory();
}

// Close history modal  
function closeHistoryModal() {
    document.getElementById('history-modal').classList.add('hidden');
}

// Load attendance history
async function loadAttendanceHistory() {
    try {
        const data = await apiCall('/attendance/my-attendance');
        const container = document.getElementById('history-container');
        const loading = document.getElementById('history-loading');
        const historyHeader = document.getElementById('history-header');
        const historySummary = document.getElementById('history-summary');

        loading.classList.add('hidden');

        if (data.attendance.length === 0) {
            container.innerHTML = '<p class="text-secondary text-center" style="padding: 2rem;">No attendance records yet</p>';
            historyHeader.classList.add('hidden');
            historySummary.classList.add('hidden');
            return;
        }

        historySummary.classList.remove('hidden');
        document.getElementById('history-total').textContent = data.totalClasses;

        historyHeader.classList.remove('hidden');
        container.innerHTML = data.attendance.map((record, index) => `
        <div class="compact-row">
          <div class="row-main">
            <span class="row-sl">${index + 1}</span>
            <span class="row-reg" style="width: 180px;">${record.class.name}</span>
            <span class="row-name">
              <span class="badge badge-${record.class.type === 'online' ? 'primary' : 'warning'}" style="font-size: 0.7rem;">${record.class.type.toUpperCase()}</span>
            </span>
          </div>
          <span class="row-time">${new Date(record.timestamp).toLocaleString('en-US', {
            timeZone: 'Asia/Dhaka',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}</span>
        </div>
      `).join('');
    } catch (error) {
        console.error('Load attendance error:', error);
        const container = document.getElementById('history-container');
        const loading = document.getElementById('history-loading');
        loading.classList.add('hidden');
        container.innerHTML = `<p class="text-error">${error.message}</p>`;
    }
}

// Initialize
loadActiveClasses();
