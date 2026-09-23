const signupForm = document.getElementById('signupForm');
const signupBtn = document.getElementById('signupBtn');
const errorBanner = document.getElementById('errorBanner');
// Match the id="password" from signup.html
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const togglePasswordBtn = document.getElementById('togglePassword');

// 1. Password Visibility Toggle
if (togglePasswordBtn && passwordInput && confirmPasswordInput) {
    togglePasswordBtn.addEventListener('click', function() {
        const isPassword = passwordInput.getAttribute('type') === 'password';
        const newType = isPassword ? 'text' : 'password';

        passwordInput.setAttribute('type', newType);
        confirmPasswordInput.setAttribute('type', newType);
        togglePasswordBtn.innerText = isPassword ? 'Hide' : 'Show';
    });
}

// 2. Form Submission Handler
if (signupForm) {
    signupForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        // Reset UI error state
        if (errorBanner) {
            errorBanner.style.display = 'none';
            errorBanner.innerText = '';
        }

        const fullname = document.getElementById('fullname')?.value.trim() || '';
        const username = document.getElementById('username')?.value.trim() || '';
        const password = passwordInput?.value || '';
        const confirmPassword = confirmPasswordInput?.value || '';

        // Frontend validation checks
        if (password.length < 6) {
            showError('Password must be at least 6 characters.');
            return;
        }

        if (password !== confirmPassword) {
            showError('Passwords do not match.');
            return;
        }

        // UI loading state
        signupBtn.disabled = true;
        signupBtn.innerText = 'Creating account...';

        try {
            const response = await fetch('api/signup.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    full_name: fullname,
                    email_or_phone: username,
                    password: password,
                    user_type: 'RESIDENT'
                })
            });

            const result = await response.json();

            if (result.success) {
                alert('Account successfully created! Please log in.');
                window.location.href = 'index.html';
            } else {
                showError(result.message || 'Registration failed.');
            }
        } catch (error) {
            console.error('Sign-up error:', error);
            showError('Connection failed. Make sure Apache and MySQL are running in XAMPP.');
        } finally {
            signupBtn.disabled = false;
            signupBtn.innerText = 'Sign Up';
        }
    });
}

// Helper to style and display error messages
function showError(msg) {
    if (!errorBanner) return;
    errorBanner.innerText = msg;
    errorBanner.style.display = 'block';
    errorBanner.style.color = '#b91c1c';
    errorBanner.style.background = '#fee2e2';
    errorBanner.style.padding = '10px';
    errorBanner.style.borderRadius = '6px';
    errorBanner.style.marginBottom = '14px';
}