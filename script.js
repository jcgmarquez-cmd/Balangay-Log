document.addEventListener('DOMContentLoaded', () => {
    // Element selections
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const errorBanner = document.getElementById('errorBanner');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('togglePassword');

    // 1. Password Visibility Toggle
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            togglePasswordBtn.style.color = isPassword ? '#2563eb' : '#94a3b8';
        });
    }

    // 2. Demo Account Quick-Fill Buttons
    const demoChips = document.querySelectorAll('.demo-chip');
    demoChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            e.preventDefault();
            const user = chip.getAttribute('data-user');
            const pass = chip.getAttribute('data-pass');

            if (usernameInput && passwordInput) {
                usernameInput.value = user;
                passwordInput.value = pass;
                if (errorBanner) errorBanner.style.display = 'none';

                // Automatically mask the password and reset the eye icon state
                passwordInput.setAttribute('type', 'password');
                if (togglePasswordBtn) {
                    togglePasswordBtn.style.color = '#94a3b8';
                }
            }
        });
    });

    // 3. Real-Time Stats Fetcher (Polls every 5s)
    async function fetchRealtimeStats() {
        try {
            const response = await fetch('api/stats.php');
            if (response.ok) {
                const stats = await response.json();
                const activeEl = document.getElementById('activeCases');
                const resolvedEl = document.getElementById('resolvedMonth');
                const residentsEl = document.getElementById('residentsServed');
                const avgEl = document.getElementById('avgResolution');

                if (activeEl) activeEl.innerText = stats.activeCases;
                if (resolvedEl) resolvedEl.innerText = stats.resolvedMonth;
                if (residentsEl) residentsEl.innerText = Number(stats.residentsServed).toLocaleString();
                if (avgEl) avgEl.innerText = `${stats.avgResolution} days`;
            }
        } catch (err) {
            // Silently retain values if the endpoint is temporarily unreachable
        }
    }

    fetchRealtimeStats();
    setInterval(fetchRealtimeStats, 5000);

    // 4. Form Submission & Authentication
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            // Hide previous error banner
            if (errorBanner) {
                errorBanner.style.display = 'none';
                errorBanner.innerText = '';
            }

            const username = usernameInput.value.trim();
            const password = passwordInput.value;

            // Strict client-side password length check
            if (password.length < 6) {
                if (errorBanner) {
                    errorBanner.innerText = 'Password must be at least 6 characters.';
                    errorBanner.style.display = 'block';
                }
                return;
            }

            // Button loading state
            loginBtn.disabled = true;
            loginBtn.innerText = 'Signing in...';

            try {
                const response = await fetch('api/login.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    // Save credentials to localStorage
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('currentUser', JSON.stringify(data.user));

                    // Route user according to User Management Module specification
                    const userRole = (data.user?.role || '').toUpperCase();

                    if (userRole === 'RESIDENT') {
                        window.location.href = 'dashboard.html';
                    } else {
                        window.location.href = 'dashboard.html';
                    }
                } else {
                    if (errorBanner) {
                        errorBanner.innerText = data.message || 'Invalid username or password.';
                        errorBanner.style.display = 'block';
                    }
                }
            } catch (error) {
                console.error('API Error:', error);
                if (errorBanner) {
                    errorBanner.innerText = 'Unable to connect to server. Ensure server is running.';
                    errorBanner.style.display = 'block';
                }
            } finally {
                loginBtn.disabled = false;
                loginBtn.innerText = 'Sign In';
            }
        });
    }
}); 