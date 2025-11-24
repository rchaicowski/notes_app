export class LoginManager {
    constructor() {
        // Clear any previous offline mode setting on fresh load
        if (!localStorage.getItem('token')) {
            localStorage.removeItem('offlineMode');
        }
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user'));
        this.offlineMode = localStorage.getItem('offlineMode') === 'true';
        this.initializeUI();
        this.setupEventListeners();
    }

    initializeUI() {
        const authContainer = document.getElementById('authContainer');
        const userInfo = document.getElementById('userInfo');
        
        if (this.token) {
            // User is logged in
            authContainer?.classList.add('hidden');
            userInfo?.classList.remove('hidden');
            this.updateUserInfo();
        } else {
            // No token, show auth container by default
            authContainer?.classList.remove('hidden');
            userInfo?.classList.add('hidden');
            
            // Only hide auth container if explicitly in offline mode
            if (this.offlineMode) {
                authContainer?.classList.add('hidden');
            }
        }
    }

    setupEventListeners() {
        document.getElementById('loginForm')?.addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerForm')?.addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.handleLogout());
        document.getElementById('showRegister')?.addEventListener('click', () => this.toggleForms('register'));
        document.getElementById('showLogin')?.addEventListener('click', () => this.toggleForms('login'));
        document.getElementById('deleteAccountBtn')?.addEventListener('click', () => this.handleDeleteAccount());
        document.getElementById('useOfflineMode')?.addEventListener('click', () => this.enableOfflineMode());
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const emailInput = document.getElementById('loginEmail');
        const passwordInput = document.getElementById('loginPassword');
        
        // Reset validation states
        emailInput.classList.remove('is-invalid');
        passwordInput.classList.remove('is-invalid');
        
        // Validate email
        if (!emailInput.validity.valid) {
            emailInput.classList.add('is-invalid');
            return;
        }
        
        // Validate password
        if (!passwordInput.validity.valid) {
            passwordInput.classList.add('is-invalid');
            return;
        }

        const email = emailInput.value;
        const password = passwordInput.value;

        try {
            const response = await fetch('http://localhost:5000/api/users/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                let errText = 'Login failed. Please check your credentials.';
                try {
                    const errBody = await response.json();
                    if (errBody && (errBody.error || errBody.message)) {
                        errText = errBody.error || errBody.message;
                    }
                } catch (e) {}
                throw new Error(errText);
            }

            const data = await response.json();
            this.setAuthData(data);
        } catch (error) {
            console.error('Login failed:', error);
            this.showError('Login failed. Please check your credentials.');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        // Disable the submit button to prevent double submission
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const name = document.getElementById('registerName').value;

        try {
            const response = await fetch('http://localhost:5000/api/users/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name })
            });

            // If server returned an error, try to show its message to the user
            if (!response.ok) {
                let errText = 'Registration failed. Please try again.';
                try {
                    const errBody = await response.json();
                    if (errBody && (errBody.error || errBody.message)) {
                        errText = errBody.error || errBody.message;
                    }
                } catch (e) {
                    // ignore JSON parse errors
                }
                throw new Error(errText);
            }

            const data = await response.json();
            this.setAuthData(data);
        } catch (error) {
            console.error('Registration failed:', error);
            this.showError('Registration failed. Please try again.');
        } finally {
            // Re-enable the submit button
            submitButton.disabled = false;
        }
    }

    handleLogout() {
        // Clear both token keys and notify app
        localStorage.removeItem('token');
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        this.token = null;
        this.user = null;
        // Inform other modules that auth changed
        window.dispatchEvent(new CustomEvent('auth-changed', { detail: { isAuthenticated: false } }));
        this.initializeUI();
    }

    async handleDeleteAccount() {
        if (!confirm('Are you sure you want to delete your account? This action cannot be undone and all your notes will be deleted.')) {
            return;
        }

        try {
            const response = await fetch('http://localhost:5000/api/users/account', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) throw new Error('Failed to delete account');

            localStorage.clear(); // Clear all local storage
            window.location.reload();
        } catch (error) {
            console.error('Delete account failed:', error);
            this.showError('Failed to delete account. Please try again.');
        }
    }

    enableOfflineMode() {
        localStorage.setItem('offlineMode', 'true');
        document.getElementById('authContainer')?.classList.add('hidden');
        document.getElementById('userInfo')?.classList.add('hidden');
        window.dispatchEvent(new CustomEvent('offline-mode-changed', { 
            detail: { isOffline: true } 
        }));
    }

    setAuthData(data) {
        // Persist token under both keys for compatibility and update in-memory state
        localStorage.setItem('token', data.token);
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        this.token = data.token;
        this.user = data.user;

        // Update UI and notify listeners
        this.updateUserInfo();
        window.dispatchEvent(new CustomEvent('auth-changed', { detail: { isAuthenticated: true, user: this.user } }));

        // Recompute UI visibility now that we have a token
        this.initializeUI();
    }

    updateUserInfo() {
        const userName = document.getElementById('userName');
        if (userName && this.user) {
            userName.textContent = this.user.name || this.user.email;
        }
    }

    toggleForms(form) {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        if (form === 'register') {
            loginForm?.classList.add('hidden');
            registerForm?.classList.remove('hidden');
        } else {
            registerForm?.classList.add('hidden');
            loginForm?.classList.remove('hidden');
        }
    }

    showError(message) {
        alert(message); // For now, using alert. Can be enhanced with a better UI later
    }
}
