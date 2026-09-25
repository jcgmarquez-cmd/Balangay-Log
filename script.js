// ==========================================
// 1. STRICT SESSION VALIDATION HELPER
// ==========================================
function hasValidSession() {
    const token = sessionStorage.getItem('authToken');
    const user = sessionStorage.getItem('currentUser');
    
    if (!token || !user) return false;
    if (token === 'undefined' || token === 'null') return false;
    if (user === 'undefined' || user === 'null') return false;
    
    try {
        const parsed = JSON.parse(user);
        return Boolean(parsed && typeof parsed === 'object');
    } catch (e) {
        return false;
    }
}

// ==========================================
// 2. BFCACHE ROUTE GUARD
// ==========================================
window.addEventListener('pageshow', function () {
    if (hasValidSession()) {
        window.location.replace('dashboard.html');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    if (hasValidSession()) {
        window.location.replace('dashboard.html');
        return;
    }


    // Element selections
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const errorBanner = document.getElementById('errorBanner');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');

    // Password Visibility Toggle
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            togglePasswordBtn.style.color = isPassword ? '#2563eb' : '#94a3b8';
        });
    }

    // Real-Time Stats Fetcher (Polls every 5s)
    async function fetchRealtimeStats() {
        try {
            const response = await fetch('api/stats.php');
            if (response.ok) {
                const stats = await response.json();
                const activeEl = document.getElementById('activeCases');
                const resolvedEl = document.getElementById('resolvedMonth');
                const residentsEl = document.getElementById('residentsServed');
                const avgEl = document.getElementById('avgResolution');

                if (activeEl) activeEl.innerText = stats.activeCases ?? 0;
                if (resolvedEl) resolvedEl.innerText = stats.resolvedMonth ?? 0;
                if (residentsEl) residentsEl.innerText = Number(stats.residentsServed ?? 0).toLocaleString();
                if (avgEl) avgEl.innerText = `${stats.avgResolution ?? 0} days`;
            }
        } catch (err) {
            // Silently retain values
        }
    }

    fetchRealtimeStats();
    setInterval(fetchRealtimeStats, 5000);

    // Form Submission & Authentication
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (errorBanner) {
                errorBanner.style.display = 'none';
                errorBanner.innerText = '';
            }

            const username = usernameInput.value.trim();
            const password = passwordInput.value;

            if (password.length < 6) {
                if (errorBanner) {
                    errorBanner.innerText = 'Password must be at least 6 characters.';
                    errorBanner.style.display = 'block';
                }
                return;
            }

            loginBtn.disabled = true;
            loginBtn.innerText = 'Signing in...';

            try {
                const response = await fetch('api/login.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

               if (response.ok && data.success) {
                    sessionStorage.setItem('authToken', data.token);
                    sessionStorage.setItem('currentUser', JSON.stringify(data.user));
                    window.location.replace('dashboard.html');
                } else {
                    if (errorBanner) {
                        errorBanner.innerText = data.message || 'Invalid credentials.';
                        errorBanner.style.display = 'block';
                    }
                }
            } catch (error) {
                console.error('API Error:', error);
                if (errorBanner) {
                    errorBanner.innerText = 'Unable to connect to server. Ensure Apache is running.';
                    errorBanner.style.display = 'block';
                }
            } finally {
                loginBtn.disabled = false;
                loginBtn.innerText = 'Sign In';
            }
        });
    }

    // Forgot Password Flow
    const forgotModal = document.getElementById('forgotModal');
    const closeForgotModal = document.getElementById('closeForgotModal');
    const dismissForgotBtn = document.getElementById('dismissForgotBtn');
    const forgotModalUserDisplay = document.getElementById('forgotModalUserDisplay');

    function closeForgotModalHandler() {
        if (forgotModal) forgotModal.style.display = 'none';
    }

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', async (e) => {
            e.preventDefault();

            if (errorBanner) {
                errorBanner.style.display = 'none';
                errorBanner.innerText = '';
            }

            const username = usernameInput ? usernameInput.value.trim() : '';

            if (!username) {
                if (errorBanner) {
                    errorBanner.innerText = 'Please enter your username or email above first.';
                    errorBanner.style.display = 'block';
                }
                if (usernameInput) usernameInput.focus();
                return;
            }

            try {
                const response = await fetch('api/check_user.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username })
                });

                const data = await response.json();

                if (data.success && data.exists) {
                    if (forgotModalUserDisplay) {
                        forgotModalUserDisplay.innerText = data.name || username;
                    }
                    if (forgotModal) forgotModal.style.display = 'flex';
                } else {
                    if (errorBanner) {
                        errorBanner.innerText = data.message || 'Account not registered.';
                        errorBanner.style.display = 'block';
                    }
                    if (usernameInput) usernameInput.focus();
                }
            } catch (err) {
                if (errorBanner) {
                    errorBanner.innerText = 'Unable to verify account. Please try again.';
                    errorBanner.style.display = 'block';
                }
            }
        });
    }

    if (closeForgotModal) closeForgotModal.addEventListener('click', closeForgotModalHandler);
    if (dismissForgotBtn) dismissForgotBtn.addEventListener('click', closeForgotModalHandler);

    window.addEventListener('click', (e) => {
        if (e.target === forgotModal) closeForgotModalHandler();
    });
});