/**
 * @fileoverview Login and registration UI management
 * Handles user authentication flows, offline mode, account management, and email verification UI
 * @module loginManager
 */

import { 
    API_URL, 
    setAuthToken, 
    setCurrentUser, 
    logout as authLogout,
    getAuthToken,
    getCurrentUser
} from './auth.js';

/**
 * Manages authentication UI and user session lifecycle
 * Coordinates login, registration, logout, offline mode, and email verification UI
 */
export class LoginManager {
    /**
     * Initializes the login manager
     * Loads auth state from centralized auth module and sets up UI accordingly
     */
    constructor() {
        // Clear offline mode if no valid session exists (fresh start)
        if (!getAuthToken()) {
            localStorage.removeItem('offlineMode');
        }
        
        // Load persisted auth state from centralized auth module
        this.token = getAuthToken();
        this.user = getCurrentUser();
        this.offlineMode = localStorage.getItem('offlineMode') === 'true';
        
        this.initializeUI();
        this.setupEventListeners();
    }

    /**
     * Initializes UI visibility based on authentication state
     * Shows/hides auth container and user info panel
     */
    initializeUI() {
        const authContainer = document.getElementById('authContainer');
        const userInfo = document.getElementById('userInfo');
        
        if (this.token) {
            // User is authenticated - show user info
            authContainer?.classList.add('hidden');
            userInfo?.classList.remove('hidden');
            this.updateUserInfo();
        } else {
            // No token - show auth forms by default
            authContainer?.classList.remove('hidden');
            userInfo?.classList.add('hidden');
            
            // Hide auth forms only if explicitly in offline mode
            if (this.offlineMode) {
                authContainer?.classList.add('hidden');
            }
        }
    }

