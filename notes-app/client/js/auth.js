// Auth state
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// API URLs
const API_URL = 'http://localhost:5000/api';

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    const logoutBtn = document.getElementById('logoutBtn');

    // Toggle between login and register forms
    showRegister.addEventListener('click', () => {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
    });

    showLogin.addEventListener('click', () => {
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    });

    // Handle login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch(`${API_URL}/users/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                handleLoginSuccess(data);
            } else {
                alert(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed. Please try again.');
        }
    });

    // Handle register form submission
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;

        try {
            const response = await fetch(`${API_URL}/users/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                handleLoginSuccess(data);
                alert('Registration successful!');
            } else {
                alert(data.error || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            alert('Registration failed. Please try again.');
        }
    });

    // Handle logout
    logoutBtn.addEventListener('click', logout);

    // Check if user is already logged in
    checkAuth();
});

// Handle successful login
function handleLoginSuccess(data) {
    currentUser = data.user;
    authToken = data.token;
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('user', JSON.stringify(currentUser));
    
    document.getElementById('authContainer').classList.add('hidden');
    document.getElementById('userInfo').classList.remove('hidden');
    document.getElementById('userName').textContent = currentUser.name || currentUser.email;
    
    // Refresh notes after login
    window.dispatchEvent(new CustomEvent('auth-changed', { detail: { isAuthenticated: true } }));
}

// Logout function
function logout() {
    currentUser = null;
    authToken = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    
    document.getElementById('authContainer').classList.remove('hidden');
    document.getElementById('userInfo').classList.add('hidden');
    
    // Clear notes after logout
    window.dispatchEvent(new CustomEvent('auth-changed', { detail: { isAuthenticated: false } }));
}

// Check if user is authenticated
function checkAuth() {
    const token = localStorage.getItem('authToken');
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (token && user) {
        currentUser = user;
        authToken = token;
        document.getElementById('authContainer').classList.add('hidden');
        document.getElementById('userInfo').classList.remove('hidden');
        document.getElementById('userName').textContent = user.name || user.email;
        window.dispatchEvent(new CustomEvent('auth-changed', { detail: { isAuthenticated: true } }));
    }
}

// Get auth token
export function getAuthToken() {
    return authToken;
}

// Check if user is authenticated
export function isAuthenticated() {
    return !!authToken;
}

// Get current user
export function getCurrentUser() {
    return currentUser;
}

export { logout };
