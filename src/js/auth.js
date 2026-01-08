window.API_URL = 'http://localhost:3000/api';

// Show alert message
function showAlert(elementId, message, type) {
    const alertDiv = document.getElementById(elementId);
    alertDiv.innerHTML = `
    <div class="alert alert-${type}">
      ${message}
    </div>
  `;
    setTimeout(() => {
        alertDiv.innerHTML = '';
    }, 5000);
}

// Save user data to localStorage
function saveUserData(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
}

// Get user data from localStorage
function getUserData() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    return { token, user: user ? JSON.parse(user) : null };
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

// Check if user is logged in and redirect
function checkAuth() {
    const { token, user } = getUserData();
    if (token && user) {
        if (user.role === 'student') {
            window.location.href = '/student-dashboard.html';
        } else if (user.role === 'teacher') {
            window.location.href = '/teacher-dashboard.html';
        }
    }
}

// Login form handler
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const btnText = document.getElementById('login-btn-text');
    const spinner = document.getElementById('login-spinner');

    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            saveUserData(data.token, data.user);

            // Save email for "Remember me" feature
            const rememberMe = document.getElementById('remember-me')?.checked;
            if (rememberMe) {
                localStorage.setItem('rememberedEmail', email);
            } else {
                localStorage.removeItem('rememberedEmail');
            }

            showAlert('login-alert', 'Login successful! Redirecting...', 'success');

            setTimeout(() => {
                if (data.user.role === 'student') {
                    window.location.href = '/student-dashboard.html';
                } else {
                    window.location.href = '/teacher-dashboard.html';
                }
            }, 1000);
        } else {
            showAlert('login-alert', data.error || 'Login failed', 'error');
        }
    } catch (error) {
        showAlert('login-alert', 'Network error. Please try again.', 'error');
    } finally {
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
    }
});

// Register form handler
document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const role = document.getElementById('register-role').value;

    const btnText = document.getElementById('register-btn-text');
    const spinner = document.getElementById('register-spinner');

    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password, role })
        });

        const data = await response.json();

        if (response.ok) {
            saveUserData(data.token, data.user);
            showAlert('register-alert', 'Registration successful! Redirecting...', 'success');

            setTimeout(() => {
                if (data.user.role === 'student') {
                    window.location.href = '/student-dashboard.html';
                } else {
                    window.location.href = '/teacher-dashboard.html';
                }
            }, 1000);
        } else {
            showAlert('register-alert', data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        showAlert('register-alert', 'Network error. Please try again.', 'error');
    } finally {
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
    }
});

// Check if already logged in on page load
if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
    checkAuth();

    // Prefill remembered email
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
        const emailInput = document.getElementById('login-email');
        const rememberCheckbox = document.getElementById('remember-me');
        if (emailInput) emailInput.value = rememberedEmail;
        if (rememberCheckbox) rememberCheckbox.checked = true;
    }
}