    /**
     * Sets up all DOM event listeners for authentication UI
     * Handles form submissions, mode toggles, and account actions
     */
    setupEventListeners() {
        // Form submissions
        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            this.handleLogin(e);
        });
        
        document.getElementById('registerForm')?.addEventListener('submit', (e) => {
            this.handleRegister(e);
        });
        
        // Auth actions
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            this.handleLogout();
        });
        
        // Form toggles
        document.getElementById('showRegister')?.addEventListener('click', () => {
            this.toggleForms('register');
        });
        
        document.getElementById('showLogin')?.addEventListener('click', () => {
            this.toggleForms('login');
        });
        
        // Account management
        document.getElementById('deleteAccountBtn')?.addEventListener('click', () => {
            this.handleDeleteAccount();
        });
        
        // Offline mode
        document.getElementById('useOfflineMode')?.addEventListener('click', () => {
            this.enableOfflineMode();
        });
    }

    /**
     * Handles user login form submission
     * Validates inputs, sends login request, and updates auth state
     * 
     * @param {Event} e - Form submit event
     */
    async handleLogin(e) {
        e.preventDefault();
        
        const emailInput = document.getElementById('loginEmail');
        const passwordInput = document.getElementById('loginPassword');
        
        // Reset previous validation states
        emailInput.classList.remove('is-invalid');
        passwordInput.classList.remove('is-invalid');
        
        // Validate email format
        if (!emailInput.validity.valid) {
            emailInput.classList.add('is-invalid');
            return;
        }
        
        // Validate password requirements
        if (!passwordInput.validity.valid) {
            passwordInput.classList.add('is-invalid');
            return;
        }

        const email = emailInput.value;
        const password = passwordInput.value;

        try {
            const response = await fetch(`${API_URL}/users/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                // Try to extract error message from response body
                let errText = 'Login failed. Please check your credentials.';
                try {
                    const errBody = await response.json();
                    if (errBody && (errBody.error || errBody.message)) {
                        errText = errBody.error || errBody.message;
                    }
                } catch (e) {
                    // Ignore JSON parse errors, use default message
                }
                throw new Error(errText);
            }

            const data = await response.json();
            this.setAuthData(data);
        } catch (error) {
            console.error('Login failed:', error);
            this.showError(error.message, 'loginForm');
        }
    }

    /**
     * Handles user registration form submission
     * Validates inputs, sends registration request, and auto-logs in user
     * 
     * @param {Event} e - Form submit event
     */
    async handleRegister(e) {
        e.preventDefault();
        
        // Prevent double submission
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const name = document.getElementById('registerName').value;

        try {
            const response = await fetch(`${API_URL}/users/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name })
            });

            if (!response.ok) {
                // Try to extract error message from response body
                let errText = 'Registration failed. Please try again.';
                try {
                    const errBody = await response.json();
                    if (errBody && (errBody.error || errBody.message)) {
                        errText = errBody.error || errBody.message;
                    }
                } catch (e) {
                    // Ignore JSON parse errors, use default message
                }
                throw new Error(errText);
            }

            const data = await response.json();
            this.setAuthData(data);
        } catch (error) {
            console.error('Registration failed:', error);
            this.showError(error.message, 'registerForm');
        } finally {
            // Re-enable submit button after request completes
            submitButton.disabled = false;
        }
    }

    /**
     * Handles user logout
     * Clears auth state and resets UI to login screen
     * Explicitly updates UI elements to ensure visibility changes
     */
    handleLogout() {
        // Clear auth state via centralized function (this sets offline mode)
        authLogout();
        this.token = null;
        this.user = null;
        
        // Read the offline mode state that was just set by authLogout
        this.offlineMode = localStorage.getItem('offlineMode') === 'true';
        
        // Hide verification UI
        this.hideVerificationBanner();
        this.hideVerificationBadge();
        
        // Explicitly update UI elements
        const authContainer = document.getElementById('authContainer');
        const userInfo = document.getElementById('userInfo');
        
        userInfo?.classList.add('hidden');
        authContainer?.classList.remove('hidden');
        
        // Also call initializeUI for any other updates
        this.initializeUI();
    }

    /**
     * Handles account deletion
     * Prompts for confirmation, deletes account via API, and clears all data
     */
    async handleDeleteAccount() {
        const confirmed = confirm(
            'Are you sure you want to delete your account? ' +
            'This action cannot be undone and all your notes will be deleted.'
        );
        
        if (!confirmed) return;

        try {
            const response = await fetch(`${API_URL}/users/account`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete account');
            }

            // Clear all local data and reload app
            localStorage.clear();
            window.location.reload();
        } catch (error) {
            console.error('Delete account failed:', error);
            this.showError('Failed to delete account. Please try again.');
        }
    }

    /**
     * Enables offline mode
     * Hides authentication UI and shows notes interface
     * Dispatches 'offline-mode-changed' event to notify other components
     * 
     * @fires CustomEvent#offline-mode-changed
     */
    enableOfflineMode() {
        console.log('[LoginManager] Enabling offline mode');
        
        // Set offline mode flags BEFORE clearing auth
        // This ensures the flags are set when authLogout runs
        localStorage.setItem('offlineMode', 'true');
        localStorage.setItem('storageMode', 'offline');
        
        // Clear authentication state when entering offline mode
        // This will also dispatch auth-changed event
        authLogout();
        this.token = null;
        this.user = null;
        this.offlineMode = true;
        
        console.log('[LoginManager] Auth cleared, hiding login');
        
        // Update StorageManager mode if it exists
        if (window.app?.settingsController?.storageManager) {
            console.log('[LoginManager] Updating StorageManager to offline mode');
            window.app.settingsController.storageManager.isOnline = false;
        }
        
        // Hide auth container and show notes interface
        const authContainer = document.getElementById('authContainer');
        authContainer?.classList.add('hidden');
        
        console.log('[LoginManager] Dispatching offline-mode-changed event');
        
        // Dispatch offline mode changed event
        window.dispatchEvent(new CustomEvent('offline-mode-changed', { 
            detail: { isOffline: true } 
        }));
        
        console.log('[LoginManager] Loading notes');
        
        // Load offline notes if notesManager exists
        if (window.app?.notesManager) {
            window.app.notesManager.loadNotes();
        } else {
            console.warn('[LoginManager] notesManager not found on window.app');
        }
        
        console.log('[LoginManager] Offline mode enabled successfully');
    }

    /**
     * Sets authentication data after successful login/registration
     * Updates both centralized auth module and local instance state
     * Dispatches 'auth-changed' event to notify other components
     * Shows verification banner and badge if email is not verified
     * 
     * @param {Object} data - Response data containing token and user
     * @param {string} data.token - Authentication token
     * @param {Object} data.user - User object with profile data
     * @fires CustomEvent#auth-changed
     */
    setAuthData(data) {
        // Update centralized auth state
        setAuthToken(data.token);
        setCurrentUser(data.user);
        
        // Update local instance state
        this.token = data.token;
        this.user = data.user;

        // Update UI
        this.updateUserInfo();
        
        // Update verification UI (banner + badge)
        this.updateVerificationUI();
        
        // Notify application of authentication
        window.dispatchEvent(new CustomEvent('auth-changed', { 
            detail: { 
                isAuthenticated: true, 
                user: this.user 
            } 
        }));

        // Refresh UI visibility
        this.initializeUI();
    }

    /**
     * Updates the user info display with current user data
     * Shows user name or email in the UI
     */
    updateUserInfo() {
        const userName = document.getElementById('userName');
        if (userName && this.user) {
            userName.textContent = this.user.name || this.user.email;
        }
    }

    /**
     * Toggles between login and registration forms
     * 
     * @param {string} form - Which form to show ('login' or 'register')
     */
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

    /**
     * Displays an error message in the form
     * 
     * @param {string} message - Error message to display
     * @param {string} [formId] - ID of the form to show error in (defaults to active form)
     */
    showError(message, formId = null) {
        // Determine which form is visible
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        let activeForm;
        if (formId) {
            activeForm = document.getElementById(formId);
        } else {
            activeForm = !loginForm?.classList.contains('hidden') ? loginForm : registerForm;
        }
        
        if (!activeForm) return;

        // Remove any existing error messages
        const existingError = activeForm.querySelector('.form-error-message');
        if (existingError) {
            existingError.remove();
        }

        // Create error message element
        const errorDiv = document.createElement('div');
        errorDiv.className = 'form-error-message';
        errorDiv.textContent = message;
        
        // Insert after the form header (h2)
        const formHeader = activeForm.querySelector('h2');
        if (formHeader && formHeader.nextSibling) {
            formHeader.parentNode.insertBefore(errorDiv, formHeader.nextSibling);
        } else {
            activeForm.insertBefore(errorDiv, activeForm.firstChild);
        }
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            errorDiv.classList.add('fade-out');
            setTimeout(() => errorDiv.remove(), 300);
        }, 5000);
    }

    /* ==================== EMAIL VERIFICATION UI METHODS ==================== */

    /**
     * Updates all verification UI elements based on user's verification status
     * Shows banner and badge if email is not verified
     * Hides them if email is verified or user is logged out
     */
    updateVerificationUI() {
        if (!this.user) {
            this.hideVerificationBanner();
            this.hideVerificationBadge();
            return;
        }
        
        if (this.user.email_verified) {
            this.hideVerificationBanner();
            this.hideVerificationBadge();
        } else {
            this.showVerificationBanner();
            this.showVerificationBadge();
        }
    }

    /**
     * Shows verification banner at top of page
     * Banner is dismissible and remembers dismissal in session storage
     * Displays a warning to unverified users to check their email
     */
    showVerificationBanner() {
        if (!this.user || this.user.email_verified) return;
        
        // Check if banner was dismissed this session
        const dismissed = sessionStorage.getItem('verificationBannerDismissed');
        if (dismissed === 'true') return;
        
        // Remove existing banner if any
        const existingBanner = document.getElementById('verificationBanner');
        if (existingBanner) {
            existingBanner.remove();
        }
        
        // Create banner
        const banner = document.createElement('div');
        banner.id = 'verificationBanner';
        banner.className = 'verification-banner';
        banner.innerHTML = `
            <span class="verification-banner-icon">⚠️</span>
            <div class="verification-banner-text">
                Please verify your email to unlock all features. Check your inbox for the verification link!
            </div>
            <button class="verification-banner-close" aria-label="Close">×</button>
        `;
        
        // Add close handler
        banner.querySelector('.verification-banner-close').addEventListener('click', () => {
            banner.classList.add('hidden');
            sessionStorage.setItem('verificationBannerDismissed', 'true');
            setTimeout(() => banner.remove(), 300);
        });
        
        // Add to page
        document.body.appendChild(banner);
    }

    /**
     * Hides verification banner
     * Called when user verifies email or logs out
     */
    hideVerificationBanner() {
        const banner = document.getElementById('verificationBanner');
        if (banner) {
            banner.classList.add('hidden');
            setTimeout(() => banner.remove(), 300);
        }
        sessionStorage.removeItem('verificationBannerDismissed');
    }

    /**
     * Shows verification badge next to username
     * Badge displays "⚠️ Unverified" status in the user info panel
     */
    showVerificationBadge() {
        if (!this.user || this.user.email_verified) {
            this.hideVerificationBadge();
            return;
        }
        
        const userName = document.getElementById('userName');
        if (!userName) return;
        
        // Remove existing badge if any
        this.hideVerificationBadge();
        
        // Create badge
        const badge = document.createElement('span');
        badge.id = 'verificationBadge';
        badge.className = 'verification-badge';
        badge.innerHTML = `
            <span class="verification-badge-icon">⚠️</span>
            <span>Unverified</span>
        `;
        
        // Insert after username
        userName.parentNode.insertBefore(badge, userName.nextSibling);
    }

    /**
     * Hides verification badge
     * Called when user verifies email or logs out
     */
    hideVerificationBadge() {
        const badge = document.getElementById('verificationBadge');
        if (badge) {
            badge.remove();
        }
    }
}
