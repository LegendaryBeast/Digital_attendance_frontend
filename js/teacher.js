// API_URL is defined in auth.js as window.API_URL
let teacherLocation = null;
let currentClassId = null;

// Check authentication
const { token, user } = getUserData();
if (!token || !user || user.role !== 'teacher') {
    window.location.href = '/index.html';
}

// Display teacher info
document.getElementById('teacher-name').textContent = user.name;
document.getElementById('teacher-info').textContent = user.email;

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

// Generate random code
function generateRandomCode() {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    document.getElementById('validation-code').value = code;
}

function generateRandomCodeForUpdate() {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    document.getElementById('new-validation-code').value = code;
}

// Show/hide location section and auto-get location for offline classes
document.getElementById('class-type').addEventListener('change', async (e) => {
    const locationSection = document.getElementById('location-section');
    if (e.target.value === 'offline') {
        locationSection.classList.remove('hidden');
        // Auto-get location
        await getTeacherLocation();
    } else {
        locationSection.classList.add('hidden');
        teacherLocation = null;
        document.getElementById('location-display').innerHTML = '';
    }
});

// Get teacher's current location
async function getTeacherLocation() {
    const displayDiv = document.getElementById('location-display');
    displayDiv.innerHTML = `
    <div class="flex gap-sm">
      <div class="spinner spinner-small"></div>
      <span class="text-secondary">Getting your location...</span>
    </div>
  `;

    try {
        const position = await new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });

        teacherLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
        };

        displayDiv.innerHTML = `
      <div class="alert alert-success">
        ✓ Location acquired: ${teacherLocation.latitude.toFixed(6)}, ${teacherLocation.longitude.toFixed(6)}
      </div>
    `;
    } catch (error) {
        displayDiv.innerHTML = `
      <div class="alert alert-error">
        ⚠ ${error.message}
      </div>
    `;
        teacherLocation = null;
    }
}

// Create class form handler
document.getElementById('create-class-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('class-name').value;
    const type = document.getElementById('class-type').value;
    const validationCode = document.getElementById('validation-code').value;

    if (type === 'offline' && !teacherLocation) {
        showAlert('alert-container', 'Please get your location for offline classes', 'error');
        return;
    }

    const btnText = document.getElementById('create-btn-text');
    const spinner = document.getElementById('create-spinner');

    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');

    try {
        await apiCall('/classes/create', {
            method: 'POST',
            body: JSON.stringify({
                name,
                type,
                validationCode,
                location: teacherLocation,
                courseId: document.getElementById('class-course').value || null // Include courseId in request
            })
        });

        showAlert('alert-container', '✓ Class created successfully!', 'success');

        // Reset form
        document.getElementById('create-class-form').reset();
        teacherLocation = null;
        document.getElementById('location-display').innerHTML = '';
        document.getElementById('location-section').classList.add('hidden');

        // Reload classes
        loadMyClasses();
    } catch (error) {
        showAlert('alert-container', error.message, 'error');
    } finally {
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
    }
});

// Load teacher's classes
async function loadMyClasses() {
    try {
        const data = await apiCall('/classes/teacher/my-classes');
        const container = document.getElementById('classes-container');
        const loading = document.getElementById('classes-loading');

        loading.classList.add('hidden');
        container.classList.remove('hidden');

        if (data.classes.length === 0) {
            container.innerHTML = '<p class="text-secondary">No classes created yet</p>';
            return;
        }

        container.innerHTML = data.classes.map(cls => `
      <div class="class-card">
        <div class="flex-between mb-sm">
          <h3 style="margin: 0;">${cls.name}</h3>
          <div class="flex gap-sm">
            <span class="badge badge-${cls.type === 'online' ? 'primary' : 'warning'}">
              ${cls.type.toUpperCase()}
            </span>
            <span class="badge badge-${cls.isActive ? 'success' : 'error'}">
              ${cls.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
        
        <p class="text-secondary" style="margin: 0.5rem 0;">Validation Code: <strong>${cls.validationCode}</strong></p>
        <p class="text-muted" style="font-size: 0.85rem; margin-bottom: 1rem;">
          Created: ${new Date(cls.date).toLocaleString('en-US', {
            timeZone: 'Asia/Dhaka',
            dateStyle: 'medium',
            timeStyle: 'short'
        })}
        </p>

        <div class="flex gap-sm" style="flex-wrap: wrap;">
          <button 
            onclick="viewAttendance('${cls._id}')" 
            class="btn btn-primary"
          >
            View Attendance
          </button>
          <button 
            onclick="openCodeModal('${cls._id}')" 
            class="btn btn-secondary"
          >
            Update Code
          </button>
          ${cls.type === 'offline' ? `
          <button 
            onclick="openLocationModal('${cls._id}')" 
            class="btn btn-secondary"
          >
            Update Location
          </button>
          ` : ''}
          <button 
            onclick="toggleClass('${cls._id}', ${cls.isActive})" 
            class="btn btn-outline"
          >
            ${cls.isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button 
            onclick="deleteClass('${cls._id}', '${cls.name.replace(/'/g, "\\'")}')" 
            class="btn btn-error"
            style="margin-left: auto;"
          >
            Delete
          </button>
        </div>
      </div>
    `).join('');
    } catch (error) {
        console.error('Load classes error:', error);
        showAlert('alert-container', error.message, 'error');
    }
}

