// Auth state
let currentUser = null;
// Support two possible token keys used in the app ('authToken' and older 'token')
let authToken = localStorage.getItem('authToken') || localStorage.getItem('token');

// API URLs
const API_URL = 'http://localhost:5000/api';

// This module provides lightweight auth helpers only.
// UI event handling is performed by LoginManager to avoid duplicate listeners.

// Get auth token
export function getAuthToken() {
    // Always read from localStorage to avoid stale in-memory state
    return localStorage.getItem('authToken') || localStorage.getItem('token') || authToken;
}

// Check if user is authenticated
export function isAuthenticated() {
    return !!(localStorage.getItem('authToken') || localStorage.getItem('token') || authToken);
}

// Get current user
export function getCurrentUser() {
    return currentUser;
}

export function logout() {
    currentUser = null;
    authToken = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.dispatchEvent(new CustomEvent('auth-changed', { detail: { isAuthenticated: false } }));
}
