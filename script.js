document.addEventListener('DOMContentLoaded', () => {
    // Element selections
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const errorBanner = document.getElementById('errorBanner');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');

    // 1. Password Visibility Toggle
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            togglePasswordBtn.style.color = isPassword ? '#2563eb' : '#94a3b8';
        });
    }

    // 2. Real-Time Stats Fetcher (Polls every 5s)
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
            // Silently retain values if the endpoint is temporarily unreachable
        }
    }

    fetchRealtimeStats();
    setInterval(fetchRealtimeStats, 5000);

    // 3. Form Submission & Authentication
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

            // Client-side password length check
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
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    // Save specific logged in account
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('currentUser', JSON.stringify(data.user));

                    window.location.href = 'dashboard.html';
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

   // 4. Forgot Password Flow with Account Existence Verification
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

            // Clear previous error
            if (errorBanner) {
                errorBanner.style.display = 'none';
                errorBanner.innerText = '';
            }

            const username = usernameInput ? usernameInput.value.trim() : '';

            // Step 1: Prompt user if the username field is blank
            if (!username) {
                if (errorBanner) {
                    errorBanner.innerText = 'Please enter your username or email above first.';
                    errorBanner.style.display = 'block';
                }
                if (usernameInput) usernameInput.focus();
                return;
            }

            // Step 2: Query the database to check if the user is registered
            try {
                const response = await fetch('api/check_user.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username })
                });

                const data = await response.json();

                if (data.success && data.exists) {
                    // Registered user detected: Open the admin reset modal
                    if (forgotModalUserDisplay) {
                        forgotModalUserDisplay.innerText = data.name || username;
                    }
                    if (forgotModal) forgotModal.style.display = 'flex';
                } else {
                    // Unregistered user detected: Show error asking for existing account
                    if (errorBanner) {
                        errorBanner.innerText = data.message || 'Account not registered. Please enter an existing account or username.';
                        errorBanner.style.display = 'block';
                    }
                    if (usernameInput) usernameInput.focus();
                }
            } catch (err) {
                console.error('Check user error:', err);
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