// View attendance for a class
async function viewAttendance(classId) {
    try {
        const data = await apiCall(`/attendance/class/${classId}`);
        currentClassId = classId;

        document.getElementById('modal-class-name').textContent = data.class.name;
        document.getElementById('total-students').textContent = data.totalStudents;

        const attendanceList = document.getElementById('attendance-list');

        if (data.attendance.length === 0) {
            attendanceList.innerHTML = '<p class="text-secondary text-center" style="padding: 2rem;">No attendance records yet</p>';
        } else {
            attendanceList.innerHTML = data.attendance.map((record, index) => `
        <div class="compact-row" style="align-items: center;">
          <div class="row-main">
            <span class="row-sl">${index + 1}</span>
            <span class="row-reg">${record.registrationNumber}</span>
            <span class="row-name">${record.studentName}</span>
            ${record.imageUrl ? `
              <a href="${record.imageUrl}" target="_blank" title="View photo verification" style="text-decoration: none;">
                <img src="${record.imageUrl}" alt="Photo" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary); cursor: pointer; margin-left: 0.5rem;" />
              </a>
            ` : ''}
          </div>
          <span class="row-time">${new Date(record.timestamp).toLocaleString('en-US', {
                timeZone: 'Asia/Dhaka',
                hour: '2-digit',
                minute: '2-digit'
            })}${record.distance !== null ? ` • ${record.distance}m` : ''}</span>
        </div>
      `).join('');
        }

        document.getElementById('attendance-modal').classList.remove('hidden');
    } catch (error) {
        showAlert('alert-container', error.message, 'error');
    }
}

// Close attendance modal
function closeAttendanceModal() {
    document.getElementById('attendance-modal').classList.add('hidden');
    currentClassId = null;
}

// Export to Excel
document.getElementById('export-btn').addEventListener('click', async () => {
    const btn = document.getElementById('export-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';

    try {
        const response = await fetch(`${API_URL}/attendance/export/${currentClassId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Export failed');
        }

        // Get the filename from Content-Disposition header or generate one
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'attendance.xlsx';
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+)"/);
            if (match) filename = match[1];
        }

        // Download the file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

        showAlert('modal-alert', '✓ Excel file downloaded successfully!', 'success');
    } catch (error) {
        showAlert('modal-alert', error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
});

// Open code update modal
function openCodeModal(classId) {
    currentClassId = classId;
    document.getElementById('new-validation-code').value = '';
    document.getElementById('code-modal-alert').innerHTML = '';
    document.getElementById('code-modal').classList.remove('hidden');
}

// Close code modal
function closeCodeModal() {
    document.getElementById('code-modal').classList.add('hidden');
    currentClassId = null;
}

// Update validation code
document.getElementById('update-code-btn').addEventListener('click', async () => {
    const newCode = document.getElementById('new-validation-code').value.trim();

    if (!newCode) {
        showAlert('code-modal-alert', 'Please enter a validation code', 'error');
        return;
    }

    const btn = document.getElementById('update-code-btn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Updating...';

    try {
        await apiCall(`/classes/generate-code/${currentClassId}`, {
            method: 'POST',
            body: JSON.stringify({ validationCode: newCode })
        });

        showAlert('code-modal-alert', '✓ Validation code updated successfully!', 'success');

        setTimeout(() => {
            closeCodeModal();
            loadMyClasses();
        }, 1500);
    } catch (error) {
        showAlert('code-modal-alert', error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
});

// Toggle class active status
async function toggleClass(classId, currentStatus) {
    try {
        await apiCall(`/classes/${classId}/toggle`, {
            method: 'PATCH'
        });

        showAlert('alert-container',
            `✓ Class ${currentStatus ? 'deactivated' : 'activated'} successfully!`,
            'success'
        );

        loadMyClasses();
    } catch (error) {
        showAlert('alert-container', error.message, 'error');
    }
}

// Delete class
async function deleteClass(classId, className) {
    if (!confirm(`Are you sure you want to delete "${className}"?\n\nThis will also delete all attendance records for this class. This action cannot be undone.`)) {
        return;
    }

    try {
        await apiCall(`/classes/${classId}`, {
            method: 'DELETE'
        });

        showAlert('alert-container', '✓ Class deleted successfully!', 'success');
        loadMyClasses();
    } catch (error) {
        showAlert('alert-container', error.message, 'error');
    }
}

// ================== COURSE MANAGEMENT ==================

let currentCourseId = null;
let teacherCourses = [];

// Create course form handler
document.getElementById('create-course-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const courseCode = document.getElementById('course-code').value.trim();
    const courseName = document.getElementById('course-name').value.trim();
    const session = document.getElementById('course-session').value.trim();

    const btnText = document.getElementById('create-course-btn-text');
    const spinner = document.getElementById('create-course-spinner');

    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');

    try {
        await apiCall('/courses/create', {
            method: 'POST',
            body: JSON.stringify({
                courseCode,
                courseName,
                session
            })
        });

        showAlert('alert-container', '✓ Course created successfully!', 'success');

        // Reset form
        document.getElementById('create-course-form').reset();

        // Reload courses and update dropdown
        await loadTeacherCourses();
        populateCourseDropdown();
    } catch (error) {
        showAlert('alert-container', error.message, 'error');
    } finally {
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
    }
});

// Load teacher's courses
async function loadTeacherCourses() {
    try {
        const data = await apiCall('/courses/teacher/my-courses');
        teacherCourses = data.courses;
        const container = document.getElementById('courses-container');
        const loading = document.getElementById('courses-loading');

        loading.classList.add('hidden');
        container.classList.remove('hidden');

        if (data.courses.length === 0) {
            container.innerHTML = '<p class="text-secondary">No courses created yet</p>';
            return;
        }

        container.innerHTML = data.courses.map(course => `
      <div class="class-card">
        <div class="flex-between mb-sm">
          <h3 style="margin: 0;">${course.courseCode} - ${course.courseName}</h3>
          <span class="badge badge-primary">Session: ${course.session}</span>
        </div>
        
        <p class="text-muted" style="font-size: 0.85rem; margin-bottom: 1rem;">
          Created: ${new Date(course.createdAt).toLocaleString('en-US', {
            timeZone: 'Asia/Dhaka',
            dateStyle: 'medium',
            timeStyle: 'short'
        })}
        </p>

        <div class="flex gap-sm" style="flex-wrap: wrap;">
          <button 
            onclick="viewCumulativeAttendance('${course._id}')" 
            class="btn btn-primary"
          >
            View Cumulative Attendance
          </button>
          <button 
            onclick="downloadCumulativeAttendance('${course._id}')" 
            class="btn btn-secondary"
          >
            Download Report
          </button>
          <button 
            onclick="deleteCourse('${course._id}', '${course.courseCode.replace(/'/g, "\\'")}')" 
            class="btn btn-error"
            style="margin-left: auto;"
          >
            Delete
          </button>
        </div>
      </div>
    `).join('');
    } catch (error) {
        console.error('Load courses error:', error);
        showAlert('alert-container', error.message, 'error');
    }
}

// Populate course dropdown in class creation form
function populateCourseDropdown() {
    const dropdown = document.getElementById('class-course');

    // Keep the default option and add courses
    dropdown.innerHTML = `
        <option value="">Individual Class (No Course)</option>
        ${teacherCourses.map(course => `
            <option value="${course._id}">${course.courseCode} - ${course.courseName} (${course.session})</option>
        `).join('')}
    `;
}

// View cumulative attendance for a course
async function viewCumulativeAttendance(courseId) {
    try {
        const data = await apiCall(`/courses/${courseId}/cumulative-attendance`);
        currentCourseId = courseId;

        document.getElementById('cumulative-course-name').textContent =
            `${data.course.courseCode} - ${data.course.courseName} (${data.course.session})`;
        document.getElementById('cumulative-total-students').textContent = data.totalStudents;

        const attendanceList = document.getElementById('cumulative-attendance-list');

        if (data.attendance.length === 0) {
            attendanceList.innerHTML = '<p class="text-secondary text-center" style="padding: 2rem;">No attendance records yet</p>';
        } else {
            attendanceList.innerHTML = data.attendance.map((record, index) => `
        <div class="compact-row" style="align-items: center;">
          <div class="row-main">
            <span class="row-sl">${index + 1}</span>
            <span class="row-reg">${record.registrationNumber}</span>
            <span class="row-name">${record.studentName}</span>
          </div>
          <span class="row-time">${record.attendanceCount} class${record.attendanceCount !== 1 ? 'es' : ''}</span>
        </div>
      `).join('');
        }

        document.getElementById('cumulative-modal').classList.remove('hidden');
    } catch (error) {
        showAlert('alert-container', error.message, 'error');
    }
}

// Close cumulative attendance modal
function closeCumulativeModal() {
    document.getElementById('cumulative-modal').classList.add('hidden');
    currentCourseId = null;
}

// Download cumulative attendance Excel
async function downloadCumulativeAttendance(courseId) {
    try {
        const response = await fetch(`${API_URL}/courses/${courseId}/download-cumulative`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Export failed');
        }

        // Get the filename from Content-Disposition header
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'cumulative_attendance.xlsx';
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+)"/);
            if (match) filename = match[1];
        }

        // Download the file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

        showAlert('alert-container', '✓ Cumulative attendance downloaded successfully!', 'success');
    } catch (error) {
        showAlert('alert-container', error.message, 'error');
    }
}

// Export cumulative attendance from modal
document.getElementById('export-cumulative-btn').addEventListener('click', async () => {
    if (!currentCourseId) return;

    const btn = document.getElementById('export-cumulative-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';

    try {
        await downloadCumulativeAttendance(currentCourseId);
        showAlert('cumulative-modal-alert', '✓ Excel file downloaded successfully!', 'success');
    } catch (error) {
        showAlert('cumulative-modal-alert', error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
});

// Delete course
async function deleteCourse(courseId, courseCode) {
    if (!confirm(`Are you sure you want to delete course "${courseCode}"?\n\nThis will delete all cumulative attendance records for this course. Classes linked to this course will become individual classes. This action cannot be undone.`)) {
        return;
    }

    try {
        await apiCall(`/courses/${courseId}`, {
            method: 'DELETE'
        });

        showAlert('alert-container', '✓ Course deleted successfully!', 'success');
        await loadTeacherCourses();
        populateCourseDropdown();
    } catch (error) {
        showAlert('alert-container', error.message, 'error');
    }
}
// ================== COURSE MANAGEMENT MODAL ==================

function openCourseManagementModal() {
    document.getElementById('course-management-modal').classList.remove('hidden');
    loadTeacherCourses();
}

function closeCourseManagementModal() {
    document.getElementById('course-management-modal').classList.add('hidden');
}

// ================== LOCATION UPDATE ==================

let updateLocationCoords = null;

function openLocationModal(classId) {
    currentClassId = classId;
    updateLocationCoords = null;
    document.getElementById('location-modal-alert').innerHTML = '';
    document.getElementById('update-location-display').innerHTML = '';
    document.getElementById('update-location-btn').disabled = true;
    document.getElementById('location-modal').classList.remove('hidden');
}

function closeLocationModal() {
    document.getElementById('location-modal').classList.add('hidden');
    currentClassId = null;
    updateLocationCoords = null;
}

async function getUpdateLocation() {
    const displayDiv = document.getElementById('update-location-display');
    const updateBtn = document.getElementById('update-location-btn');

    displayDiv.innerHTML = `
    <div class="flex gap-sm flex-center">
      <div class="spinner spinner-small"></div>
      <span class="text-secondary">Getting your location...</span>
    </div>
    `;

    try {
        const position = await new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });

        updateLocationCoords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
        };

        displayDiv.innerHTML = `
        <div class="alert alert-success">
            ✓ Location acquired: ${updateLocationCoords.latitude.toFixed(6)}, ${updateLocationCoords.longitude.toFixed(6)}
        </div>
        `;
        updateBtn.disabled = false;

    } catch (error) {
        displayDiv.innerHTML = `
        <div class="alert alert-error">
            ⚠ ${error.message}
        </div>
        `;
        updateLocationCoords = null;
        updateBtn.disabled = true;
    }
}

document.getElementById('update-location-btn').addEventListener('click', async () => {
    if (!currentClassId || !updateLocationCoords) return;

    const btn = document.getElementById('update-location-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Updating...';

    try {
        await apiCall(`/classes/${currentClassId}/location`, {
            method: 'PATCH',
            body: JSON.stringify({ location: updateLocationCoords })
        });

        showAlert('location-modal-alert', '✓ Location updated successfully!', 'success');

        setTimeout(() => {
            closeLocationModal();
            loadMyClasses();
        }, 1500);
    } catch (error) {
        showAlert('location-modal-alert', error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
});


// ================== INITIALIZATION ==================

// Initialize - load both classes and courses
(async function initialize() {
    await loadTeacherCourses();
    populateCourseDropdown();
    loadMyClasses();
})();
